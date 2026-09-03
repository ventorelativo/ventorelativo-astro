/**
 * /redazione/istruzioni.txt: the authoring contract as plain text.
 *
 * A stable address a prompt can name, so a volunteer can write "leggi questa
 * pagina" instead of pasting three hundred lines. Two caveats, both honest:
 * `robots.txt` disallows every host that is not the live domain, so this route
 * only becomes reachable to an assistant at the cutover; and a free tier
 * usually cannot browse at all. `/redazione` therefore leads with the copy
 * button and this is the shortcut, not the mechanism.
 *
 * Markdown served as `text/plain`, like `/llms.txt` beside it: the audience is
 * a model, which reads Markdown perfectly well and does not want a stylesheet.
 */
import type { APIRoute } from 'astro';
import { instructions } from '../../lib/authoring';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://www.ventorelativo.it');

  return new Response(instructions(origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
