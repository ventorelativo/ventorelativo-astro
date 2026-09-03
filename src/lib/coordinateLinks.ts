/**
 * Where a coordinate can take you.
 *
 * Both links are the ones the old site's map popups offered, kept because
 * pilots have been using them: one opens directions in whatever maps app the
 * device prefers, the other opens the flight forecast for that exact point.
 *
 * Coordinates stay in decimal degrees throughout: it is what both services
 * expect, and what a pilot can paste into an instrument without converting.
 */
import type { LatLon } from './geo';

/** Six decimals is about a tenth of a metre; more would be noise. */
export function formatCoordinates({ lat, lon }: LatLon): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/**
 * Google Maps directions to the point.
 *
 * `dir/?api=1&destination=` rather than a map centre, because arriving is the
 * question being asked, of a takeoff especially, which is usually up a track
 * with no address.
 */
export function navigationUrl({ lat, lon }: LatLon): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/** Meteo-Parapente, at the zoom the old site used. */
export function forecastUrl({ lat, lon }: LatLon): string {
  return `https://meteo-parapente.com/#/${lat},${lon},13`;
}
