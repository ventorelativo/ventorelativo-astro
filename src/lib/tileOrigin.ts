/**
 * Where map tiles come from: one string, in a module of its own.
 *
 * The map facade preconnects to this host the moment a visitor shows intent,
 * which means it needs the value *eagerly*, before anything about the map has
 * loaded. Importing it from `mapConfig.ts` did that, and dragged the whole of
 * `mapConfig` (styles, layer lists, thermal seasons) into the page bundle of
 * every page with a map, defeating the point of the facade. Rollup said so:
 * "dynamically imported ... but also statically imported, dynamic import will
 * not move module into another chunk."
 *
 * So it lives here, alone, and `mapConfig` re-exports it. One definition, and
 * a static import that costs a string.
 */
export const TILE_ORIGIN = 'https://api.maptiler.com';
