/**
 * The site's content, gathered for the llms.txt routes.
 *
 * Shared by `/llms.txt` (an index of links) and `/llms-full.txt` (the same
 * content in full), so the two cannot list different things.
 */
import { getCollection } from 'astro:content';

export interface Entry {
  title: string;
  /** Absolute URL of the page this describes. */
  href: string;
  description: string;
  /** The raw MDX body, for the full export. */
  body: string;
}

export interface Section {
  heading: string;
  entries: Entry[];
}

export async function contentSections(site: URL): Promise<Section[]> {
  const [news, sites, pages] = await Promise.all([
    getCollection('news', ({ data }) => !data.draft),
    getCollection('sites'),
    getCollection('pages'),
  ]);

  const url = (path: string) => new URL(path, site).href;

  return [
    {
      heading: 'Siti di volo',
      entries: sites
        .sort((a, b) => a.data.title.localeCompare(b.data.title, 'it'))
        .map((entry) => ({
          title: entry.data.title,
          href: url(`/siti/${entry.id}/`),
          // The tags are real site attributes — "Adatto ai principianti",
          // "Hike&Fly" — and are exactly the kind of thing a question is
          // asked about, so they go in the one-line description.
          description: [entry.data.summary, ...entry.data.tags].join(', '),
          body: entry.body ?? '',
        })),
    },
    {
      heading: 'News',
      entries: news
        .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
        .map((entry) => ({
          title: entry.data.title,
          href: url(`/news/${entry.id}/`),
          description: `${entry.data.date.toISOString().slice(0, 10)}: ${entry.data.summary}`,
          body: entry.body ?? '',
        })),
    },
    {
      heading: 'Pagine',
      entries: pages.map((entry) => ({
        title: entry.data.title,
        href: url(`/${entry.id}/`),
        description: entry.data.description ?? '',
        body: entry.body ?? '',
      })),
    },
  ];
}
