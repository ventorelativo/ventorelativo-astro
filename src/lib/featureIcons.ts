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

/** Only the kinds that have artwork; the rest are drawn as dots. */
export const FEATURE_SYMBOLS: Partial<Record<FeatureType, string>> = {
  takeoff: symbolBody(takeoffSvg),
  landing: symbolBody(landingSvg),
};

/** The id a `<use>` points at, and the one the sprite defines. */
export function symbolId(type: FeatureType): string {
  return `feature-${type}`;
}
