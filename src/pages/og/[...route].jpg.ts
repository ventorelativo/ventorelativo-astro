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
function assetPath(
  image: { src: ImageMetadata | undefined } | undefined,
): string | undefined {
  if (!image?.src) return undefined;
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
    /*
      `news` is listed by hand because it is an index with no entry in `pages`.
      `home` and `siti` are not: both *are* pages, and listing them here as
      well produced two paths for `/og/home.jpg`. Astro kept the first and
      warned about the second on every build — the card was right, the route
      table was not.
    */
    {
      params: { route: 'news' },
      props: { title: 'News', kind: SITE.name } satisfies CardOptions,
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
      props: {
        /*
          Every other card is `<section> / <page title>`. The homepage has no
          section, so it is `<what we are> / <who we are>` — the descriptor
          small, the name in the big type. The other way round, which is what
          this was, printed "Parapendio Club" larger than the club.

          It also carries the page's own hero photograph, washed into the brand
          blue: the homepage is the link that gets shared, and the valley it
          shows is the answer to "where is this club". Only this page — the
          other fixed pages have no picture that is about them.
        */
        title: entry.id === 'home' ? SITE.name : entry.data.title,
        kind: entry.id === 'home' ? SITE.slogan : SITE.name,
        backgroundPath:
          entry.id === 'home' ? assetPath({ src: entry.data.hero?.src }) : undefined,
        washed: entry.id === 'home',
        /* Its title is the club's name, and the name is set uppercase. */
        wordmark: entry.id === 'home',
      } satisfies CardOptions,
    })),
  ];
};

export const GET: APIRoute = async ({ props }) => {
  const image = await renderCard(props as CardOptions);
  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/jpeg' },
  });
};
