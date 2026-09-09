/**
 * The two build-time image questions this site asks that Astro does not.
 *
 * Twenty pixels wide, blurred, WebP, inlined as a data URI: about 300 to 600
 * bytes, which is small enough to sit in the HTML and be painted with the
 * first frame. Nothing here runs in a browser.
 *
 * Sharp rather than Astro's own pipeline, because the pipeline returns URLs
 * and this needs bytes: `getImage()` hands back a path to a file that does not
 * exist until the build writes it, long after the page has been rendered.
 * Sharp is already a dependency, for the social cards.
 */
import { join } from 'node:path';

import type { ImageMetadata } from 'astro';
import sharp from 'sharp';

/**
 * Where each imported image came from.
 *
 * `ImageMetadata` carries the *output* URL and no trace of the file behind it,
 * so the map is built the other way round: glob every asset, keep what each
 * one's `src` turns out to be, and look the path up by that. The glob is eager
 * and server-side only. It costs nothing in the output: Astro already emits
 * the original of every image imported this way.
 */
const ASSETS = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

const PATH_BY_SRC = new Map<string, string>();
for (const [path, module] of Object.entries(ASSETS)) {
  PATH_BY_SRC.set(module.default.src, join(process.cwd(), path));
}

/** The crop the full-size image will be given, so the blur matches it. */
export interface Crop {
  width?: number;
  height?: number;
  position?: string;
  /**
   * How many pixels wide the placeholder is. Twenty by default.
   *
   * Twenty is right for a photograph, where the eye reads a blurred wash of
   * the real colours and fills in the rest. It is not right for a map: at
   * twenty pixels a map still is one flat beige, because a map is mostly one
   * flat beige with thin lines on it, and the placeholder ends up saying
   * nothing at all. Those pass a larger number, and pay a few hundred bytes of
   * inline data URI for a placeholder with the valley in it.
   */
  pixels?: number;
}

/*
  One placeholder per image and crop, not one per render: a news card is drawn
  three times on the home page and again on /news/, and the site has fifteen
  maps. Sharp is fast at this size, but not free, and a build should not pay
  for the same twenty pixels twice.
*/
const cache = new Map<string, Promise<string | undefined>>();

/** Twenty pixels of blurred image, as a `data:` URI, or nothing. */
export function lqip(
  image: ImageMetadata,
  crop: Crop = {},
): Promise<string | undefined> {
  const key =
    `${image.src}|${crop.width ?? ''}x${crop.height ?? ''}` +
    `|${crop.position ?? ''}|${crop.pixels ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const made = make(image, crop);
  cache.set(key, made);
  return made;
}

async function make(image: ImageMetadata, crop: Crop): Promise<string | undefined> {
  const file = PATH_BY_SRC.get(image.src);
  /*
    An image from somewhere the glob does not reach: no placeholder, and no
    build failure either. The page still gets the picture, it just arrives
    without a blur under it.
  */
  if (!file) return undefined;

  const ratio =
    crop.width && crop.height ? crop.width / crop.height : image.width / image.height;
  const width = crop.pixels ?? 20;
  const height = Math.max(1, Math.round(width / ratio));

  try {
    const buffer = await sharp(file)
      .resize(width, height, { fit: 'cover', position: crop.position ?? 'centre' })
      /*
        Blurred here rather than with a CSS filter on the element: a filter
        costs a paint on every scroll and this costs one build. The radius is
        in pixels of the placeholder, and it barely grows with it: scaled
        proportionally, a forty-pixel image blurred by three is smeared back
        into the same flat wash a twenty-pixel one was, and compresses to the
        same 150 bytes. The point of asking for more pixels is to keep some
        structure, so the radius stays near 1.5.
      */
      .blur(Math.max(1.2, width / 26))
      .webp({ quality: 45, effort: 4 })
      .toBuffer();
    return `data:image/webp;base64,${buffer.toString('base64')}`;
  } catch {
    /* A format sharp cannot read is not worth failing a build over. */
    return undefined;
  }
}

/*
  Whether AVIF is worth serving for a given picture.

  Not a foregone conclusion, which is the point. On the map stills AVIF is 40%
  *larger* at every width, because those are flat renders of a map, full of
  lines and labels, and their source is already a lossy WebP: AVIF spends bits
  preserving another encoder's artefacts. The news flyers behave the same way
  for the same reason.

  So the answer is measured rather than assumed: encode a small copy both ways
  and compare. Small, because the ratio holds (320 px and 640 px agree in
  direction on every image here) and a full-size AVIF encode is seconds, not
  milliseconds. Cached per image and quality, so a build pays once for a card
  drawn on four pages.

  ## What this comparison is, and is not

  It compares the two formats at the same *number*, and AVIF's quality scale
  is not WebP's: the same number buys a better picture and a bigger file. So
  at equal number AVIF loses on every photograph on this site (measured
  2026-09-09 over all eleven: 15% to 93% larger), and the build ships three
  AVIF files, all on the home page. That is not the bug it looks like. The
  fair comparison was run too, matching AVIF to WebP q70 by SSIM at 640 px:
  the median saving is 4%, AVIF is *larger* on five of the eleven including
  the four heaviest, and the crossover quality wanders from 47 to 67. Every
  photograph here is a lossy JPEG already, and AVIF pays for the JPEG's
  artefacts the way it pays for the map's. A consistent win needs 4:2:0
  chroma and encoder effort 6 on top, neither reachable through `getImage`,
  for about 14%. Ten fewer WebP quality points save more and cost one number.

  So the comparison stays as it is, knowingly unfair to AVIF: what it catches
  is an image where AVIF wins outright, and on this site that is the one
  drawn on the home page. If the photographs are ever replaced with clean
  sources, run the fair comparison again before believing this paragraph.
*/
const SAMPLE_WIDTH = 320;
const verdicts = new Map<string, Promise<boolean>>();

/** True when AVIF is the smaller format for this image, measured. */
export function avifWins(image: ImageMetadata, quality: number): Promise<boolean> {
  const key = `${image.src}|${quality}`;
  const hit = verdicts.get(key);
  if (hit) return hit;
  const asked = weigh(image, quality);
  verdicts.set(key, asked);
  return asked;
}

async function weigh(image: ImageMetadata, quality: number): Promise<boolean> {
  const file = PATH_BY_SRC.get(image.src);
  /* Unknown source: WebP, which is what the site shipped before AVIF existed. */
  if (!file) return false;
  try {
    const sample = sharp(file).resize(SAMPLE_WIDTH, undefined, {
      withoutEnlargement: true,
    });
    const [avif, webp] = await Promise.all([
      sample.clone().avif({ quality }).toBuffer(),
      sample.clone().webp({ quality }).toBuffer(),
    ]);
    return avif.length < webp.length;
  } catch {
    return false;
  }
}
