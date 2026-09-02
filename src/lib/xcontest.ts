/**
 * XContest flight-search URLs (MIGRATION-PLAN.md §4.4).
 *
 * All searches are scoped to the club's centre point and radius, exactly as the
 * Drupal `scraper` block built them — same filters, same ordering, so the
 * results a pilot sees are the results they saw before.
 */
import { CLUB_CENTRE } from '../consts';

const BASE = 'https://www.xcontest.org/world/en/flights-search/';

/** Which flights: launches near the club, by distance, paragliders (FAI3). */
const SCOPE = {
  'filter[point]': `${CLUB_CENTRE.lon} ${CLUB_CENTRE.lat}`,
  'filter[radius]': String(CLUB_CENTRE.radius),
  'filter[mode]': 'START',
  'filter[date_mode]': 'dmy',
  'filter[value_mode]': 'dst',
  'filter[catg]': 'FAI3',
} as const;

export interface SearchOptions {
  /** `time_start` for most-recent, `pts` for best-scoring. */
  sort: 'time_start' | 'pts';
  /** `YYYY-MM-DD`, `YYYY-MM` or `YYYY`. Omitted means all time. */
  date?: string;
}

export function searchUrl({ sort, date }: SearchOptions): string {
  const params = new URLSearchParams({ ...SCOPE, 'list[sort]': sort });
  if (date) params.set('filter[date]', date);
  if (sort === 'pts') params.set('list[dir]', 'down');
  return `${BASE}?${params}`;
}

/** Today, this month and this year, as XContest's `filter[date]` wants them. */
export function datesFrom(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = String(now.getFullYear());
  const month = `${year}-${pad(now.getMonth() + 1)}`;
  return { day: `${month}-${pad(now.getDate())}`, month, year };
}

/**
 * Flights launched from one takeoff, best-scoring first.
 *
 * A different search from the club-wide ones above: no category or mode
 * filters, a 1 km radius instead of the club's 20 km, and the takeoff's own
 * coordinates as the centre. That is exactly the URL the Drupal site put on
 * each site page, and narrowing it further would hide the flights a pilot
 * comes here to see.
 */
export function takeoffSearchUrl({ lat, lon }: { lat: number; lon: number }): string {
  const params = new URLSearchParams({
    'list[sort]': 'pts',
    'filter[point]': `${lon} ${lat}`,
    'filter[radius]': '1000',
  });
  return `${BASE}?${params}`;
}
