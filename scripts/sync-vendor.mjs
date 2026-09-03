/**
 * Copies third-party files into `public/` so they can be fetched at runtime.
 *
 * There are three ways to get MapLibre's stylesheet onto the page and two of
 * them are wrong here:
 *
 *  - **Import it in a client script**, next to the dynamic `import()` of the
 *    library. This is the documented trap: Astro inlines a small stylesheet
 *    into the HTML while Vite still preloads the file it never wrote, the
 *    import rejects on a 404, and the whole feature dies with it.
 *  - **Import it in component frontmatter.** Works, but bundles 8 kB of
 *    brotli'd map CSS into every one of the fourteen site pages: paid by
 *    everyone, used by the few who open a map.
 *  - **Copy it to `public/` and inject a `<link>` when the map opens.** Files
 *    in `public/` are served verbatim: no hashing, no inlining, no Vite. The
 *    URL is stable, so it can be written by hand, and nobody who does not open
 *    a map ever requests it.
 *
 * Copied rather than committed so it cannot drift from the installed version.
 * Runs before `dev` and `build`; `public/vendor/` is git-ignored.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/*
  The worker is here for a different reason than the stylesheet, and a sharper
  one: without it the map renders **nothing vector at all**.

  MapLibre finds its tile-parsing worker by building a URL beside its own
  module: `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Bundlers
  cannot see through that, so Vite hashes the main chunk to
  `maplibre-gl.<hash>.js` and never emits a worker next to it. The request
  404s, and because only *vector* tiles are parsed in the worker, the failure
  is beautifully misleading: the raster hillshade draws perfectly and every
  road, label, contour and marker is missing.

  Copying it to a fixed path and calling `setWorkerUrl` is the supported way
  out. It must keep its `.mjs` extension: it is loaded as a module worker, and
  a server that returns the wrong MIME type for it fails the same way.
*/
const FILES = [
  { from: 'maplibre-gl/dist/maplibre-gl.css', to: 'maplibre-gl.css' },
  { from: 'maplibre-gl/dist/maplibre-gl-worker.mjs', to: 'maplibre-gl-worker.mjs' },
  /*
    The worker's own import, and the reason copying the worker alone was not
    enough: it starts `import ... from "./maplibre-gl-shared.mjs"`, so a
    missing sibling kills the worker exactly as a missing worker does, with
    exactly the same symptom.
  */
  { from: 'maplibre-gl/dist/maplibre-gl-shared.mjs', to: 'maplibre-gl-shared.mjs' },
];

mkdirSync('public/vendor', { recursive: true });

for (const { from, to } of FILES) {
  copyFileSync(require.resolve(from), `public/vendor/${to}`);
  console.log(`vendor: ${to}`);
}
