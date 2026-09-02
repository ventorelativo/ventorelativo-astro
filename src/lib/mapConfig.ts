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

/** As the old map had it. A gentle lift, not a caricature of the valley. */
export const TERRAIN_EXAGGERATION = 1.2;

/** The tilt the old map eased to once its style had loaded. */
export const PITCH = 25;

export function styleUrl(): string {
  return `https://api.maptiler.com/maps/${STYLE_ID}/style.json?key=${MAPTILER_KEY}`;
}

export function terrainUrl(): string {
  return `https://api.maptiler.com/tiles/${TERRAIN_SOURCE}/tiles.json?key=${MAPTILER_KEY}`;
}

/** Where tiles come from, for the preconnect fired on hover. */
export const TILE_ORIGIN = 'https://api.maptiler.com';
