# AGENTS.md

Instructions for AI coding agents working on this repository. This is the
canonical file; `CLAUDE.md` and `.github/copilot-instructions.md` point here so
there is one source of truth rather than three that drift.

Humans: read [`docs/`](docs/) instead — same material, more explanation.

## What this project is

The website of **Ventorelativo**, a paragliding club (*Parapendio Club*) between
Pinerolo, Val Chisone and Val Pellice, Italy. **All visible content is in
Italian.** It is a statically built [Astro](https://astro.build) site deployed to
Netlify, replacing a Drupal 11 + Tome site that still lives, read-only, in
`../ventorelativo-drupal`.

Editors are club volunteers, not developers. Changes must survive being made by
someone who does not read code.

## Current state — read before planning anything

Phase 1 (skeleton and design system) is complete. **Phase 2 has not started.**
That means, as of the last update to this file:

- There are **no content collections**, no `src/content/`, no `src/content.config.ts`.
- There is **no Keystatic**, no CMS, no admin route.
- The only routes that exist are `/` and `/styleguide`. `/siti`, `/news`,
  `/voli`, `/iscrizioni`, `/contatti` are **linked but not built yet** — the nav
  points at 404s on purpose.
- There is **no Netlify adapter** and no server-rendered route.

Do not write code that imports from, or assumes the shape of, anything in that
list. If a task needs it, that task is Phase 2 work: read
[`MIGRATION-PLAN.md`](MIGRATION-PLAN.md) §7 first and say so.

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
6. **No new dependencies without asking.** Bootstrap and jQuery were removed
   deliberately; the CSS layer is hand-rolled and small. This especially means no
   CSS framework, no component library, no icon package.
7. **Never edit `dist/` or `.astro/`.** Both are generated and git-ignored.
8. **Never modify or delete `../ventorelativo-drupal`.** It is the read-only
   reference for anything found missing later, and the byte-level source for the
   Phase 4 flight-data files.
9. **Flight-computer data (`/api/navdata/*`, Phase 4) is safety-critical.** Pilots
   load it into their instruments. Any change there must diff clean against the
   archived Drupal output. Do not improvise its format.
10. **UI copy is Italian.** Code, comments and documentation are English.

## Conventions

- **Comments explain *why*, not *what*.** This codebase documents decisions and
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
2. For any visual change, measure it: `npm run shot -- <url> --measure "<sel>"`
   at **390x844 and 1440x900**, in **both colour schemes** (`--dark`). Do not
   claim a layout works from reading CSS. See [`docs/verifying-changes.md`](docs/verifying-changes.md).
3. No new dependencies, no new global CSS, no hardcoded colours.
4. If behaviour or structure changed, update the relevant file in `docs/`.
5. Report honestly: what you verified, how, and what you did not.

## Known traps

- **The dev server can serve stale CSS.** If a style edit does not appear in the
  browser, its Vite transform cache did not invalidate: the markup is fresh while
  the stylesheet is not. `npx astro dev stop`, start it again, hard-reload. This
  has already cost one debugging session.
- **`chrome --headless --window-size=390,844` lies on macOS** — the window is
  clamped to a 500px minimum width, so you get a 500px layout cropped to 390 and
  every narrow media query is wrong. Use `npm run shot`, which emulates device
  metrics over the DevTools Protocol instead.
- **`<Picture>` and `<Image>` put your `class` on the inner `<img>`**, not on the
  `<picture>` wrapper. Positioning the wrapper needs `:global(picture)`.
