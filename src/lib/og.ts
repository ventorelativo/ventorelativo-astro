/**
 * Social card generation (S3).
 *
 * The Drupal site composited the page title — Metropolis Bold, uppercase,
 * outlined — over `social-card.png` with the `textimage` module. Same idea,
 * better inputs: where a page has its own photograph, the card is built on
 * that, with the club logo laid over it and a scrim so the title reads. Where
 * there is no photograph — twelve of the fourteen sites, and every fixed page —
 * it is a plain brand-blue card with the mark and the title, which is cleaner
 * than darkening the club's logo card and then setting a second logo on top of
 * it.
 *
 * How it is drawn: satori turns a small element tree into SVG with the text
 * already converted to paths (so no font is needed at raster time), and sharp
 * rasterises that to PNG. Both are devDependencies — this runs at build, and
 * not one byte of it reaches a visitor.
 *
 * ## Caching
 *
 * Rendering ~25 cards costs a couple of seconds, and almost none of them change
 * between builds. Every card is therefore keyed by a hash of everything that
 * affects its pixels — title, kind, source image bytes, and TEMPLATE_VERSION —
 * and written to `.astro/og-cache/`. A hit is a file read.
 *
 * That makes a local rebuild instant. A cold CI build has no cache and renders
 * all of them, which is the couple of seconds; if that ever matters, the cache
 * directory is the thing to persist between Netlify builds.
 *
 * **Bump TEMPLATE_VERSION whenever the design below changes**, or every card
 * will keep its old pixels for ever.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/** Bump on any change to `card()` below. Part of the cache key. */
const TEMPLATE_VERSION = 3;

const WIDTH = 1280;
const HEIGHT = 640;
const CACHE_DIR = '.astro/og-cache';

const BRAND_BLUE = '#1f52a6';

const font = await readFile('src/assets/fonts/Metropolis-Bold.ttf');
const logo = await readFile('src/assets/logo-card.svg', 'utf8');

const dataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/*
  Two versions of the mark. Over a photograph the artwork's own brand blue is
  right; on the flat brand-blue card the blue paraglider and wordmark disappear
  into the background, so those strokes go white. The yellow works on both.
*/
const LOGO_ON_PHOTO = dataUri(logo);
const LOGO_ON_BLUE = dataUri(logo.replaceAll('#1F52A6', '#ffffff'));

export interface CardOptions {
  title: string;
  /** Shown small above the title — "Siti di volo", "News", … */
  kind?: string;
  /** Absolute path to a background photograph. Falls back to the brand card. */
  backgroundPath?: string;
}

/**
 * The card itself, as the element tree satori renders.
 *
 * Written as plain objects rather than JSX so this file stays a `.ts` and needs
 * no JSX pragma for a template that is never a component.
 */
function card(title: string, kind: string | undefined, background: string | null) {
  return {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        position: 'relative',
        backgroundColor: BRAND_BLUE,
        fontFamily: 'Metropolis',
      },
      children: [
        // The photograph, when there is one.
        background && {
          type: 'img',
          props: {
            src: background,
            width: WIDTH,
            height: HEIGHT,
            style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' },
          },
        },
        // Over a photograph: a scrim, heavier at the foot, so the title reads.
        // Without one: a little depth on the flat blue.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: WIDTH,
              height: HEIGHT,
              backgroundImage: background
                ? 'linear-gradient(to bottom, rgba(9,14,22,0.15) 0%, rgba(9,14,22,0.55) 55%, rgba(9,14,22,0.88) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(9,14,22,0.35) 100%)',
            },
          },
        },
        // The mark, top left.
        {
          type: 'img',
          props: {
            src: background ? LOGO_ON_PHOTO : LOGO_ON_BLUE,
            width: 260,
            height: 107,
            style: { position: 'absolute', top: 54, left: 64 },
          },
        },
        // Kind + title, bottom left.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              padding: '0 64px 60px',
              position: 'relative',
            },
            children: [
              kind && {
                type: 'div',
                props: {
                  style: {
                    fontSize: 30,
                    letterSpacing: 4,
                    textTransform: 'uppercase',
                    color: '#ffd54a',
                    marginBottom: 14,
                  },
                  children: kind,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: title.length > 48 ? 58 : 76,
                    lineHeight: 1.1,
                    letterSpacing: -1,
                    color: '#ffffff',
                    // satori has no `text-wrap`, so long titles simply wrap.
                    display: 'flex',
                  },
                  children: title,
                },
              },
            ].filter(Boolean),
          },
        },
      ].filter(Boolean),
    },
  };
}

/** Renders a card, or returns the cached image when nothing about it changed. */
export async function renderCard({
  title,
  kind,
  backgroundPath,
}: CardOptions): Promise<Buffer> {
  const background = backgroundPath ? await readFile(backgroundPath) : null;

  const key = createHash('sha256')
    .update(String(TEMPLATE_VERSION))
    .update(title)
    .update(kind ?? '')
    .update(background ?? 'no-photo')
    .digest('hex')
    .slice(0, 16);

  const cached = join(CACHE_DIR, `${key}.jpg`);
  if (existsSync(cached)) return readFile(cached);

  // Cover-crop the background first: satori honours objectFit, but handing it
  // a 4000px photograph to embed is wasteful.
  const fitted = background
    ? await sharp(background)
        .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 82 })
        .toBuffer()
    : null;

  const svg = await satori(
    card(
      title,
      kind,
      fitted ? `data:image/jpeg;base64,${fitted.toString('base64')}` : null,
    ) as never,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: 'Metropolis', data: font, weight: 700, style: 'normal' }],
    },
  );

  /*
    JPEG, though the old cards were PNG. These are photographs: the same card
    is 1.2 MB as a PNG and about 120 kB at quality 84, and every share fetches
    it. `mozjpeg` for the better encoder at the same quality.
  */
  const jpg = await sharp(Buffer.from(svg))
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cached, jpg);
  return jpg;
}
