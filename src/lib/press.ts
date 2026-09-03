/**
 * The press kit's artwork.
 *
 * One list of variants; each one has a source SVG in `src/assets/press/` and
 * produces the downloads the page offers. The rasters are generated at build
 * from those same files, so there is no folder of exported PNGs to keep in
 * step with the drawings — which is how a press kit goes stale.
 *
 * ## Why these five
 *
 * A journalist or a club member posting on Facebook needs, in practice: the
 * vector for print, a big transparent PNG for anything digital, something that
 * survives being dropped on a photograph, a one-colour version for a fax-grade
 * reproduction, and a square for a profile picture. That is the list.
 *
 * The square exists because the lockup is a 2.4:1 oval and every avatar slot on
 * every platform is a square or a circle. Uploaded as-is it comes out as a
 * stripe with the ends cut off.
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

/** The blue the logo is drawn in. */
export const BRAND_BLUE = '#1F52A6';

export interface PressVariant {
  /** File name without extension; also the route. */
  slug: string;
  label: string;
  /** What it is for, in one line. */
  use: string;
  /** File under `src/assets/press/`. */
  source: string;
  /** Which downloads to offer. */
  formats: ('svg' | 'png')[];
  /** Raster width. */
  width: number;
  /** Set equal to `width` for a square; otherwise the artwork's own ratio. */
  height?: number;
  /** A solid ground for the raster, or transparent when absent. */
  background?: string;
  /** Fraction of the shorter side left clear around the artwork. */
  padding?: number;
}

export const PRESS_VARIANTS: PressVariant[] = [
  {
    slug: 'ventorelativo-logo',
    label: 'Logo a colori',
    use: 'La versione principale. Su fondi chiari e uniformi.',
    source: 'logo.svg',
    formats: ['svg', 'png'],
    width: 2000,
    padding: 0.02,
  },
  {
    slug: 'ventorelativo-logo-fondo-bianco',
    label: 'Logo su fondo bianco',
    use: 'Dove la trasparenza non è supportata: documenti, stampa, allegati.',
    source: 'logo.svg',
    formats: ['png'],
    width: 2000,
    background: '#ffffff',
    padding: 0.08,
  },
  {
    slug: 'ventorelativo-logo-bordo',
    label: 'Logo con bordo',
    use: 'Sopra una foto o un fondo poco uniforme: il bordo bianco lo stacca dallo sfondo.',
    source: 'logo-bordo.svg',
    formats: ['svg', 'png'],
    width: 2000,
    padding: 0.02,
  },
  {
    slug: 'ventorelativo-logo-mono',
    label: 'Logo monocromatico',
    use: 'Un solo colore, per stampe in bianco e nero, timbri, serigrafie e ricami.',
    source: 'logo-mono.svg',
    formats: ['svg', 'png'],
    width: 2000,
    padding: 0.02,
  },
  {
    slug: 'ventorelativo-quadrato',
    label: 'Logo quadrato',
    use: 'Immagine del profilo: chat, Facebook, Instagram. Già centrato per il ritaglio circolare.',
    source: 'logo-quadrato.svg',
    formats: ['svg', 'png'],
    width: 1000,
    height: 1000,
  },
];

/** Read one variant's source artwork. */
export function variantSource(variant: PressVariant): Promise<Buffer> {
  return readFile(`src/assets/press/${variant.source}`);
}

/** The height a variant's raster comes out at, for the label on the page. */
export function rasterHeight(variant: PressVariant, ratio: number): number {
  return variant.height ?? Math.round(variant.width / ratio);
}

/**
 * Rasterise one variant.
 *
 * `density: 400` because sharp rasterises SVG through librsvg at a DPI, not at
 * a target width: left at the default 72 the 2000px output is an upscale of a
 * 700px bitmap and the wordmark's thin strokes break up.
 */
export async function renderVariant(variant: PressVariant): Promise<Buffer> {
  const source = await variantSource(variant);
  const meta = await sharp(source).metadata();
  const ratio = (meta.width ?? 1) / (meta.height ?? 1);

  const pad = variant.padding ?? 0;
  const boxWidth = variant.width;
  const boxHeight = variant.height ?? Math.round(variant.width / ratio);

  const art = await sharp(source, { density: 400 })
    .resize({
      width: Math.round(boxWidth * (1 - pad * 2)),
      height: Math.round(boxHeight * (1 - pad * 2)),
      fit: 'inside',
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: boxWidth,
      height: boxHeight,
      channels: 4,
      background: variant.background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: art, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
