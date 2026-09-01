/**
 * Social cards, one per page (S3).
 *
 * A static endpoint rather than a script: `getStaticPaths` reads the same
 * collections the pages do, so a new article gets a card by existing, with no
 * separate command to remember. Astro writes each one to `/og/<route>.jpg` at
 * build time; nothing renders on demand.
 *
 * The expensive part is cached by content hash — see src/lib/og.ts.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderCard, type CardOptions } from '../../lib/og';
import { SITE } from '../../consts';

/** Where a collection entry's own photograph lives on disk, if it has one. */
function assetPath(image: { src: ImageMetadata } | undefined): string | undefined {
  if (!image) return undefined;
  // ImageMetadata.src is the resolved URL; fsPath is the file it came from.
  const path = (image.src as ImageMetadata & { fsPath?: string }).fsPath;
  return path;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const [news, sites, pages] = await Promise.all([
    getCollection('news', ({ data }) => !data.draft),
    getCollection('sites'),
    getCollection('pages'),
  ]);

  return [
    {
      params: { route: 'home' },
      props: { title: SITE.slogan, kind: SITE.name } satisfies CardOptions,
    },
    {
      params: { route: 'news' },
      props: { title: 'News', kind: SITE.name } satisfies CardOptions,
    },
    {
      params: { route: 'siti' },
      props: { title: 'Siti di volo', kind: SITE.name } satisfies CardOptions,
    },
    ...news.map((entry) => ({
      params: { route: `news/${entry.id}` },
      props: {
        title: entry.data.title,
        kind: 'News',
        backgroundPath: assetPath(entry.data.image),
      } satisfies CardOptions,
    })),
    ...sites.map((entry) => ({
      params: { route: `siti/${entry.id}` },
      props: {
        title: entry.data.title,
        kind: 'Sito di volo',
        backgroundPath: assetPath(entry.data.images[0]),
      } satisfies CardOptions,
    })),
    ...pages.map((entry) => ({
      params: { route: entry.id },
      props: { title: entry.data.title, kind: SITE.name } satisfies CardOptions,
    })),
  ];
};

export const GET: APIRoute = async ({ props }) => {
  const image = await renderCard(props as CardOptions);
  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/jpeg' },
  });
};
