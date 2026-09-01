/**
 * Content collections (MIGRATION-PLAN.md §2.1).
 *
 * Astro's Content Layer: a `loader` says where entries come from, a `schema`
 * says what shape they must have. The schema is enforced at build time, so a
 * malformed entry fails the build rather than rendering a broken page — which
 * is the whole point when the people editing are volunteers, not developers.
 *
 * In Phase 3 Keystatic writes these same files through a web UI. Its field
 * definitions in `keystatic.config.ts` and the Zod schemas here describe the
 * same data and must be kept in step by hand; Zod is the backstop that catches
 * anything Keystatic (or a hand edit) gets wrong.
 */
import { defineCollection } from 'astro:content';
// Astro 6 deprecated `z` from 'astro:content' in favour of this path.
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * News (Drupal `node:article`).
 *
 * `image` uses the `image()` helper rather than a plain string: it resolves the
 * path relative to the entry file and hands the page an image *object* that
 * `<Image>` can process — dimensions, avif/webp variants, content hash. A
 * string would only give us a URL, and with it layout shift and full-size JPEGs.
 */
const news = defineCollection({
  loader: glob({ base: './src/content/news', pattern: '**/*.mdx' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /**
       * From Drupal `created`. Drives ordering and the visible date.
       * `coerce` because YAML hands us a Date for a bare 2024-09-24 but a
       * string once it is quoted — which is how Keystatic will write it.
       */
      date: z.coerce.date(),
      /**
       * Load-bearing (D7): the card blurb *and* the meta description. Required
       * so a new post cannot quietly ship without one.
       */
      summary: z.string(),
      image: z
        .object({
          src: image(),
          alt: z.string(),
        })
        .optional(),
      /**
       * D13: the Drupal `tags` vocabulary was doing two unrelated jobs, so the
       * shared taxonomy and its archive routes are gone. What remains is a
       * single news category, rendered as a badge — which is what these terms
       * were actually for.
       */
      category: z.enum(['Eventi', 'Competizioni', 'Hike&Fly']),
      /** From `!status`. Draft entries are excluded from the built site. */
      draft: z.boolean().default(false),
    }),
});

export const collections = { news };
