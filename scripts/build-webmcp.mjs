/**
 * Compiles `src/lib/webmcp.ts` to `public/vendor/webmcp.js`.
 *
 * Why not let Vite bundle it like every other client script: because then the
 * page has to reach it through a hashed URL, which only a bundled module can
 * resolve, which means shipping a module to every visitor for an API almost
 * none of their browsers has. Measured, that came to 1.5 kB and two extra
 * requests per page: one for the three-line guard, one for Vite's preload
 * helper, or 1.44 kB inlined into every page. Either way, everyone pays for
 * a feature almost nobody can use yet, which is the objection that kept WebMCP
 * out of the build until now (MIGRATION-PLAN.md §7 item 3).
 *
 * A file in `public/` has a stable URL, so the guard can be three inline lines
 * naming it, and nothing is fetched unless `modelContext` exists. Same trick,
 * and same reasoning, as the MapLibre files next to it: see sync-vendor.mjs.
 *
 * `tsc` rather than a bundler because the module imports nothing: there is
 * nothing to bundle, only types to strip. TypeScript is already a dependency.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('public/vendor', { recursive: true });

execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    'src/lib/webmcp.ts',
    '--outDir',
    'public/vendor',
    '--target',
    'es2022',
    '--module',
    'es2022',
    '--moduleResolution',
    'bundler',
    '--strict',
    '--removeComments',
    /* tsc refuses to mix a named file with the project's tsconfig. */
    '--ignoreConfig',
  ],
  { stdio: 'inherit' },
);
