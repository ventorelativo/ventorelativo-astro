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

/**
 * A plain raster basemap, as an alternative to the club's vector style.
 *
 * Tracestrack Topo is what the old site offered in its style switcher, with
 * the same key — recovered from `leaflet_more_maps.settings.yml`. The key is
 * restricted by referrer rather than kept secret, which is why it can sit in a
 * public repository: it answers for ventorelativo.it and the Netlify hosts and
 * 403s everywhere else.
 *
 * `.webp` rather than `.png`, as the old module requested: the same tile at
 * roughly half the bytes, and every browser that can run MapLibre can decode
 * it.
 */
export const RASTER_BASE = {
  label: 'Topografica (raster)',
  tiles:
    'https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=b9c2fabd9b0774eb89ea495c32bb7c91',
  attribution: 'Tiles © <a href="https://tracestrack.com">Tracestrack</a>',
  maxzoom: 19,
};

/**
 * kk7's flight data, as a raster overlay.
 *
 * Two views of the same archive: `thermals` marks where pilots climbed, which
 * is the question a takeoff decision actually asks, and `skyways` draws every
 * track flown, which shows the routes but buries the lift under them. Thermals
 * is the default for that reason.
 *
 * Path is `{layer}_{season}_{time}`, and the published values for the last two
 * are not what their documentation says. Probed against the live tiles:
 *
 *  - **Seasons are quarters, not months.** `jan`, `apr`, `jul`, `oct`, each
 *    covering three months, plus `all`. September is `jul`, not `sep`, which
 *    404s — the docs' `thermals_jul_07` example is the only clue to this.
 *  - **Times are 04, 07 and 10**, hours since sunrise, plus `all`. The docs
 *    say 00, 07 and 12; 00 and 12 return 400 at every zoom and every season.
 *
 * `src` must name the host the page is served from — see `thermalTiles`.
 */
export const THERMAL_LAYERS = [
  { value: 'thermals', label: 'Termiche' },
  { value: 'skyways', label: 'Rotte percorse' },
] as const;

/**
 * The four quarters, named by their *middle* month.
 *
 * `jul` is June to August, not July to September: the month in the path sits at
 * the centre of its window, which is what kk7's "three consecutive months"
 * means and the opposite of the obvious reading. Backwards, it puts a September
 * visitor on summer data.
 */
export const THERMAL_SEASONS = [
  { value: 'all', label: 'Tutto l’anno' },
  { value: 'jan', label: 'Dic–Feb' },
  { value: 'apr', label: 'Mar–Mag' },
  { value: 'jul', label: 'Giu–Ago' },
  { value: 'oct', label: 'Set–Nov' },
] as const;

export const THERMAL_TIMES = [
  { value: 'all', label: 'Tutta la giornata' },
  { value: '04', label: 'Mattina' },
  { value: '07', label: 'Metà giornata' },
  { value: '10', label: 'Sera' },
] as const;

/**
 * The quarter today falls in, so the overlay opens on the season being flown
 * rather than on an average of the whole year.
 */
export function currentThermalSeason(now = new Date()): string {
  // Centred on the named month, so December and January share `jan`.
  //        Jan    Feb    Mar    Apr    May    Jun    Jul    Aug    Sep    Oct    Nov    Dec
  const quarters = [
    'jan',
    'jan',
    'apr',
    'apr',
    'apr',
    'jul',
    'jul',
    'jul',
    'oct',
    'oct',
    'oct',
    'jan',
  ];
  return quarters[now.getMonth()];
}

/**
 * `src` is not a courtesy — kk7 checks it against the Referer and refuses the
 * tile when the two disagree.
 *
 * Hardcoding `ventorelativo.it` therefore worked on the live domain and on
 * localhost, which kk7 waves through, and 403'd everywhere else: the Netlify
 * staging host, every branch preview, 127.0.0.1, and the ngrok tunnel the site
 * gets reviewed through. The tiles arrive as a 403 the map simply does not
 * draw, so it reads as the layer being broken rather than refused.
 *
 * Reading the hostname at call time makes every one of those match, because
 * the browser's Referer and this parameter then name the same host.
 *
 * One quirk of theirs survives that and is not worth working around: they
 * match `localhost` loosely and `127.0.0.1` exactly, so a referer carrying a
 * port passes as `http://localhost:4321/` and is refused as
 * `http://127.0.0.1:4321/`. Same machine, same server, same tiles. Develop on
 * `localhost` and the layer works; nothing deployed is affected.
 */
export function thermalTiles(layer: string, season: string, time: string): string {
  const host = typeof location === 'undefined' ? 'ventorelativo.it' : location.hostname;
  return `https://thermal.kk7.ch/tiles/${layer}_${season}_${time}/{z}/{x}/{y}.png?src=${host}`;
}

export const THERMAL_ATTRIBUTION =
  '<a href="https://thermal.kk7.ch">thermal.kk7.ch</a>';

/** kk7 numbers its tile rows from the south. */
export const THERMAL_MAXZOOM = 12;
