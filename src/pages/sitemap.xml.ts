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
  '/redazione/', // the editors' AI kit, a tool for the club (also noindex)
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

  /*
    `lastmod` where there is a real date behind it, and nowhere else.

    The news posts have one: their own publication date, which for a post
    nobody has edited is also the day the page last changed. Nothing else on
    the site carries a date, and the tempting substitutes are both worse than
    saying nothing. The build time would stamp every URL as modified on every
    deploy, which is what Google means by an inaccurate `lastmod` and the
    reason it ignores the field on sites that do it; the file's git timestamp
    would be honest but is not reliably there, Netlify does not promise the
    history a `git log` needs. A partial `lastmod` is explicitly fine: the
    URLs without one are simply read without the hint.
  */
  const paths: { path: string; lastmod?: Date }[] = [
    { path: '/' },
    { path: '/siti/' },
    ...sites.map((entry) => ({ path: `/siti/${entry.id}/` })),
    { path: '/news/' },
    ...news.map((entry) => ({ path: `/news/${entry.id}/`, lastmod: entry.data.date })),
    { path: '/voli/' },
    { path: '/iscrizioni/' },
    { path: '/contatti/' },
    { path: '/privacy/' },
    { path: '/stampa/' },
  ];

  const urls = paths
    .map(({ path, lastmod }) => {
      const loc = new URL(path, origin).href;
      const priority = path === '/' ? '1.0' : '0.5';
      /* W3C Datetime, which is what the sitemap protocol asks for. */
      const modified = lastmod
        ? `\n    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`
        : '';
      return `  <url>\n    <loc>${loc}</loc>${modified}\n    <priority>${priority}</priority>\n  </url>`;
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
