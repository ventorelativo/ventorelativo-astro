// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

import { loadEnv } from 'vite';

import netlify from '@astrojs/netlify';

/**
 * The canonical origin, used for sitemap URLs, canonical tags and OG images.
 *
 * The Drupal build never hardcoded a domain either, `netlify.toml` passed
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

/*
  Say so when the map is going to be built without a key.

  `mapConfig.ts` falls back to an empty string, which produces a style URL
  ending in `?key=`: a map that loads, draws nothing, and reports no error.
  That is precisely what was deployed: the built bundle on Netlify had the bare
  `?key=` while every local build had the key, and nothing anywhere said so.

  A warning rather than a failed build: a fork, or a contributor without the
  club's key, should still be able to build the site. It is loud enough to see
  in a Netlify deploy log, which is where it was needed.
*/
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), 'PUBLIC_');

for (const [name, effect] of [
  ['PUBLIC_MAPTILER_KEY', 'the maps will build, load, and draw nothing at all'],
  ['PUBLIC_TRACESTRACK_KEY', "the map's topographic base layer will stay blank"],
]) {
  if (!env[name]) {
    console.warn(
      `\n  ⚠ ${name} is not set: ${effect}.` +
        '\n    Set it in .env locally, or in Netlify for a deploy.\n',
    );
  }
}

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
    `imageCDN: false` is not a detail. The default is `true`, and it silently
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
      machine without Deno it does nothing but fail: an unhandled rejection on
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
  // shape exactly. Do not change this: it is what preserves the live URLs.
  build: { format: 'directory' },

  /*
    Replaces the Drupal `quicklink` module (S12).

    `hover`, not `viewport`: /siti shows fourteen cards, and the viewport
    strategy fetched every one of those pages the moment the grid scrolled into
    view: 172 kB of speculative traffic, most of it never used, all of it paid
    for on someone's mobile data. `hover` (which is touchstart on a phone) still
    starts the fetch well before the navigation commits.
  */
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  // Dev-only. No effect on the production build.
  //
  // The floating dev toolbar sits over the bottom-centre of the page, which is
  // exactly where the hero CTAs are, distracting when reviewing on a phone.
  devToolbar: { enabled: false },

  // NOTE: redirects (S10, S11) live in netlify.toml, not here.
  //
  // Astro's `redirects` option only produces real 301s when a host adapter is
  // present to translate them. Adapter-less, it emits meta-refresh HTML pages
  // instead: a client-side hop that passes no ranking signal, which defeats
  // the point of redirecting /home to / for duplicate content. netlify.toml
  // gives a true edge 301 with no adapter and no function.
  // MDX for article and site bodies (MIGRATION-PLAN.md §2.1). Markdown alone
  // would do for prose, but the migrated bodies carry call-to-action buttons
  // and link cards that belong in components rather than in raw HTML (§2.4),
  // and Keystatic's content field writes .mdx.
  integrations: [
    mdx(),
    /*
      The CMS, now part of the deployed site.

      The integration injects `/keystatic/[...params]` and
      `/api/keystatic/[...params]`, both already marked `prerender: false`, so
      they are the only two things in the serverless function. React is here
      solely because Keystatic's admin UI is a React app: no page of the site
      ships any of it.
    */
    react(),
    keystatic(),
  ],

  vite: {
    /*
      Both of these are imported dynamically from a client script, which Vite
      does not discover when it scans for dependencies at startup. Without this
      they work in a production build and silently do nothing in `astro dev`:
      the worst kind of difference between the two, and the one most likely to
      be mistaken for broken code, because the dev server is where the site
      gets looked at.
    */
    optimizeDeps: { include: ['bigger-picture', 'maplibre-gl'] },

    build: {
      rollupOptions: {
        /*
          MapLibre's shared module, downloaded once instead of twice.

          The library is two files: `maplibre-gl.mjs`, which imports
          `maplibre-gl-shared.mjs`: the tile parsers, the style spec, the
          geometry, and the worker, which imports the same shared file.
          `scripts/sync-vendor.mjs` already copies the worker and that sibling
          into `public/vendor/`, because a bundler cannot see through the way
          MapLibre locates its worker (see AGENTS.md).

          Left alone, the bundler inlines the shared module into the main chunk
          as well, so opening a map fetched all of it twice: 204 kB brotli in
          the page's chunk and another 109 kB for the worker. Marking it
          external and pointing the main chunk at the same `/vendor/` URL the
          worker uses means one file, one download, two module instances,
          which is all the two threads ever needed. 326 kB brotli down to 239.

          `/vendor/*` is served `must-revalidate`, and that is what keeps this
          honest: `sync-vendor` re-copies from `node_modules` on every build,
          so a MapLibre upgrade replaces the file and every client picks it up.
          Do not give these files an immutable cache header.

          If this ever goes wrong the symptom is the one in AGENTS.md: raster
          terrain draws and every label, road and marker is missing. Check it
          the way it was checked here: `npm run shot -- <a site page> --webgl`
          with the map opened.
        */
        external: [/maplibre-gl-shared/],
        output: {
          paths: (id) =>
            id.includes('maplibre-gl-shared') ? '/vendor/maplibre-gl-shared.mjs' : id,
        },
      },

      /*
        Two chunks are over Vite's 500 kB default, and both are meant to be:
        Keystatic's admin UI (~2.6 MB, fetched only at /keystatic, by an
        editor) and MapLibre (~970 kB, fetched only when somebody opens a map).
        Neither is on the path of a visitor reading a page.

        The warning cannot tell an eager chunk from a lazy one, so on this site
        it fires every build and says nothing. What actually guards the budget
        is `npm run weight`, which measures the bytes a real viewport fetches:
        see docs/performance.md. The limit is set just above Keystatic so a
        genuinely new large chunk would still be reported.
      */
      chunkSizeWarningLimit: 2800,
    },

    server: {
      // Vite rejects requests whose Host header it doesn't recognise (DNS
      // rebinding protection), which is what makes a tunnelled dev server
      // return "Blocked request". Allow ngrok's domains only, not `true`,
      // which would disable the check for every host.
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    },
  },
});
