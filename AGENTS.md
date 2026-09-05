# AGENTS.md

Instructions for AI coding agents working on this repository. This is the
canonical file; `CLAUDE.md` and `.github/copilot-instructions.md` point here so
there is one source of truth rather than three that drift.

Humans: read [`docs/`](docs/) instead, same material, more explanation.

## What this project is

The website of **Ventorelativo**, a paragliding club (_Parapendio Club_) between
Pinerolo, Val Chisone and Val Pellice, Italy. **All visible content is in
Italian.** It is a statically built [Astro](https://astro.build) site deployed to
Netlify, replacing a Drupal 11 + Tome site that still lives, read-only, in
`../ventorelativo-drupal`.

Editors are club volunteers, not developers. Changes must survive being made by
someone who does not read code.

## Current state: read before planning anything

Phases 1 to 4 are complete. **Phase 5 (the cutover) is next.** As of the
last update to this file:

**Built:** every URL the old site had. `/`, `/news/` and its articles, `/siti/`
and all fourteen flight sites, `/voli`, `/iscrizioni`, `/contatti` with a
Netlify form and its thank-you page, `/404`, plus `/styleguide`.
Four collections (`news`, `sites`, `pages`, `settings`) in
`src/content.config.ts`, with MDX bodies in `src/content/`.

Also built: the SEO layer (sitemap, robots, per-page generated social cards,
schema.org, cookie-free analytics, `llms.txt`); **Keystatic in GitHub mode**,
deployed with the site: editors work on a `modifiche-` branch and merge once,
and each entry carries a preview link to that branch's Netlify deploy (see
[`docs/deploying.md`](docs/deploying.md)); the **flight-data files**, byte-gated
against the Drupal archive; the **map**: MapLibre behind a facade, with 3D
terrain, the KK7 thermal layers, the Tracestrack topo base, per-site and
overview; the **XContest links** per takeoff; the **language switcher**, a
facade over GTranslate; `geo:export`/`geo:import` for round-tripping map
features through GeoJSON; and the **writing kit** at `/redazione`, one Italian
document a volunteer pastes into a free ChatGPT or Gemini account to get any
content on the site written or corrected, field by field, including an inventory
of what is editable and what is not
([`docs/authoring-with-ai.md`](docs/authoring-with-ai.md)).

**Not built, and why:**

- **The domain has not moved.** `ventorelativo.it` still serves the old Drupal
  export from a separate Netlify project; this build lives at
  `ventorelativo-astro.netlify.app` and disallows crawling until it does. That
  move is Phase 5.
- `/styleguide` stays. It renders every token, primitive and component as the
  real element, which makes it the fastest way for a person _or an agent_ to see
  what the site already has before inventing something new. It is `noindex` and
  excluded from the sitemap, so it is not part of the public site.
- RSS: dropped by decision, not oversight (MIGRATION-PLAN.md S9).
- A cookie banner. There is nothing to consent to: **nothing is ever stored on
  the visitor's device**, which is what the consent rules are about, so no
  banner is required. Exactly one third-party request fires unasked, the
  cookieless analytics beacon, and `npm run privacy:check` fails if a second
  one appears. The map, the translator and their tile providers load only on
  interaction. `/privacy` says exactly this, keep the three in step: the
  notice, the gate's allowlist, and what the pages actually do.
- `/api/sites/<nid>/geo.json`: dropped (D5), and the `all` variant with it,
  the maps inline their data.
- Membership payments (Phase 6) wait on the committee (D10). `/iscrizioni`
  ships today with the existing Satispay links and bank transfer.

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
npm run check     # astro check: types and template diagnostics
npm run verify    # check + lint + build + six gates. Run before claiming done.
npm run navdata:check  # flight files vs the archived Drupal build (needs a build first)
npm run urls:check     # every URL the old site served still resolves
npm run sitemap:check  # every built page is in the sitemap, or excluded on purpose
npm run privacy:check  # no page loads a third party before a visitor asks
npm run headings:check # every h2 has an id, unique per page, so it can be linked to
npm run authoring:check # src/authoring/istruzioni.md still matches the schemas
npm run map:posters    # re-render the map stills (needs Chrome, a GPU and a key)
npm run posters:check  # every still still matches the map data behind it
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
3. **Keep `output: 'static'`, and do not add a second server-rendered route
   without a reason.** The Netlify adapter is present (Phase 3) because
   Keystatic's two admin routes genuinely need it, and those two are the whole
   contents of the serverless function. Every page of the site is still
   prerendered; a stray `export const prerender = false` moves a page off the
   CDN and onto a cold start.
