/**
 * /api/siti.json — the flight sites as data.
 *
 * Written for machines: the WebMCP tools in `src/lib/webmcp.ts` answer from
 * this, and anything else that wants the club's sites without parsing pages
 * can have it too. It is the same content the pages render, so there is
 * nothing here a visitor could not already read.
 *
 * Deliberately not `/api/sites/all/geo.json`, which the old site served and
 * D5 dropped: that was GeoJSON shaped for a Leaflet layer, and this is a list
 * of places with their takeoffs. Reviving the old URL would have promised the
 * old shape.
 *
 * Altitude and exposure are *not* separate fields. They live inside `summary`,
 * written by the club as "1581m/1276m, SE, Bagnolo Piemonte (CN)", and the
 * club has never recorded them as data. Splitting them here would mean parsing
 * prose and publishing the guess as fact — the same reason `placeNode` in
 * src/lib/schema.ts emits no `elevation`.
 */
import type { APIRoute } from 'astro';
import { getCollection, getEntries } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://www.ventorelativo.it');
  const sites = await getCollection('sites');

  const data = await Promise.all(
    sites
      .sort((a, b) => a.data.title.localeCompare(b.data.title, 'it'))
      .map(async (entry) => {
        const features = (await getEntries(entry.data.mapFeatures)).map((f) => f.data);
        const points = (type: string) =>
          features
            .filter((feature) => feature.type === type && feature.point)
            .map((feature) => ({
              name: feature.name,
              lat: feature.point!.lat,
              lon: feature.point!.lon,
            }));

        return {
          slug: entry.id,
          name: entry.data.title,
          /** Altitude, exposure and comune, as the club writes them. */
          summary: entry.data.summary,
          url: new URL(`/siti/${entry.id}/`, origin).href,
          tags: entry.data.tags,
          takeoffs: points('takeoff'),
          landings: points('landing'),
          guideUrl: entry.data.guideUrl ?? null,
        };
      }),
  );

  return new Response(JSON.stringify({ sites: data }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* Same as the pages: revalidate, so an edit is live at once. */
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
