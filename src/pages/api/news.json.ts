/**
 * /api/news.json: the club's posts as data, events first.
 *
 * The companion to `siti.json`, and the reason it earns its place: a post with
 * `event` fields has a real date, a takeoff and a landing, which is a question
 * an assistant can actually answer: "is anything on at Montoso this month".
 * A post without them is an article, and says so.
 *
 * Only what the pages already show. The body text is not here: `/llms-full.txt`
 * carries that, and duplicating it would give two sources for one thing.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://www.ventorelativo.it');
  const posts = await getCollection('news', ({ data }) => !data.draft);

  const day = (date: Date) => date.toISOString().slice(0, 10);

  const data = posts
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .map((entry) => ({
      slug: entry.id,
      title: entry.data.title,
      summary: entry.data.summary,
      url: new URL(`/news/${entry.id}/`, origin).href,
      category: entry.data.category,
      published: day(entry.data.date),
      /* `null`, not omitted: "this is an article" is an answer. */
      event: entry.data.event
        ? {
            start: day(entry.data.event.start),
            end: entry.data.event.end ? day(entry.data.event.end) : null,
            takeoff: entry.data.event.location,
            landing: entry.data.event.landing ?? null,
            calendar: new URL(`/news/calendario/${entry.id}.ics`, origin).href,
          }
        : null,
    }));

  return new Response(JSON.stringify({ posts: data }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
