/**
 * /llms.txt: an index of this site's content, for language models.
 *
 * The convention (llmstxt.org): one H1, a blockquote summary, then sections of
 * `- [Title](URL): description` lines, served as plain text.
 *
 * Worth being honest about what this buys: llms.txt is widely published and
 * rarely fetched: one 2026 crawl found it was 0.1% of AI bot requests. The
 * things that actually make this site legible to a machine are the schema.org
 * graph (src/lib/schema.ts) and plain semantic HTML. This costs a build-time
 * route and nothing at runtime, so it is worth having anyway; it is not worth
 * maintaining by hand, which is why it is generated.
 */
import type { APIRoute } from 'astro';
import { contentSections } from '../lib/llms';
import { SITE } from '../consts';

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://www.ventorelativo.it');
  const sections = await contentSections(origin);

  const body = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    `Sito del ${SITE.name} Parapendio Club, tra Pinerolo, Val Chisone e Val Pellice.`,
    'Contenuti in italiano. Il testo completo di ogni pagina è disponibile in',
    `${new URL('/llms-full.txt', origin).href}.`,
    '',
    ...sections.flatMap(({ heading, entries }) => [
      `## ${heading}`,
      '',
      ...entries.map(
        (entry) =>
          `- [${entry.title}](${entry.href})${entry.description ? `: ${entry.description}` : ''}`,
      ),
      '',
    ]),
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
