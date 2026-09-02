/**
 * Everything the interactive map needs from MapTiler, in one place.
 *
 * All of it is carried over from the old site's `mapper` module rather than
 * chosen: the club has a custom style, and the point of the migration is that
 * the map still looks like theirs.
 */

/**
 * The club's own style, "TopoPG" — 132 layers over contours, hillshade and
 * OpenMapTiles. Not a stock MapTiler style: it lives in the club's account, so
 * it is a plain id here and not something to substitute.
 */
export const STYLE_ID = '3d203d09-e79b-4c16-a28d-b9564619b3a7';

/**
 * Public by necessity: a tile key travels in the browser's requests, so it
 * cannot be hidden. It is protected by restricting the referrer domains in the
 * MapTiler dashboard, and it is in `SECRETS_SCAN_OMIT_KEYS` because Netlify's
 * scanner would otherwise fail the build for finding it in the output — which
 * is precisely where it belongs.
 */
export const MAPTILER_KEY = import.meta.env.PUBLIC_MAPTILER_KEY ?? '';

/** Elevation tiles, the thing that makes the terrain three-dimensional. */
export const TERRAIN_SOURCE = 'terrain-rgb-v2';

/**
 * Stronger than the old site's 1.2, and the tilt below is stronger than its 25.
 * Those numbers were faithful and produced something indistinguishable from the
 * flat hillshade at the scale a single site is framed at — the relief was there
 * and nobody could see it. These are the values at which a valley reads as a
 * valley.
 */
export const TERRAIN_EXAGGERATION = 1.5;

/** See the note on exaggeration above. */
export const PITCH = 55;

export function styleUrl(): string {
  return `https://api.maptiler.com/maps/${STYLE_ID}/style.json?key=${MAPTILER_KEY}`;
}

export function terrainUrl(): string {
  return `https://api.maptiler.com/tiles/${TERRAIN_SOURCE}/tiles.json?key=${MAPTILER_KEY}`;
}

/** Where tiles come from, for the preconnect fired on hover. */
export const TILE_ORIGIN = 'https://api.maptiler.com';

/**
 * How far a visitor may pan, as [[west, south], [east, north]].
 *
 * The club's 34 features span 6.99–7.36 E and 44.74–45.06 N; this is that box
 * with about 20 km of room on every side, which reaches Torino and the French
 * border and covers anywhere a flight from these sites could plausibly go.
 *
 * It is a courtesy to the visitor and to the tile quota in equal measure: a
 * stray drag on a phone can otherwise send the map to the Atlantic, fetching
 * tiles the whole way and leaving someone with no obvious way back.
 */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [6.74, 44.49],
  [7.61, 45.31],
];
