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
const TEMPLATE_VERSION = 10;

const WIDTH = 1280;
const HEIGHT = 640;
const CACHE_DIR = '.astro/og-cache';

const BRAND_BLUE = '#1f52a6';

const font = await readFile('src/assets/fonts/Metropolis-Bold.ttf');

/**
 * The brand-blue veil laid over a washed photograph.
 *
 * 0.58, and the title is protected by a scrim beside it rather than by this.
 * Taking the veil to 0.82 — enough for white to clear 4.5:1 anywhere on the
 * card — flattened the photograph into a blue rectangle with a suggestion of
 * something behind it, which defeats the point of using a photograph. The
 * ridge line has to be visible.
 */
const WASH = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 0x1f, g: 0x52, b: 0xa6, alpha: 0.58 },
  },
})
  .png()
  .toBuffer();

/*
  The branding on every card is one asset: `src/assets/og-logo.svg`, the mark on
  an oval plate. It is drawn as-is — no recolouring, no plate assembled here —
  so replacing that file with a designed one restyles every card at once.
  Bump TEMPLATE_VERSION when you do, or the cached cards keep the old lockup.
*/
const LOGO_SVG = await readFile('src/assets/og-logo.svg', 'utf8');
const LOGO = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;
/*
  440, not the 300 this started at. At 300 the oval read as a decoration in the
  corner and the word inside it — which is the club's name, and the only place
  the name appears on a card whose title is something else — was too small to
  read at the size a preview is actually shown in a chat.
*/
const LOGO_WIDTH = 440;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 486) / 1078); // the asset's ratio

export interface CardOptions {
  title: string;
  /** Shown small above the title — "Siti di volo", "News", … */
  kind?: string;
  /** Absolute path to a background photograph. Falls back to the brand card. */
  backgroundPath?: string;
  /**
   * Ghost the photograph into the brand blue instead of filling the card with
   * it. For the homepage: the card is the club's, not one photograph's, but a
   * flat blue rectangle says nothing about where the club flies.
   */
  washed?: boolean;
}

/**
 * The card itself, as the element tree satori renders.
 *
 * Written as plain objects rather than JSX so this file stays a `.ts` and needs
 * no JSX pragma for a template that is never a component.
 */
function card(
  title: string,
  kind: string | undefined,
  background: string | null,
  washed = false,
) {
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
              backgroundImage:
                background && !washed
                  ? 'linear-gradient(to bottom, rgba(9,14,22,0.15) 0%, rgba(9,14,22,0.55) 55%, rgba(9,14,22,0.88) 100%)'
                  : washed
                    ? /*
                        Left to right, not top to bottom. The text sits bottom
                        left and this photograph's ridge line runs across the
                        lower right, so a foot scrim would have darkened the
                        one thing the card is showing. This darkens the column
                        the words are in and leaves the mountains alone.
                      */
                      'linear-gradient(to right, rgba(9,14,22,0.66) 0%, rgba(9,14,22,0.42) 40%, rgba(9,14,22,0) 78%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(9,14,22,0.35) 100%)',
            },
          },
        },
        // The lockup, top left.
        {
          type: 'img',
          props: {
            src: LOGO,
            width: LOGO_WIDTH,
            height: LOGO_HEIGHT,
            style: { position: 'absolute', top: 44, left: 52 },
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
  washed = false,
}: CardOptions): Promise<Buffer> {
  const background = backgroundPath ? await readFile(backgroundPath) : null;

  const key = createHash('sha256')
    .update(String(TEMPLATE_VERSION))
    .update(title)
    .update(kind ?? '')
    .update(background ?? 'no-photo')
    .update(washed ? 'washed' : 'full')
    .digest('hex')
    .slice(0, 16);

  const cached = join(CACHE_DIR, `${key}.jpg`);
  if (existsSync(cached)) return readFile(cached);

  // Cover-crop the background first: satori honours objectFit, but handing it
  // a 4000px photograph to embed is wasteful.
  const fitted = background
    ? await sharp(background)
        .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
        /*
          Washing is done here rather than with an opacity in the template:
          satori's support for it is partial, and this way the result is one
          flat image whose contrast can be measured off the file.

          Desaturate first, then lay the brand blue over it. Doing only the
          blue leaves the photograph's own colours fighting through it; doing
          only the desaturation leaves a grey card that is not the club's.
        */
        .modulate(washed ? { saturation: 0.2, brightness: 1.06 } : {})
        .composite(washed ? [{ input: WASH, blend: 'over' }] : [])
        .jpeg({ quality: 82 })
        .toBuffer()
    : null;

  const svg = await satori(
    card(
      title,
      kind,
      fitted ? `data:image/jpeg;base64,${fitted.toString('base64')}` : null,
      washed,
    ) as never,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: 'Metropolis', data: font, weight: 700, style: 'normal' }],
    },
  );

  /*
    JPEG at 78 with mozjpeg, and deliberately not WebP.

    Not PNG, which is what the old cards were: these are photographs, and the
    same card is 1.2 MB as a PNG against ~75 kB here.

    Not WebP either, though it would be another ~35% smaller — because nothing
    a visitor loads is ever this file. Only link scrapers fetch it, and their
    WebP support is uneven (Facebook and WhatsApp, which is where this club
    shares things, have a long history of not rendering WebP cards). Trading a
    working preview on the club's main channel for bytes no visitor pays is a
    bad deal. Every image the *site* serves is already WebP or AVIF.

    78 rather than 84: at the size a preview is actually displayed the two are
    indistinguishable, and it takes ~25% off.
  */
  const jpg = await sharp(Buffer.from(svg))
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cached, jpg);
  return jpg;
}
