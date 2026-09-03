# Performance

**The goal is 100/100 in PageSpeed Insights, and staying there.** Not "fast
enough" — the site is a handful of static pages for a volunteer club, and there
is no reason for it to be anything less than the fastest thing its visitors open
that day. Many of them are on a phone, on mountain data.

This is a constraint on what gets built, not a pass at the end.

## Where it stands

Measured on the production build (`npm run build && npm run preview`), at
1440×900, bytes on the wire:

| Page             | Total  | JavaScript | CSS    |
| ---------------- | ------ | ---------- | ------ |
| `/`              | 108 kB | 1.5 kB     | 4.8 kB |
| `/siti/`         | 97 kB  | 8.1 kB     | 6.5 kB |
| `/news/`         | 213 kB | 1.5 kB     | 4.8 kB |
| `/siti/roletto/` | 350 kB | 9.0 kB     | 9.3 kB |

Almost all of the weight is photographs. The JavaScript column counts external
files: the pages with a map carry its facade, everything else carries only
Astro's prefetch. On top of that every page inlines its component scripts
(1.5 kB on the wire) — the no-flash theme script, the theme toggle, the nav
drawer and the language switcher, small enough that Astro puts them in the
document rather than spending a request on them.

Two of these numbers are worse than the ones this table held before, and both
for the same reason: `topo.svg`, the contour texture behind the footer, is
15 kB on the wire and loads on **every page**. It is the largest non-font,
non-photograph item on the site and the obvious thing to attack if the budget
ever needs to come down — a small tile repeated through `mask-size` would do
the same job for a fraction of it.

Measure it yourself — never estimate:

```
npm run build && npm run preview
npm run weight -- http://localhost:4399/siti/
```

Do it against the **build**, not the dev server: `astro dev` ships ~400 kB of
Vite client and HMR machinery that never reaches production, which makes dev
numbers meaningless.

### A shared module stops a script being inlined

Astro inlines a component's `<script>` only while it has nothing to import.
Adding one static import — even to a ten-line helper in `src/lib/` — turns that
script into an external module _and_ pulls in a shared chunk beside it.

This was measured, not guessed: factoring the `<details>` light-dismiss logic
out of the theme toggle and the language switcher, which looked like pure
tidying, took `/` from 91.3 kB over 8 requests to 93.3 kB over 11. Two kilobytes
and three round-trips on every page of the site, to avoid ten duplicated lines.
It was reverted, and the same ten lines are now written out in three components
on purpose. Each one says so.

The rule: **inside a component's client script, prefer duplication to an
import** unless the thing being imported is big enough that it should be its own
request anyway — which is exactly what the map's dynamic `import()` is.

### What opening a map costs, and why it is not smaller

MapLibre is **239 kB brotli** across three files, fetched only when somebody
presses "Apri la mappa". The number quoted before this was 970 kB, which was
the uncompressed main chunk — not a figure any visitor ever pays.

It was 326 kB until the shared module stopped being downloaded twice; see the
`rollupOptions` comment in `astro.config.mjs`. What remains is not reducible by
configuration:

- **There is nothing left to tree-shake.** The GL renderer, the vector-tile
  parsers and the style spec are one graph, and the map uses all three.
- **The alternatives lose the features the club asked for.** Leaflet is 14 kB
  brotli and cannot do 3D terrain, pitch or vector labels; OpenLayers is not
  much smaller than MapLibre once terrain is added.
- **The shared module is still parsed twice**, once on each thread, because a
  worker has its own module graph. That is a CPU cost, not a network one, and
  nothing about the library lets us avoid it.

The real defence is the facade: a visitor who never opens a map pays none of
it, and that is measured by the table above rather than argued.

### Why Vite's chunk-size warning is turned down

Two built chunks are far over Vite's 500 kB default: Keystatic's admin UI
(~2.6 MB) and MapLibre (~970 kB). Both are deliberate, and neither is on the
path of a visitor reading a page — the first is fetched at `/keystatic` by an
editor, the second only when somebody opens a map. The warning has no way to
tell a lazy chunk from an eager one, so it fired on every build and said
nothing; `chunkSizeWarningLimit` in `astro.config.mjs` is set just above
Keystatic, which leaves a genuinely new large chunk still reported. The table
above, measured with `npm run weight`, is the real budget.

## Rules

1. **Zero JavaScript is the default.** A page gets none unless something on it
   genuinely cannot work without it. Today that is the theme toggle, the nav
   drawer, the gallery lightbox, the language switcher and the map.
2. **A dependency must earn its bytes.** Before adding one, know its gzipped
   size, whether the feature degrades gracefully without it, and what the
   hand-rolled version would cost. Say the number out loud in the pull request
   or the commit message.
3. **Load it only where it is used.** An `import` inside a component's client
   `<script>` is bundled only into pages that render that component. An import
   in a layout reaches every page.
4. **Load it only when it is needed.** Anything not required for first render
   goes behind a dynamic `import()` triggered by interaction. The gallery
   library is 21 kB and downloads on the first click, not on page load.
