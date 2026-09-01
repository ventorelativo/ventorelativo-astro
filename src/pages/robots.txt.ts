/**
 * robots.txt, generated so the sitemap line carries the real origin.
 *
 * A file in public/ would have to hardcode a hostname; this route gets it from
 * `Astro.site`, which deploy previews set to their own URL (see astro.config).
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *
Allow: /
# The CMS. Nothing to index, and it should not be a search result (Phase 3).
Disallow: /keystatic
Disallow: /api/keystatic

Sitemap: ${new URL('sitemap-index.xml', site)}
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
