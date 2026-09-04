/**
 * /redazione/contenuti.json: the site's content model, for a machine.
 *
 * The same tables `/redazione/istruzioni.txt` shows a person, as data: every
 * page and the entry that controls it, what cannot be changed from the CMS, and
 * the fields of each content type with their Italian labels.
 *
 * It is generated from the markdown, not written beside it. A hand-kept copy
 * would be a fifth description of the same fields and the first to go stale,
 * because nothing renders it and nobody would notice.
 *
 * What it is not: the authoritative text. The writing rules, the tone and the
 * things a model must never invent are prose, and prose is what makes them
 * followed. This is the index; `istruzioni.txt` is the instruction.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { contentModel } from '../../lib/authoring';

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://www.ventorelativo.it');
  const sites = (await getCollection('sites')).map((entry) => ({
    id: entry.id,
    title: entry.data.title,
  }));

  return new Response(`${JSON.stringify(contentModel(origin, sites), null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
