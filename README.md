# Ventorelativo

Website of **Ventorelativo**, a paragliding club (_Parapendio Club_) between Pinerolo,
Val Chisone and Val Pellice. Content is in Italian.

Astro, statically built, deployed to Netlify. Replaces the Drupal 11 + Tome site in
`../ventorelativo-drupal`.

> **Phases 1 to 4 are done**: the design system, every page and URL the old site had, the
> SEO layer, Keystatic in GitHub mode deployed with the site, the maps, and the
> flight-computer files gated byte for byte against the Drupal build.
> **Phase 5 is the cutover**, the day `ventorelativo.it` stops serving the old export and
> starts serving this one: [`docs/cutover.md`](docs/cutover.md) is the runbook.
> [`MIGRATION-PLAN.md`](MIGRATION-PLAN.md) remains the source of truth for scope and for
> the decisions already taken (D1–D13).

## Documentation

| Where                                                    | What                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`docs/how-to.md`](docs/how-to.md)                       | Making a change: text, nav, colours, pages, images. Start here.                                   |
| [`docs/architecture.md`](docs/architecture.md)           | How Astro builds this site, and why it is arranged this way.                                      |
| [`docs/authoring-with-ai.md`](docs/authoring-with-ai.md) | `/redazione`: how a volunteer writes a post with ChatGPT or Gemini.                               |
| [`docs/deploying.md`](docs/deploying.md)                 | Editing through Keystatic, branches, previews, what a save actually does.                         |
| [`docs/cutover.md`](docs/cutover.md)                     | Phase 5: moving the domain, and the checks either side of it.                                     |
| [`docs/verifying-changes.md`](docs/verifying-changes.md) | Proving a change works, plus the traps that waste an afternoon.                                   |
| [`docs/performance.md`](docs/performance.md)             | The speed budget: 100/100 PageSpeed, and how dependencies are judged against it.                  |
| [`AGENTS.md`](AGENTS.md)                                 | Instructions for AI coding agents. `CLAUDE.md` and `.github/copilot-instructions.md` point at it. |

Club members can work on this site with an AI agent without knowing Astro: see
[`docs/README.md`](docs/README.md).

## Getting started

```
npm install
npm run dev      # http://localhost:4321, and /keystatic writes to your working copy
```

| Script               | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `npm run dev`        | Dev server with HMR, managed in the background                    |
| `npm run build`      | Static build into `dist/`                                         |
| `npm run preview`    | Serve the built output: the only numbers worth measuring          |
| `npm run check`      | Astro + TypeScript diagnostics                                    |
| `npm run verify`     | check, lint, build and seven gates. The gate before calling done. |
| `npm run shot`       | Screenshot and measure a page in a real emulated viewport         |
| `npm run weight`     | Transferred bytes by resource type: run it against the build      |
| `npm run geo:export` | Map features out to GeoJSON, to edit in something visual          |
| `npm run geo:import` | And back into the YAML the site builds from                       |

The gates `verify` runs, each of which can be run alone: `navdata:check` (the
flight-computer files still match the archive), `urls:check` (every URL the old site
served still resolves), `sitemap:check`, `privacy:check` (nothing third-party loads
before a visitor asks), `headings:check`, `authoring:check` (the writing kit still
describes the real schemas), and `lint`, which includes the em-dash rule.

## Layout

```
src/
  assets/              Photographs, map icons, the OG lockup, the self-hosted faces.
  authoring/           istruzioni.md: the Italian brief /redazione hands to an AI.
  content/             news/, sites/, pages/, settings/, map-features/: the MDX and
                       YAML the site is built from, and what Keystatic writes.
  content.config.ts    Collection schemas. Zod validates them at build.
  lib/                 og.ts (social cards), schema.ts (JSON-LD), navdata.ts (the
                       flight-computer files), map and XContest helpers, llms.ts.
  consts.ts            Site name, nav, club coordinates.
  styles/
    tokens.css         Design tokens. Colours are light-dark() pairs.
    global.css         Reset, base elements, .container / .prose / .button / .card.
  layouts/
    BaseLayout.astro   <head>, header, main, footer. Theme no-flash script.
    PageLayout.astro   Interior page: breadcrumbs + h1 + slot.
    EntryLayout.astro  A news post or a flight site: meta, media, body, sections.
  components/          Header, Nav, Footer, cards, SiteMap and its facade, the
                       gallery, the language switcher, mdx/ body components.
  pages/
    index.astro        Home: hero, then the bands the home entry describes.
    news/, siti/       Index + entry routes for the two content collections.
    api/navdata/       The waypoint and airspace files pilots load (Phase 4).
    og/[...route].jpg  Generated social cards, cached by content hash.
    redazione/         The writing kit: the document, and its machine-readable pair.
    styleguide.astro   Design-system reference. noindex, out of the sitemap, stays.
public/                Favicons, the vendored MapLibre worker, the static social card.
keystatic.config.ts    The editing UI's schema. Must agree with content.config.ts.
docs/                  Documentation for humans and agents.
scripts/               The gates above, plus shot.mjs and the generators `prebuild` runs.
```

## Things worth knowing

**Theming.** Every colour token is a `light-dark()` pair and the only thing the toggle
changes is `color-scheme` on `<html>`. So "auto" is genuinely the absence of an override
rather than a third palette, and there is one definition per colour instead of three.
Adding a colour means adding one line to `tokens.css`.

**Redirects live in `netlify.toml`, not `astro.config.mjs`.** Astro's `redirects` option
only emits real 301s when a host adapter is present; without one it writes meta-refresh
HTML pages, which pass no ranking signal. See the comment in `astro.config.mjs`.

**The adapter is here, and every page is still prerendered.** `@astrojs/netlify` went in
at Phase 3 because Keystatic's two admin routes genuinely need on-demand rendering, and
those two are the entire contents of the serverless function. A stray
`export const prerender = false` moves a page off the CDN onto a cold start.

**Editors are volunteers.** Keystatic at `/keystatic` is the CMS, GitHub decides who may
use it, and every save is a commit that Netlify builds. `/redazione` is the other half:
one document a volunteer pastes into a free ChatGPT or Gemini account to have any field
on the site written or corrected.

**URLs are load-bearing.** `build.format: 'directory'` is what makes `/siti/montoso/`
resolve the same way the Tome export did. Don't change it. `urls:check` fails the build
if any of them stops resolving; the inventory is in `MIGRATION-PLAN.md` §3.

**The old site is the reference.** `../ventorelativo-drupal` stays around read-only.
Its committed `html/` directory is the byte-level output the flight-computer files are
still diffed against on every build.
