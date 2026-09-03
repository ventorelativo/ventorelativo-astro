/**
 * The press kit's downloadable artwork.
 *
 * One list, rendered at build time from `src/assets/logo-card.svg` — the same
 * file `<Logo>` inlines into the header. Nothing here is a second copy of the
 * logo that could quietly diverge from the one on the site, which is the usual
 * way a press kit goes stale.
 *
 * ## Why these five
 *
 * A journalist or a club member posting on Facebook needs, in practice: the
 * vector for print, a big transparent PNG for anything digital, a version with
 * a solid ground for the many places that flatten transparency onto white text
 * or a dark card, and a square for a profile picture. That is the list.
 *
 * The square variants exist because the lockup is 708x292 — a 2.4:1 oval — and
 * every avatar slot on every platform is a square or a circle. Uploaded as-is
 * it comes out as a stripe with the ends cut off.
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

/** The blue the logo is drawn in; the ground the reversed versions sit on. */
const BRAND_BLUE = '#1F52A6';

export interface PressAsset {
  /** File name without extension; also the route. */
  slug: string;
  label: string;
  /** What it is for, in one line. */
  use: string;
  width: number;
  /** Square when set equal to `width`; otherwise follows the artwork. */
  height?: number;
  /** A solid ground, or transparent when absent. */
  background?: string;
  /** Fraction of the shorter side left clear around the logo. */
  padding?: number;
  /**
   * Swap the logo's blue for white before rasterising.
   *
   * Needed for anything on a dark ground, and not optional: the logo's
   * "white" is transparency, not paint. Composited onto blue, the sky behind
   * the mountain and the gaps in the wordmark fill with blue, the blue
   * paraglider lines disappear into it, and what is left is a yellow blob.
   * A reversed mark is a different drawing, not a different background.
   */
  reversed?: boolean;
}

export const PRESS_ASSETS: PressAsset[] = [
  {
    slug: 'ventorelativo-logo',
    label: 'Logo, PNG trasparente',
    use: 'Uso generale su fondi chiari. 2000 px di larghezza.',
    width: 2000,
    padding: 0.02,
  },
  {
    slug: 'ventorelativo-logo-fondo-bianco',
    label: 'Logo su fondo bianco',
    use: 'Dove la trasparenza non è supportata, o su una foto.',
    width: 2000,
    background: '#ffffff',
    padding: 0.08,
  },
  {
    slug: 'ventorelativo-logo-fondo-blu',
    label: 'Logo in negativo su fondo blu',
    use: 'Su fondi scuri, o quando serve un blocco pieno.',
    width: 2000,
    background: BRAND_BLUE,
    padding: 0.08,
    reversed: true,
  },
  {
    slug: 'ventorelativo-logo-negativo',
    label: 'Logo in negativo, PNG trasparente',
    use: 'Da mettere su una foto scura o su un fondo di colore vostro.',
    width: 2000,
    padding: 0.02,
    reversed: true,
  },
  {
    slug: 'ventorelativo-quadrato-bianco',
    label: 'Quadrato, fondo bianco',
    use: 'Immagine del profilo: Facebook, Instagram, WhatsApp.',
    width: 1000,
    height: 1000,
    background: '#ffffff',
    padding: 0.12,
  },
  {
    slug: 'ventorelativo-quadrato-blu',
    label: 'Quadrato in negativo, fondo blu',
    use: 'Immagine del profilo dove il bianco sparisce nell’interfaccia.',
    width: 1000,
    height: 1000,
    background: BRAND_BLUE,
    padding: 0.12,
    reversed: true,
  },
];

/** The source artwork, read once per build. */
export function logoSource(): Promise<Buffer> {
  return readFile('src/assets/logo-card.svg');
}

/**
 * The same drawing with its blue painted white.
 *
 * A string replace on the fill attribute, which is safe here because the file
 * is a flat export with two literal fills and no gradients, `style` blocks or
 * `currentColor` — the assertion below is what keeps that true if the artwork
 * is ever replaced.
 */
export async function reversedLogo(): Promise<Buffer> {
  const svg = (await logoSource()).toString('utf8');
  const swapped = svg.replaceAll(BRAND_BLUE, '#FFFFFF');
  if (swapped === svg) {
    throw new Error(
      `press: no ${BRAND_BLUE} found in the logo, so the reversed variants ` +
        'would be identical to the normal ones. Has the artwork changed?',
    );
  }
  return Buffer.from(swapped, 'utf8');
}

/**
 * Rasterise one asset.
 *
 * `density: 400` because sharp rasterises SVG through librsvg at a DPI, not at
 * a target width: left at the default 72 the 2000px output is an upscale of a
 * 708px bitmap and the wordmark's thin strokes break up.
 */
export async function renderAsset(asset: PressAsset): Promise<Buffer> {
  const source = asset.reversed ? await reversedLogo() : await logoSource();
  const pad = asset.padding ?? 0;

  const boxWidth = asset.width;
  const boxHeight = asset.height ?? Math.round((asset.width * 292) / 708);
  const innerWidth = Math.round(boxWidth * (1 - pad * 2));
  const innerHeight = Math.round(boxHeight * (1 - pad * 2));

  const logo = await sharp(source, { density: 400 })
    .resize({
      width: innerWidth,
      height: innerHeight,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: boxWidth,
      height: boxHeight,
      channels: 4,
      background: asset.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
