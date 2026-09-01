// @ts-check
import { defineConfig } from 'astro/config';

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

  // Replaces the Drupal `quicklink` module (S12).
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },

  // Dev-only. No effect on the production build.
  //
  // The floating dev toolbar sits over the bottom-centre of the page, which is
  // exactly where the hero CTAs are — distracting when reviewing on a phone.
  devToolbar: { enabled: false },

  vite: {
    server: {
      // Vite rejects requests whose Host header it doesn't recognise (DNS
      // rebinding protection), which is what makes a tunnelled dev server
      // return "Blocked request". Allow ngrok's domains only — not `true`,
      // which would disable the check for every host.
      allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    },
  },

  // NOTE: redirects (S10, S11) live in netlify.toml, not here.
  //
  // Astro's `redirects` option only produces real 301s when a host adapter is
  // present to translate them. Adapter-less, it emits meta-refresh HTML pages
  // instead — a client-side hop that passes no ranking signal, which defeats
  // the point of redirecting /home to / for duplicate content. netlify.toml
  // gives a true edge 301 with no adapter and no function.
});
