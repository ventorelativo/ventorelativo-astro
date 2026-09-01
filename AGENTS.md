# AGENTS.md

Instructions for AI coding agents working on this repository. This is the
canonical file; `CLAUDE.md` and `.github/copilot-instructions.md` point here so
there is one source of truth rather than three that drift.

Humans: read [`docs/`](docs/) instead — same material, more explanation.

## What this project is

The website of **Ventorelativo**, a paragliding club (_Parapendio Club_) between
Pinerolo, Val Chisone and Val Pellice, Italy. **All visible content is in
Italian.** It is a statically built [Astro](https://astro.build) site deployed to
Netlify, replacing a Drupal 11 + Tome site that still lives, read-only, in
`../ventorelativo-drupal`.

Editors are club volunteers, not developers. Changes must survive being made by
someone who does not read code.

## Current state — read before planning anything

Phases 1 and 2 are complete. **Phase 3 has not started.** As of the last update
to this file:

**Built:** every URL the old site had. `/`, `/news/` and its two published
articles, `/siti/` and all fourteen flight sites, `/voli`, `/iscrizioni`,
`/contatti` with a Netlify form and its thank-you page, `/404`, plus the
temporary `/styleguide`. Three collections — `news`, `sites`, `pages` — in
`src/content.config.ts`, with MDX bodies in `src/content/`.

Also built: the SEO layer (sitemap, robots, per-page generated social cards,
schema.org, cookie-free analytics) and **Keystatic in local mode** — `npm run
dev`, then http://localhost:4321/keystatic.

**Not built yet:**

- **Keystatic is development-only.** It needs server-rendered routes, so it is
  excluded from production builds until Phase 3 brings the adapter and GitHub
  storage. Do not add it to the production integration list.
- **No Netlify adapter**, no server-rendered route (Phase 3).
- RSS: dropped by decision, not oversight (see MIGRATION-PLAN.md S9).
- `/styleguide` is a temporary design reference and should be deleted before
  the site goes live (Phase 5).
- **Nothing map-related** (Phase 4): no `map-features` collection, no geo data,
  no per-site maps, feature tables, XContest links or `/api/navdata/*` files.
  The site pages carry `TODO(Phase 4)` markers where those go.

Do not write code that imports from, or assumes the shape of, anything in that
second list. If a task needs it, read [`MIGRATION-PLAN.md`](MIGRATION-PLAN.md) §7
first and say which phase it belongs to.

`MIGRATION-PLAN.md` is the source of truth for scope, for the decisions already
made (D1–D13) and for what each phase covers. Do not re-litigate a decision
recorded there; if you think one is wrong, say why and let a human decide.

## Commands

```
npm install
npm run dev       # dev server on http://localhost:4321 (background-managed)
npm run build     # static build into dist/
npm run preview   # serve the built output
npm run check     # astro check — types and template diagnostics
npm run verify    # check + build. The gate. Run before claiming done.
npm run shot      # screenshot + measure a page in a real emulated viewport
npm run weight    # transferred bytes by resource type (run against the build)
```

Dev-server control (Astro manages it as a background process):
`npx astro dev status` · `npx astro dev logs -f` · `npx astro dev stop`

## Hard rules

Each of these has a reason. Breaking one is not a style disagreement, it breaks
something real.

1. **Never change `build.format: 'directory'`** in `astro.config.mjs`. It is what
   makes `/siti/montoso/` resolve exactly as the old Tome export did. The live
   URLs are load-bearing (MIGRATION-PLAN.md §3).
2. **Redirects go in `netlify.toml`, never in `astro.config.mjs`.** Without a host
   adapter, Astro's `redirects` option emits meta-refresh HTML instead of real
   301s, which passes no ranking signal.
3. **Do not add the Netlify adapter** before Phase 3. It flips the build to
   `mode:"server"` and ships a ~3.6 MB SSR function even when every route is
   prerendered.
4. **Colours are defined once, in `src/styles/tokens.css`, as `light-dark()`
   pairs.** Never hardcode a hex in a component, and never add a
   `prefers-color-scheme` or `[data-theme]` block to get a dark variant — the
   only thing the theme toggle changes is `color-scheme`, and every colour
   follows from that.
5. **Spacing, type sizes, radii and shadows come from tokens too.** If you need a
   value that does not exist, add a token; do not inline a magic number.
6. **No new dependencies without asking, and none that cost the page speed.**
   Bootstrap and jQuery were removed deliberately; the CSS layer is hand-rolled
   and small. This especially means no CSS framework, no component library, no
   icon package. When proposing one, state its **gzipped** size, whether it can
   be loaded lazily, and what breaks without it — see Performance below.
7. **Never edit `dist/` or `.astro/`.** Both are generated and git-ignored.
8. **Never modify or delete `../ventorelativo-drupal`.** It is the read-only
   reference for anything found missing later, and the byte-level source for the
   Phase 4 flight-data files.
9. **Flight-computer data (`/api/navdata/*`, Phase 4) is safety-critical.** Pilots
   load it into their instruments. Any change there must diff clean against the
   archived Drupal output. Do not improvise its format.
10. **UI copy is Italian.** Code, comments and documentation are English. That
    includes Keystatic's field labels — volunteers read them.
11. **Three lists describe content, and they must agree.** A field added to a
    collection needs updating in `src/content.config.ts` (what the build
    accepts), `keystatic.config.ts` (what an editor can type) and, for body
    components, `src/components/mdx/components.ts` (what renders). Zod is the
    backstop: drift fails the build rather than the page.
12. **Content files must not contain `import` statements.** Keystatic refuses
    to open an entry that has one. Body components are handed to `<Content
components={MDX_COMPONENTS} />` instead.

## Performance

**The target is 100/100 in PageSpeed Insights, and staying there.** Treat it as a
constraint on what you build, not a check at the end. Most visitors are on a
phone on mountain data.

- **Zero JavaScript is the default.** A page gets none unless something on it
  cannot work without it. Today: the theme toggle, the nav drawer, the gallery.
- **Load it only where it is used** — an import in a component's client
  `<script>` reaches only pages rendering that component; one in a layout
  reaches every page.
- **Load it only when it is needed** — anything not required for first render
  goes behind a dynamic `import()` fired by interaction.
- **Nothing render-blocking from a third party.** Fonts are self-hosted. No
  script tags pointing at other people's servers.
- **Images always through `astro:assets`**, with explicit `widths`, `sizes` and
  `quality`; `loading="lazy"` below the fold, `fetchpriority="high"` for the LCP
  image.
- **Advise against bloat rather than installing it.** Say so plainly, name the
  cost, and offer the platform feature that replaces it. `<details>`,
  `<dialog>`, `Intl`, CSS scroll-snap and container queries between them remove
  most of the reasons to reach for a library.

Measure, do not estimate — and measure the **build**, never the dev server,
which ships ~400 kB of Vite machinery that never reaches production:

```
npm run build && npm run preview
npm run weight -- http://localhost:4399/siti/
```

Current budget: `/` 86 kB with 1.5 kB of JS; `/siti/` 61 kB; a photo-heavy site
page 458 kB, almost all of it photographs. Details and the reasoning behind each
rule: [`docs/performance.md`](docs/performance.md).

## Conventions

- **One change per commit, with a brief message.** A subject line and at most a
  short paragraph. Split unrelated fixes even when they were made in the same
  session — a commit that mixes topics cannot be reverted cleanly. The detailed
  reasoning belongs in code comments and `docs/`, which is where this project
  keeps it.
- **Comments explain _why_, not _what_.** This codebase documents decisions and
  the traps behind them — match that. A comment that restates the code is noise;
  one that records why the obvious approach failed is why the file is readable.
- **Component styles stay scoped** inside the `.astro` file. Only genuinely
  global primitives (`.container`, `.prose`, `.button`, resets) live in
  `src/styles/global.css`.
- **Class names are BEM-ish**: `.hero`, `.hero__content`, `.button--outline`.
- **Prefer native elements over JavaScript.** The mobile menu is a `<dialog>`
  precisely so the browser supplies the focus trap, Escape handling and
  inert-ing rather than hand-rolled JS.
- **Every interactive control needs an accessible name** — visible text, or
  visually-hidden text plus `aria-hidden` on the icon.
- **This site ships no client JS by default.** Two small inline scripts exist (the
  theme no-flash script and the nav drawer). Adding a framework island is a
  decision to discuss, not a default.

## Definition of done

1. `npm run verify` passes — 0 errors, 0 warnings, build completes.
2. No page got heavier without a reason you can state. `npm run weight -- <url>`
   against the build.
3. For any visual change, measure it: `npm run shot -- <url> --measure "<sel>"`
   at **390x844 and 1440x900**, in **both colour schemes** (`--dark`). Do not
   claim a layout works from reading CSS. See [`docs/verifying-changes.md`](docs/verifying-changes.md).
4. No new dependencies, no new global CSS, no hardcoded colours.
5. If behaviour or structure changed, update the relevant file in `docs/`.
6. Report honestly: what you verified, how, and what you did not.

## Known traps

- **The dev server can serve stale CSS.** If a style edit does not appear in the
  browser, its Vite transform cache did not invalidate: the markup is fresh while
  the stylesheet is not. `npx astro dev stop`, start it again, hard-reload. This
  has already cost one debugging session.
- **`chrome --headless --window-size=390,844` lies on macOS** — the window is
  clamped to a 500px minimum width, so you get a 500px layout cropped to 390 and
  every narrow media query is wrong. Use `npm run shot`, which emulates device
  metrics over the DevTools Protocol instead.
- **Dev-server numbers are not production numbers**, for weight or for anything
  else. `astro dev` ships the Vite client and HMR; measure `astro preview`.
- **A dynamic `import()` of third-party CSS can 404 at runtime.** Astro inlines
  small stylesheets into the HTML while Vite still preloads the file it did not
  write, and the rejected import takes the whole feature down. Import
  third-party CSS in the component frontmatter instead.
- **`vite.optimizeDeps.include`** is required for a dependency reached only
  through a dynamic import inside a client script — without it the feature works
  in the build and silently does nothing in `astro dev`.
- **`<Picture>` and `<Image>` put your `class` on the inner `<img>`**, not on the
  `<picture>` wrapper. Positioning the wrapper needs `:global(picture)`.
