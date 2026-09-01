// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

import sitemap from '@astrojs/sitemap';

/**
 * The canonical origin, used for sitemap URLs, canonical tags and OG images.
 *
 * The Drupal build never hardcoded a domain either — `netlify.toml` passed
 * Netlify's `$URL` to `drush tome:static -l $URL`. Same idea here, with the
 * refinement that deploy previews describe themselves rather than claiming to
 * be production.
 *
 * TODO(D9-followup): confirm the production hostname (apex vs www) and set
 * FALLBACK_SITE accordingly. Nothing in the Drupal repo records it.
 */
const FALLBACK_SITE = 'https://www.ventorelativo.it';

const site =
  process.env.CONTEXT === 'production'
    ? (process.env.URL ?? FALLBACK_SITE)
    : (process.env.DEPLOY_PRIME_URL ?? process.env.URL ?? FALLBACK_SITE);

/**
 * True during `astro build`, false under `astro dev`. Astro sets NODE_ENV for
 * the build; nothing else in this config depends on it.
 */
const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';

export default defineConfig({
  site,

  // Fully prerendered, and deliberately adapter-less for now.
  //
  // Adding `adapter: netlify()` flips the build to mode:"server" and emits a
  // ~3.6 MB SSR function even when every route is prerendered — dead weight
  // uploaded on every deploy. Nothing needs on-demand rendering until Keystatic
  // lands, so the adapter goes in at Phase 3 together with the two admin routes
  // that carry `export const prerender = false`.
  output: 'static',

  // `directory` emits /siti/montoso/index.html, matching the Tome export's URL
  // shape exactly. Do not change this — it is what preserves the live URLs.
  build: { format: 'directory' },

  /*
    Replaces the Drupal `quicklink` module (S12).

    `hover`, not `viewport`: /siti shows fourteen cards, and the viewport
    strategy fetched every one of those pages the moment the grid scrolled into
    view — 172 kB of speculative traffic, most of it never used, all of it paid
    for on someone's mobile data. `hover` (which is touchstart on a phone) still
    starts the fetch well before the navigation commits.
  */
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  // Dev-only. No effect on the production build.
  //
  // The floating dev toolbar sits over the bottom-centre of the page, which is
  // exactly where the hero CTAs are — distracting when reviewing on a phone.
  devToolbar: { enabled: false },

  // NOTE: redirects (S10, S11) live in netlify.toml, not here.
  //
  // Astro's `redirects` option only produces real 301s when a host adapter is
  // present to translate them. Adapter-less, it emits meta-refresh HTML pages
  // instead — a client-side hop that passes no ranking signal, which defeats
  // the point of redirecting /home to / for duplicate content. netlify.toml
  // gives a true edge 301 with no adapter and no function.
  // MDX for article and site bodies (MIGRATION-PLAN.md §2.1). Markdown alone
  // would do for prose, but the migrated bodies carry call-to-action buttons
  // and link cards that belong in components rather than in raw HTML (§2.4),
  // and Keystatic's content field writes .mdx.
  /*
    Keystatic is a development-time tool for now.

    It injects two server-rendered routes (`/keystatic/[...params]` and
    `/api/keystatic/[...params]`), and this site has no adapter, so including it
    in a production build would either fail or force `mode: "server"` and the
    3.6 MB function AGENTS.md rule 3 exists to avoid. In local storage mode the
    admin writes to the working copy anyway — it is only useful on a machine
    that has the repo checked out.

    Phase 3 flips storage to GitHub mode, adds the Netlify adapter and ships
    those two routes with `prerender = false`. Then this condition goes away.
  */
  integrations: [
    mdx(),
    /*
      S8. The Drupal `simple_sitemap` gave everything 0.5 and set one custom
      priority: `/` at 1.0. `/contatti` was listed as a custom link but also at
      0.5, so it needs nothing special here despite what the plan says.

      /styleguide is excluded: it is a development reference, deleted at the end
      of Phase 2, and has no business in search results meanwhile.
    */
    sitemap({
      filter: (page) => !page.includes('/styleguide'),
      serialize(item) {
        const path = new URL(item.url).pathname;
        item.priority = path === '/' ? 1.0 : 0.5;
        return item;
      },
    }),
    ...(IS_PRODUCTION_BUILD ? [] : [react(), keystatic()]),
  ],

  vite: {
    /*
      Bigger Picture is imported dynamically from a client script, which Vite
      does not discover when it scans for dependencies at startup. Without this
      the gallery works in a production build but silently does nothing in
      `astro dev` — the worst kind of difference between the two.
    */
    optimizeDeps: { include: ['bigger-picture'] },

    server: {
      // Vite rejects requests whose Host header it doesn't recognise (DNS
      // rebinding protection), which is what makes a tunnelled dev server
      // return "Blocked request". Allow ngrok's domains only — not `true`,
      // which would disable the check for every host.
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    },
  },
});
