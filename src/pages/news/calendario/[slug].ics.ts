/**
 * `/news/calendario/<slug>.ics`: the "add to calendar" download.
 *
 * One route per post that has event fields, generated at build like every other
 * page. Posts without them produce no route, so the button only exists where
 * there is something to add.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { toIcs } from '../../../lib/ics';

export const getStaticPaths: GetStaticPaths = async () => {
  const news = await getCollection('news', ({ data }) => !data.draft && data.event);
  return news.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
};

export const GET: APIRoute = ({ props, site }) => {
  const { entry } = props as { entry: CollectionEntry<'news'> };
  const { title, summary, event } = entry.data;
  if (!event) return new Response('Not found', { status: 404 });

  const origin = site ?? new URL('https://www.ventorelativo.it');
  const url = new URL(`/news/${entry.id}/`, origin).href;

  const ics = toIcs({
    uid: url,
    title,
    description: summary,
    /* Exactly what the volunteer typed: a calendar hands this to a geocoder,
       and anything appended to it makes the lookup worse, not better. */
    location: event.location,
    start: event.start,
    end: event.end,
    url,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${entry.id}.ics"`,
    },
  });
};