4. **Colours are defined once, in `src/styles/tokens.css`, as `light-dark()`
   pairs.** Never hardcode a hex in a component, and never add a
   `prefers-color-scheme` or `[data-theme]` block to get a dark variant: the
   only thing the theme toggle changes is `color-scheme`, and every colour
   follows from that.
5. **Spacing, type sizes, radii and shadows come from tokens too.** If you need a
   value that does not exist, add a token; do not inline a magic number.
6. **No new dependencies without asking, and none that cost the page speed.**
   Bootstrap and jQuery were removed deliberately; the CSS layer is hand-rolled
   and small. This especially means no CSS framework, no component library, no
   icon package. When proposing one, state its **gzipped** size, whether it can
   be loaded lazily, and what breaks without it: see Performance below.
7. **Never edit `dist/` or `.astro/`.** Both are generated and git-ignored.
8. **Never modify or delete `../ventorelativo-drupal`.** It is the read-only
   reference for anything found missing later, and the byte-level source for the
   Phase 4 flight-data files.
9. **Flight-computer data (`/api/navdata/*`) is safety-critical.** Pilots load it
   into their instruments. `npm run verify` fails unless both files still match
   the archived Drupal output, and that gate is the point: if it goes red, fix
   the generator, do not update the reference. It is the evidence of what pilots
   already have loaded. Do not improvise the format: it was ported from
   `NavdataController.php`, and `src/lib/navdata.ts` records why each rule is
   what it is.
10. **UI copy is Italian.** Code, comments and documentation are English. That
    includes Keystatic's field labels, which volunteers read. One documented
    exception: `src/authoring/istruzioni.md` is Italian, because its readers are
    the volunteer who skims it and the model they paste it into, and an Italian
    brief is what produces an Italian answer.
11. **Never use an em dash.** Not in content, not in UI copy, not in comments,
    not in documentation, not in commit messages. The club does not want the
    punctuation anywhere in this project. Use a comma, a colon, a semicolon,
    parentheses or a full stop, whichever the sentence actually needs. An en
    dash stays legal in a numeric range. `scripts/check-content.mjs` enforces
    this over the whole repository, from `prebuild` as well as `lint`, because
    `/redazione` invites volunteers to draft posts with a model that breaks the
    rule by reflex and Netlify never runs `lint` on a Keystatic branch.
