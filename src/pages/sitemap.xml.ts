/**
 * /sitemap.xml: every page, in one file.
 *
 * Written by hand rather than by `@astrojs/sitemap`, which always emits a
 * `sitemap-index.xml` pointing at a `sitemap-0.xml`. That shape exists for
 * sites with more URLs than fit in one file; this one has twenty-six, and the
 * index cost a redirect and two extra fetches for a crawler to reach the list.
 *
 * The old Drupal `simple_sitemap` gave everything 0.5 and the front page 1.0
 * (S8), which is reproduced below. Priority is a hint search engines have said
 * for years they largely ignore; it is kept because changing it would be a
 * change with no reason behind it.
 *
 * Pages that are deliberately absent are listed in EXCLUDED, and
 * `scripts/check-sitemap.mjs` fails the build if a built page is in neither
 * this file nor that list: the failure mode of a hand-written sitemap is a
 * page nobody notices is missing.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

/** Not in the sitemap, and why. Must match `scripts/check-sitemap.mjs`. */
export const EXCLUDED = [
  '/404', // an error page, not a destination
  '/styleguide/', // a design reference, not a page of the site (also noindex)
  '/contatti/messaggio-inviato/', // post-action page, noindex
  '/iscrizioni/grazie/', // post-action page, noindex
  '/keystatic', // the CMS
];

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://www.ventorelativo.it');

  const [sites, news] = await Promise.all([
    getCollection('sites'),
    getCollection('news', ({ data }) => !data.draft),
  ]);

  const paths = [
    '/',
    '/siti/',
    ...sites.map((entry) => `/siti/${entry.id}/`),
    '/news/',
    ...news.map((entry) => `/news/${entry.id}/`),
    '/voli/',
    '/iscrizioni/',
    '/contatti/',
    '/privacy/',
    '/stampa/',
  ];

  const urls = paths
    .map((path) => {
      const loc = new URL(path, origin).href;
      const priority = path === '/' ? '1.0' : '0.5';
      return `  <url>\n    <loc>${loc}</loc>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
