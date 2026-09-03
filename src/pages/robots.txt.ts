/**
 * robots.txt, generated so the sitemap line carries the real origin.
 *
 * A file in public/ would have to hardcode a hostname; this route gets it from
 * `Astro.site`, which deploy previews set to their own URL (see astro.config).
 */
import type { APIRoute } from 'astro';

/**
 * The one hostname allowed into a search index.
 *
 * Everything else — the ventorelativo-astro.netlify.app staging deploy, and
 * every branch preview — is a byte-for-byte copy of a site that already ranks.
 * Left crawlable they would compete with it for its own queries, and an editor
 * checking a preview would be publishing to Google without meaning to.
 *
 * This turns itself off: when the domain moves to the new project at go-live,
 * the host matches and the file opens up. Nothing to remember to change.
 */
const INDEXABLE_HOST = 'ventorelativo.it';

export const GET: APIRoute = ({ site }) => {
  const indexable = site?.hostname === INDEXABLE_HOST;

  const body = indexable
    ? `User-agent: *
Allow: /
# The CMS. Nothing to index, and it should not be a search result.
Disallow: /keystatic
Disallow: /api/keystatic

Sitemap: ${new URL('sitemap.xml', site)}

# For language models: an index of the site's content, and the full text.
# ${new URL('llms.txt', site)}
# ${new URL('llms-full.txt', site)}
`
    : `# Anteprima — non indicizzare.
# This deploy is a copy of ${INDEXABLE_HOST}, not the site itself.
User-agent: *
Disallow: /
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
