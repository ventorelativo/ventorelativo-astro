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
import { defineCollection, reference } from 'astro:content';
// Astro 6 deprecated `z` from 'astro:content' in favour of this path.
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Keystatic writes a conditional field as `{ discriminant, value }`; a file
 * written by hand says what it means — `event: { start, location }`. Both are
 * accepted, and both arrive at the schema below as the plain object.
 *
 * The alternative was to put Keystatic's wrapper in the content files, and
 * these files are read by people and by agents, not only by the CMS.
 */
function unwrapConditional(value: unknown): unknown {
  if (value && typeof value === 'object' && 'discriminant' in value) {
    const { discriminant, value: inner } = value as {
      discriminant: unknown;
      value?: unknown;
    };
    return discriminant ? inner : undefined;
  }
  return value;
}

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
      /**
       * Present when the post announces an event — a hike & fly, a competition
       * round — and absent when it is just news.
       *
       * On the post rather than in a collection of its own: the announcement
       * *is* the event here. A second collection would mean writing the thing
       * twice and keeping the two in step, which is how a date ends up right in
       * one place and wrong in the other.
       *
       * These fields are what make three things possible at once: an `.ics`
       * download, the `Event` node in the structured data (which src/lib/schema.ts
       * deliberately left out while the dates lived only in prose), and a
       * "prossimi eventi" list whenever one is wanted.
       */
      event: z.preprocess(
        unwrapConditional,
        z
          .object({
            /** Day of the event. Separate from `date`, which is publication. */
            start: z.coerce.date(),
            /** Only for events spanning days; omit for a single day. */
            end: z.coerce.date().optional(),
            /** Where you turn up: the takeoff. Free text — "Montoso (Bagnolo P.)". */
            location: z.string(),
            /**
             * The landing. Optional, and specific to this club rather than a
             * generic calendar field — for a hike & fly the two ends of the day
             * are the two things a pilot needs to know, and both posts that
             * announce events spelled them out by hand.
             */
            landing: z.string().optional(),
          })
          .optional(),
      ),
      /** From `!status`. Draft entries are excluded from the built site. */
      draft: z.boolean().default(false),
    }),
});

/**
 * Flight sites (Drupal `node:sito`).
 *
 * The map features each site references (`field_map_elements`, 34 of them
 * across the 14 sites) are Phase 4 — they need the WKT → GeoJSON migration and
 * the map component. A `mapFeatures` relationship joins this schema then.
 */
const sites = defineCollection({
  loader: glob({ base: './src/content/sites', pattern: '**/*.mdx' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /**
       * Required, per D7: the site specs stay as prose in the body, so this is
       * the only structured short description there is. It carries the card,
       * the meta description and — in Phase 4 — the map popup.
       */
      summary: z.string(),
      /**
       * From Drupal `sticky`. Sorts to the top of /siti.
       *
       * MIGRATION-PLAN.md §2.1 says "only Montoso"; the export has five —
       * Montoso, Monte Cucetto, Roletto, Sarsenà and Sea di Torre.
       */
      featured: z.boolean().default(false),
      /**
       * The map features that belong to this site — takeoffs, landings, the
       * obstacle, meeting points — in the order Drupal held them.
       *
       * `reference()` makes the build fail on a slug that does not exist, which
       * is the whole point of storing a relationship rather than free text: a
       * renamed feature cannot silently drop off a site's map.
       */
      mapFeatures: z.array(reference('mapFeatures')).default([]),
      /**
       * Site attributes, shown as plain pills — not links.
       *
       * D13 dropped site tagging on the grounds that "only 1 of 14 sites is
       * tagged at all". The export says otherwise: five are. Le Grange and
       * Montoso are "Adatto ai principianti"; Monte Cucetto, Monte Freidur and
       * Punta Ceresa are "Hike&Fly". Those describe the site and are worth
       * showing. What stays dropped is the shared vocabulary and the /tags/*
       * archive routes — this is a list of strings on the entry, nothing more.
       */
      tags: z.array(z.string()).default([]),
      /** `field_images`. Only Roletto (5) and Montoso (3) have any today. */
      images: z
        .array(
          z.object({
            src: image(),
            alt: z.string(),
          }),
        )
        .default([]),
    }),
});

