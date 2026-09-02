/**
 * The club's marker artwork, as `<symbol>` bodies.
 *
 * One place, because three things draw these now — the poster, the table and
 * the map — and they have to be the same drawing or the page teaches three
 * different vocabularies for the same four kinds of thing.
 *
 * The map cannot use the symbols: MapLibre rasterises the files themselves.
 * The two static consumers share one sprite instead, so the markup appears
 * once per page however many rows and markers reference it.
 */
import takeoffSvg from '../assets/map/takeoff.svg?raw';
import landingSvg from '../assets/map/landing.svg?raw';

import type { FeatureType } from './featureTypes';

/**
 * The innards of an SVG file, ready to be wrapped in a `<symbol>`.
 *
 * Sliced rather than matched with a regular expression. A pattern containing
 * literal tags inside `.astro` frontmatter derails the compiler's parse, and it
 * fails in a way that names nothing useful — `Astro.props` silently degrades to
 * `any` and the errors surface as unrelated indexing complaints elsewhere. It
 * lives in a `.ts` file now, but the shape stays: there is no reason for it to
 * be a regular expression.
 */
function symbolBody(markup: string): string {
  const openTagEnd = markup.indexOf('>', markup.indexOf('<svg'));
  const closeTag = markup.lastIndexOf('</svg>');
  return markup.slice(openTagEnd + 1, closeTag);
}

/**
 * Strips the white keyline the artwork carries.
 *
 * The keyline exists so a marker stays legible over a photographic basemap. On
 * a flat page it does the opposite: the landing target's ring is 11 units of
 * 100, the keyline eats several from each edge, and what survives reads as a
 * plain dot however large the icon is drawn. The map keeps the files intact —
 * only the static contexts use these.
 *
 * Two shapes to remove, because the two files express the keyline differently:
 * `landing` overlays a white path through a mask, and `takeoff` strokes its
 * own path white.
 */
function withoutKeyline(markup: string): string {
  let out = markup;

  // The masked white overlay, and the mask it refers to.
  for (const tag of ['mask', 'path']) {
    let start = out.indexOf(`<${tag} `);
    while (start !== -1) {
      const selfClosing = out.indexOf('/>', start);
      const closing = out.indexOf(`</${tag}>`, start);
      const end =
        closing !== -1 && (selfClosing === -1 || closing < selfClosing)
          ? closing + `</${tag}>`.length
          : selfClosing + 2;
      const element = out.slice(start, end);
      if (
        element.includes('mask=') ||
        (tag === 'mask' && element.includes('maskUnits'))
      ) {
        out = out.slice(0, start) + out.slice(end);
      } else {
        start = out.indexOf(`<${tag} `, end);
        continue;
      }
      start = out.indexOf(`<${tag} `, start);
    }
  }

  // The stroked white outline.
  return out.replace(/\s*stroke="white"/g, '').replace(/\s*stroke-width="5"/g, '');
}

/** Only the kinds that have artwork; the rest are drawn as dots. */
export const FEATURE_SYMBOLS: Partial<Record<FeatureType, string>> = {
  takeoff: withoutKeyline(symbolBody(takeoffSvg)),
  landing: withoutKeyline(symbolBody(landingSvg)),
};

/** The id a `<use>` points at, and the one the sprite defines. */
export function symbolId(type: FeatureType): string {
  return `feature-${type}`;
}