12. **Four lists describe content, and they must agree.** A field added to a
    collection needs updating in `src/content.config.ts` (what the build
    accepts), `keystatic.config.ts` (what an editor can type), for body
    components `src/components/mdx/components.ts` (what renders), and
    `src/authoring/istruzioni.md` (what an editor's AI is told the fields are).
    Zod is the backstop for the first two and `npm run authoring:check` for the
    last: drift fails the build rather than the page.
13. **Content files must not contain `import` statements.** Keystatic refuses
    to open an entry that has one. Body components are handed to `<Content
components={MDX_COMPONENTS} />` instead.

## Performance

**The target is 100/100 in PageSpeed Insights, and staying there.** Treat it as a
constraint on what you build, not a check at the end. Most visitors are on a
phone on mountain data.

- **Zero JavaScript is the default.** A page gets none unless something on it
  cannot work without it. Today: the theme toggle, the nav drawer, the gallery,
  the language switcher, the map, and a three-line WebMCP guard that fetches
  its module only if the browser has the API.
- **Load it only where it is used**: an import in a component's client
  `<script>` reaches only pages rendering that component; one in a layout
  reaches every page.
- **Load it only when it is needed**: anything not required for first render
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

Measure, do not estimate, and measure the **build**, never the dev server,
which ships ~400 kB of Vite machinery that never reaches production:

```
npm run build && npm run preview
npm run weight -- http://localhost:4399/siti/
```

Current budget, at 390x844: `/` 100 to 130 kB, depending on how many news thumbnails Chrome decides are near enough to fetch, of which the first screen is still
only the hero: the home page is five sections now, and one news thumbnail sits
inside Chrome's lazy-loading threshold and is fetched even though it is 1700px
down. The other two are not.; `/siti/` 97 kB; a photo-heavy site page
99 kB above the fold and ~350 kB scrolled, almost all of it photographs. Every
page inlines its component scripts (1.5 kB on the wire) and 15 kB of `topo.svg`,
the footer's contour texture: the biggest non-photograph item on the site, and
the first thing to attack if the budget has to come down. `/siti/` and the site
pages add the map's still (89 kB on a phone), not MapLibre, which is 239 kB
brotli across three files and arrives only when a map is opened. The map no
longer opens itself: it did, and it cost 6.5 MB of terrain tiles and 8.6 s of
blocked main thread on a mid-range phone. Translation is a facade too: nothing from Google loads until a
visitor asks for it. Details and the reasoning behind each rule:
[`docs/performance.md`](docs/performance.md).

## Conventions

- **One change per commit, with a brief message.** A subject line and at most a
  short paragraph. Split unrelated fixes even when they were made in the same
  session: a commit that mixes topics cannot be reverted cleanly. The detailed
  reasoning belongs in code comments and `docs/`, which is where this project
  keeps it.
- **Comments explain _why_, not _what_.** This codebase documents decisions and
  the traps behind them: match that. A comment that restates the code is noise;
  one that records why the obvious approach failed is why the file is readable.
- **Component styles stay scoped** inside the `.astro` file. Only genuinely
  global primitives (`.container`, `.prose`, `.button`, `.card`, resets) live in
  `src/styles/global.css`.
- **A section heading is `<H2>`, not `<h2>`.** It derives its `id` from its own
  text so the heading can be linked to, matching the ids Astro's markdown
  pipeline gives headings written in MDX. `npm run headings:check` fails the
  build on a bare `<h2>`.
- **A card is `.card`**, plus `.card--link` when the whole card is clickable and
  `.card__stretch` on the one anchor inside it. Six components draw one; the
  surface is defined once.
- **Class names are BEM-ish**: `.hero`, `.hero__content`, `.button--outline`.
- **Prefer native elements over JavaScript.** The mobile menu is a `<dialog>`
  precisely so the browser supplies the focus trap, Escape handling and
  inert-ing rather than hand-rolled JS.
- **Every interactive control needs an accessible name**: visible text, or
  visually-hidden text plus `aria-hidden` on the icon.
- **This site ships no client JS by default.** Two small inline scripts exist (the
  theme no-flash script and the nav drawer). Adding a framework island is a
  decision to discuss, not a default.

## Definition of done

1. `npm run verify` passes: 0 errors, 0 warnings, build completes.
2. No page got heavier without a reason you can state. `npm run weight -- <url>`
   against the build.
3. For any visual change, measure it: `npm run shot -- <url> --measure "<sel>"`
   at **390x844 and 1440x900**, in **both colour schemes** (`--dark`). Do not
   claim a layout works from reading CSS. See [`docs/verifying-changes.md`](docs/verifying-changes.md).
4. No new dependencies, no new global CSS, no hardcoded colours.
5. If behaviour or structure changed, update the relevant file in `docs/`.
6. Report honestly: what you verified, how, and what you did not.

## Known traps

- **A long-running dev server goes stale, and not only for CSS.** Two shapes of
  this, both seen here. A style edit that does not appear: the Vite transform
  cache did not invalidate, so the markup is fresh and the stylesheet is not.
  And, worse because it looks like broken code: after `astro.config.mjs`
  changes (an integration or an adapter) the server can keep serving pages
  built before them, with whole new components silently missing. A page that
  renders correctly in `dist/` and not at `:4321` is this, every time.
  `npx astro dev stop`, start it again, hard-reload; a server started by hand
  rather than with `--background` has to be stopped in its own terminal.
  Between them these have cost two debugging sessions. When in doubt,
  `npm run build && npm run preview` is authoritative.
- **A schema change does not reach a running dev server, and empties the
  collection.** `src/content.config.ts` is read once, at startup. Edit a Zod
  schema while `astro dev` is up and every entry is still validated against the
  old one: rename a `category` value and all four posts fail with "data does not
  match collection schema", the collection reports itself empty, and `/news`
  renders "Non ci sono ancora notizie pubblicate" while `dist/` has every card.
  The error is in `npx astro dev logs`, not on the page. **A restart is not
  always enough**: the parsed entries live in `.astro/data-store.json`, which
  outlives the process, so a schema that _gains_ a key serves the old shape
  from cache and the new field arrives `undefined`. Stop the server, delete
  that file, start it again. A build never sees either: it is a fresh process
  and `prebuild` rebuilds what it needs.

- **`chrome --headless --window-size=390,844` lies on macOS**: the window is
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
  through a dynamic import inside a client script, without it the feature works
  in the build and silently does nothing in `astro dev`.
- **The Netlify adapter replaces the image pipeline unless you stop it.**
  `imageCDN` defaults to `true`, which swaps `astro:assets` for
  `/.netlify/images?url=…` URLs: no build-time optimisation, no immutable
  `_astro/*.avif`, a cold resize in front of the LCP image, and a metered
  resource. `netlify({ imageCDN: false })` keeps the build-time pipeline. Check
  it the way it was caught: grep the built HTML for `/.netlify/images`.
- **A bundled library that loads its own worker will lose it.** MapLibre finds
  its worker with `new URL('./maplibre-gl-worker.mjs', import.meta.url)`, which
  no bundler can see through: Vite hashes the main chunk and emits no worker
  beside it. The 404 is silent and the symptom is misleading: only _vector_
  tiles are parsed in the worker, so a raster basemap draws perfectly while
  every road, label and marker is missing. `scripts/sync-vendor.mjs` copies the
  worker **and the `maplibre-gl-shared.mjs` it imports** into `public/`, and
  `setWorkerUrl` points at them. `isSourceLoaded()` returning false for every
  source is the tell.
- **A new `PUBLIC_` environment variable fails the Netlify build.** The secrets
  scanner treats every variable as a credential and finds this one in the output,
  where Astro deliberately put it. Add the name to `SECRETS_SCAN_OMIT_KEYS` in
  `netlify.toml`; never disable the scan, which still has real secrets to catch.
- **`<Picture>` and `<Image>` put your `class` on the inner `<img>`**, not on the
  `<picture>` wrapper. Positioning the wrapper needs `:global(picture)`.
- **A page's `:global()` cannot override a component's own scoped rule.** Astro
  compiles the component's `.header` to `.header[data-astro-cid-…]`, one
  specificity point above the bare `.header` that `:global(.header)` emits, so
  the page's rule loses silently and the style looks like it was ignored. Put
  the exception in the component, next to whatever else already varies by the
  same prop.
- **An import inside a component's client `<script>` stops Astro inlining it.**
  The script becomes an external module and drags a shared chunk along with it.
  Factoring ten lines of `<details>` dismissal out of two components cost 2.0 kB
  and three requests on _every_ page. Inside a client script, prefer duplication
  to a shared helper, and if you do import, measure `/` before and after.
- **Keystatic draws a field's description only where it draws the field.**
  Under `entryLayout: 'content'` the body field fills the page and its own
  `description` is never rendered, so help text put there is invisible. The
  first sidebar field's is drawn. And `ui.navigation` accepts collection and
  singleton keys only, so there is no way to put an arbitrary link in the
  admin's sidebar: a note on a field is the way to reach an editor.
- **`.netlify/` is build output that eslint used to read.** The adapter writes
  it on every build, so `npm run verify` run after a build reported 124 errors
  in bundled code nobody here wrote. It is in the eslint ignores now; if a gate
  suddenly reports errors in files you have never opened, check what generated
  them before believing them.
- **`map.once('idle')` does not fire when the map is already idle.** Which is
  exactly the case inside an idle handler with every tile in: the callback is
  never called and whatever waits on it waits forever. `map.loaded()` answers
  the question directly. This is what `data-map-ready` records, and it cost an
  afternoon of headless captures timing out against a map that had finished.
- **`Page.captureScreenshot` ignores `clip` when `fromSurface` is false**, and
  hands back the viewport instead: header, padding and all. The surface path
  honours it, but only settles once nothing is animating, which is why the
  capture waits for `data-map-ready` first. `clip` is in page coordinates, not
  viewport ones.
- **Two `getStaticPaths` entries can claim the same path.** Astro keeps one,
  warns, and carries on; the card the `/og/` route built for the homepage was
  wrong for weeks because the entry that won was not the one that looked
  authoritative. A build warning about a "conflicting route" is a real bug.
