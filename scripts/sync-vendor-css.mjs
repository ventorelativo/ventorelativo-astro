/**
 * Copies third-party CSS into `public/` so it can be linked at runtime.
 *
 * There are three ways to get MapLibre's stylesheet onto the page and two of
 * them are wrong here:
 *
 *  - **Import it in a client script**, next to the dynamic `import()` of the
 *    library. This is the documented trap: Astro inlines a small stylesheet
 *    into the HTML while Vite still preloads the file it never wrote, the
 *    import rejects on a 404, and the whole feature dies with it.
 *  - **Import it in component frontmatter.** Works, but bundles 8 kB of
 *    brotli'd map CSS into every one of the fourteen site pages — paid by
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

const FILES = [{ from: 'maplibre-gl/dist/maplibre-gl.css', to: 'maplibre-gl.css' }];

mkdirSync('public/vendor', { recursive: true });

for (const { from, to } of FILES) {
  copyFileSync(require.resolve(from), `public/vendor/${to}`);
  console.log(`vendor css: ${to}`);
}