/**
 * Fixed pages (`/voli`, `/iscrizioni`, `/contatti`).
 *
 * One entry per page rather than a collection of like things — Keystatic calls
 * these singletons, and in Phase 3 each becomes one. They are here so that the
 * blocks §2.4 said to lift out of `full_html` (pricing tiers, contact buttons,
 * bank details) are structured data now, editable later without a content
 * rewrite. The prose stays in the MDX body.
 *
 * The schema is a union of what those three pages need, with everything
 * page-specific optional; Keystatic will define the exact field set per
 * singleton anyway, and Zod is here to catch what it or a hand edit gets wrong.
 */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),

    /** /iscrizioni — the pricing cards (§2.4, §5). */
    tiers: z
      .array(
        z.object({
          name: z.string(),
          /** Euros. A number so a future Stripe integration can use it. */
          price: z.number(),
          benefits: z.array(z.string()),
          /** Satispay today, a Stripe Payment Link if D10 goes that way. */
          payUrl: z.url(), // z.string().url() is deprecated in Zod 4
          highlight: z.boolean().default(false),
        }),
      )
      .optional(),
    bankTransfer: z
      .object({
        holder: z.string(),
        iban: z.string(),
      })
      .optional(),

    /** /contatti — the phone / WhatsApp / email row (§2.4). */
    contacts: z
      .array(
        z.object({
          kind: z.enum(['phone', 'whatsapp', 'email']),
          label: z.string(),
          href: z.string(),
        }),
      )
      .optional(),
  }),
});

/**
 * Map features (Drupal `storage:map_feature`) — MIGRATION-PLAN.md §2.2.
 *
 * Drupal held one opaque geofield per feature: a WKT string that might be a
 * `POINT`, a `LINESTRING`, or a `GEOMETRYCOLLECTION` holding a point *and* a
 * polygon. Three pieces of PHP existed only to unpack it. Here the two
 * geometries are separate fields, because they feed completely different
 * things: the point becomes a map marker and a CUP waypoint, the shape becomes
 * a map fill and an OpenAir airspace block.
 *
 * **This data ends up in flight instruments.** The validation below is the
 * reason a malformed paste fails the build instead of quietly producing a
 * broken airspace file. Do not loosen it to make an entry go in.
 *
 * §2.2 said the point is "always present". It is not: the one obstacle is a
 * LINESTRING with no point component, which is exactly why it is absent from
 * the archived waypoint file. `point` is therefore optional, and the rules that
 * matter are enforced per type below.
 */
const coordinate = z.tuple([
  z.number().min(-180).max(180), // lon — WKT and GeoJSON are lon-first
  z.number().min(-90).max(90), // lat
]);

/** Parses the JSON coordinate list a text field holds, with a useful message. */
const coordinateList = z.string().transform((value, ctx) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'Coordinates must be JSON, e.g. [[7.33, 44.91], [7.34, 44.92], …]',
    });
    return z.NEVER;
  }
  const result = z.array(coordinate).min(2).safeParse(parsed);
  if (!result.success) {
    ctx.addIssue({
      code: 'custom',
      message: `Bad coordinates: ${result.error.message}`,
    });
    return z.NEVER;
  }
  return result.data;
});

const mapFeatures = defineCollection({
  loader: glob({ base: './src/content/map-features', pattern: '**/*.yaml' }),
  schema: z
    .object({
      name: z.string(),
      /**
       * Decides the marker, the CUP style and the OpenAir class. Derived from
       * Drupal's `field_type`; the four values are the ones in use.
       */
      type: z.enum(['takeoff', 'landing', 'obstacle', 'poi']),
      /** Marker and waypoint position. Absent only on the obstacle line. */
      point: z
        .object({
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
        })
        .optional(),
      /**
       * A landing's zone, or the obstacle's line.
       *
       * Not run through `unwrapConditional`: here the discriminant is data —
       * polygon or line — rather than the yes/no wrapper Keystatic puts around
       * an optional group, and Keystatic's serialisation of a select-discriminated
       * conditional is already this shape.
       */
      shape: z
        .discriminatedUnion('discriminant', [
          z.object({ discriminant: z.literal('polygon'), value: coordinateList }),
          z.object({ discriminant: z.literal('line'), value: coordinateList }),
        ])
        .optional(),
    })
    .superRefine((feature, ctx) => {
      /*
        A polygon ring must close — first point identical to last. OpenAir
        readers differ on what they do with an open ring, and "differ" is not a
        word that belongs near airspace data.
      */
      if (feature.shape?.discriminant === 'polygon') {
        const ring = feature.shape.value;
        const [first, last] = [ring[0], ring[ring.length - 1]];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ctx.addIssue({
            code: 'custom',
            path: ['shape'],
            message: `Polygon ring is not closed: starts ${first}, ends ${last}. Repeat the first point at the end.`,
          });
        }
        if (ring.length < 4) {
          ctx.addIssue({
            code: 'custom',
            path: ['shape'],
            message: 'A closed polygon needs at least four points.',
          });
        }
      }

      // A landing without a zone would silently vanish from the airspace file.
      if (feature.type === 'landing' && feature.shape?.discriminant !== 'polygon') {
        ctx.addIssue({
          code: 'custom',
          path: ['shape'],
          message: 'A landing needs a polygon: it is what becomes its airspace zone.',
        });
      }

      // Anything but the obstacle needs a point, or it drops off the map.
      if (feature.type !== 'obstacle' && !feature.point) {
        ctx.addIssue({
          code: 'custom',
          path: ['point'],
          message: `A ${feature.type} needs a point — it is its marker and its waypoint.`,
        });
      }
    }),
});

export const collections = { news, sites, pages, mapFeatures };