5. **Nothing render-blocking from a third party.** No script tags pointing at
   other people's servers, no `@import` from a font CDN. Fonts are self-hosted;
   analytics is a single async beacon or it does not ship.
6. **Images always go through `astro:assets`.** Explicit `widths` and `sizes`,
   `quality` tuned to the display size, `loading="lazy"` below the fold,
   `fetchpriority="high"` on the LCP image. A raw `<img src>` pointing at
   `public/` skips every optimisation Astro would have done.
7. **Prefetch conservatively.** `hover`, not `viewport`. Prefetching every link
   on screen sounds free and is not: on `/siti` it fetched fourteen pages
   nobody asked for — 172 kB of someone's data.

## Judging a proposed library

Ask, in this order:

- **Is it needed at all?** A `<dialog>`, `<details>` or a CSS scroll-snap strip
  replaces a lot of libraries and costs nothing.
- **What does it weigh, gzipped?** Not the unpacked size, not the badge on the
  README. Check [bundlephobia](https://bundlephobia.com) or the `dist/` folder.
- **Can it be lazy?** If it must run at load, its cost is on every visitor. If it
  can wait for a click, most visitors never pay it.
- **What does it drag in?** A library with its own framework runtime is not a
  small library.
- **Does the page still work without it?** If JavaScript fails, does the content
  survive? Every gallery thumbnail here is a plain link to the full-size image.

**Push back rather than install.** Things worth arguing against, with what to do
instead: jQuery (the platform does all of it now), Bootstrap or Tailwind (this
site has a 3.6 kB hand-rolled layer), icon packages (inline the four SVGs you
actually use), moment/dayjs (`Intl.DateTimeFormat`), lodash (standard library),
a React island for something a `<details>` can do, and any analytics product
that wants more than one small async request.

## What already protects this

- **Static output.** Every page is a file on a CDN; there is no server to wait
  for. Astro ships no framework runtime to the browser.
- **Self-hosted variable font**, one 32 kB file, no third-party origin, no
  render-blocking stylesheet from `fonts.googleapis.com`.
- **Immutable caching** on `/_astro/*`, where every filename carries a content
  hash (see `netlify.toml`). HTML deliberately revalidates so edits go live at
  once.
- **`astro:assets`** generating avif/webp at the sizes actually used — the site
  photographs go from 1.7 MB originals to ~40 kB thumbnails.

## Facades, for the things that cannot be small

Two features on this site are genuinely heavy and genuinely wanted: the map and
the translation widget. Both ship as a **facade** — the part a visitor sees is
static HTML that costs a few hundred bytes, and the real thing is fetched only
once they show they want it.

- **The map** (`SiteMap.astro`) paints an SVG of the markers, and loads MapLibre
  (240 kB) on click.
- **The language switcher** (`LanguageSwitcher.astro`) is a flag and a menu of
  five, and loads Google's `translate_a/element.js` on hover or click — never
  on page load. A visitor who has translated before carries a `googtrans` cookie, and
  only they pay for it, on every page, because they asked to.

The pattern has one rule that matters: **paint the busy state synchronously,
then await.** A click handler that awaits before touching the DOM reads as a
dropped click, and shows up as INP.

The alternative for the translator was the widget the Drupal site ran — a
third-party script from a domain we do not control, on every page, for a
feature most visitors of an Italian club site never touch. That single script
is larger than everything else this site loads.

## Build-time work is free to the visitor

Social cards (`/og/*.jpg`) are rendered at build with satori and sharp, both
devDependencies. That is ~25 images and a couple of seconds, and none of it
reaches a browser — the visitor gets a JPEG that only Facebook, WhatsApp and
friends ever fetch.

They are cached by content hash in `.astro/og-cache/`, keyed on the title, the
kind, the source photograph's bytes and the template version, so a rebuild
re-renders only what changed: a local build goes from ~2.5s to ~1ms per card.
A cold CI build has no cache and renders all of them; if that ever matters,
persist that directory between Netlify builds.

**Bump `TEMPLATE_VERSION` in `src/lib/og.ts` when the card design changes**, or
every existing card keeps its old pixels for ever. That includes replacing
`src/assets/og-logo.svg`, the logo lockup every card draws — swap that one file
for a designed version and all the cards follow.

They are JPEG, not WebP, on purpose: only link scrapers ever fetch them, and
Facebook and WhatsApp have a long record of not rendering WebP cards. Everything
the site itself serves is WebP or AVIF.

## Traps

- **Dev numbers are not real numbers.** Always measure the build.
- **A dynamic import can pull CSS with it.** Astro inlines small stylesheets
  into the HTML, and Vite will still emit a preload for a file it then did not
  write — the fetch 404s and rejects the import. Import third-party CSS in the
  component frontmatter, where Astro handles it as page CSS.
- **`optimizeDeps.include`** is needed for anything only reached through a
  dynamic import in a client script, or it works in the build and silently does
  nothing in dev.
