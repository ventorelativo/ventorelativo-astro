/**
 * /llms-full.txt: every page's text in one file.
 *
 * The companion to /llms.txt: that one is the index, this is the library. The
 * bodies are the MDX exactly as written, which is already Markdown apart from
 * the odd component block, so a model reads it without a parser and without
 * the site's chrome, navigation or styling in the way.
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
    ...sections.flatMap(({ heading, entries }) => [
      `# ${heading}`,
      '',
      ...entries.flatMap((entry) => [
        `## ${entry.title}`,
        '',
        `URL: ${entry.href}`,
        entry.description ? `${entry.description}` : '',
        '',
        entry.body.trim(),
        '',
        '---',
        '',
      ]),
    ]),
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
