// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';

/**
 * The canonical origin, used for sitemap URLs, canonical tags and OG images.
 *
 * The Drupal build never hardcoded a domain either — `netlify.toml` passed
 * Netlify's `$URL` to `drush tome:static -l $URL`. Same idea here, with the
 * refinement that deploy previews describe themselves rather than claiming to
 * be production.
 *
 * The apex, not www: the live Netlify project serves ventorelativo.it as its
 * primary URL and redirects www to it. Nothing in the Drupal repo records the
 * choice, which is why it had to be read off the host.
 */
const FALLBACK_SITE = 'https://ventorelativo.it';

const site =
  process.env.CONTEXT === 'production'
    ? (process.env.URL ?? FALLBACK_SITE)
    : (process.env.DEPLOY_PRIME_URL ?? process.env.URL ?? FALLBACK_SITE);

export default defineConfig({
  site,

  /*
    Still `static`: with an adapter present this means "prerender everything
    unless a route opts out", not "prerender nothing". Every content page is
    written as HTML at build time exactly as before, and the only routes that
    reach the serverless function are Keystatic's two, which set
    `prerender: false` themselves.

    The adapter is what turns netlify.toml's job of serving files into a build
    that can also run those two routes. It was kept out until now (AGENTS.md
    rule 3) because with nothing to render on demand it uploaded a multi-megabyte
    function that answered no requests.
  */
  output: 'static',

  /*
    `imageCDN: false` is not a detail — the default is `true`, and it silently
    replaces `astro:assets` with Netlify's Image CDN. Every `<Image>` and
    `<Picture>` then emits `/.netlify/images?url=…&w=800` instead of a
    fingerprinted `_astro/*.avif` written at build time.

    That undoes what this site is built on: images optimised once during the
    build, served as immutable files a CDN can hold forever (netlify.toml caches
    /_astro/* for a year), with no per-request work and nothing to meter. The CDN
    version resizes on first request instead, which is a cold transform in front
    of the LCP image, and it is a billed resource.

    Verified by grepping the built HTML: with this false, dist/index.html
    references _astro/*.avif; with it true, sixteen /.netlify/images URLs and no
    optimised file at all.
  */
  adapter: netlify({
    imageCDN: false,

    /*
      Netlify's dev-time emulation, all of it off.

      `edgeFunctions` spawns a Deno server to emulate `netlify/edge-functions/`.
      There is no such directory here and no middleware to put in one, so on a
      machine without Deno it does nothing but fail — an unhandled rejection on
      every `astro dev` start, from a feature the site does not use.

      `images` would route images through the Netlify Image CDN in dev while the
      build uses the local pipeline, which is the dev/production divergence
      `imageCDN: false` exists to avoid. `environmentVariables` reads from a
      linked Netlify site; this repo is not linked and its .env is local.
    */
    devFeatures: {
      edgeFunctions: false,
      images: false,
      environmentVariables: false,
    },
  }),

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
  integrations: [
    mdx(),
    /*
      S8. The Drupal `simple_sitemap` gave everything 0.5 and set one custom
      priority: `/` at 1.0. `/contatti` was listed as a custom link but also at
      0.5, so it needs nothing special here despite what the plan says.

      /styleguide is excluded: it is a development reference, deleted at the end
      of Phase 2, and has no business in search results meanwhile.

      The two post-action pages are excluded for a different reason: they carry
      `noindex` (see BaseLayout), and a page that is in the sitemap while asking
      not to be indexed is a contradiction Google resolves in its own favour.
      Both lists have to agree.
    */
    sitemap({
      filter: (page) =>
        !['/styleguide', '/contatti/messaggio-inviato', '/iscrizioni/grazie'].some(
          (excluded) => page.includes(excluded),
        ),
      serialize(item) {
        const path = new URL(item.url).pathname;
        item.priority = path === '/' ? 1.0 : 0.5;
        return item;
      },
    }),
    /*
      The CMS, now part of the deployed site.

      The integration injects `/keystatic/[...params]` and
      `/api/keystatic/[...params]`, both already marked `prerender: false`, so
      they are the only two things in the serverless function. React is here
      solely because Keystatic's admin UI is a React app — no page of the site
      ships any of it.
    */
    react(),
    keystatic(),
  ],

  vite: {
    /*
      Both of these are imported dynamically from a client script, which Vite
      does not discover when it scans for dependencies at startup. Without this
      they work in a production build and silently do nothing in `astro dev` —
      the worst kind of difference between the two, and the one most likely to
      be mistaken for broken code, because the dev server is where the site
      gets looked at.
    */
    optimizeDeps: { include: ['bigger-picture', 'maplibre-gl'] },

    server: {
      // Vite rejects requests whose Host header it doesn't recognise (DNS
      // rebinding protection), which is what makes a tunnelled dev server
      // return "Blocked request". Allow ngrok's domains only — not `true`,
      // which would disable the check for every host.
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    },
  },
});
