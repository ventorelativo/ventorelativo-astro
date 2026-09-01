# Ventorelativo

Website of **Ventorelativo**, a paragliding club (*Parapendio Club*) between Pinerolo,
Val Chisone and Val Pellice. Content is in Italian.

Astro, statically built, deployed to Netlify. Replaces the Drupal 11 + Tome site in
`../ventorelativo-drupal`.

> **Migration in progress.** [`MIGRATION-PLAN.md`](MIGRATION-PLAN.md) is the source of
> truth for what is being built, what has been decided (D1–D13) and what is still open.
> **Phases 1 and 2 are done** — design system, all content, every URL, SEO and
> the CMS in local mode. Phase 3 is Keystatic on GitHub, which needs a remote.

## Documentation

| Where | What |
|---|---|
| [`docs/how-to.md`](docs/how-to.md) | Making a change: text, nav, colours, pages, images. Start here. |
| [`docs/architecture.md`](docs/architecture.md) | How Astro builds this site, and why it is arranged this way. |
| [`docs/verifying-changes.md`](docs/verifying-changes.md) | Proving a change works, plus the traps that waste an afternoon. |
| [`docs/performance.md`](docs/performance.md) | The speed budget: 100/100 PageSpeed, and how dependencies are judged against it. |
| [`AGENTS.md`](AGENTS.md) | Instructions for AI coding agents. `CLAUDE.md` and `.github/copilot-instructions.md` point at it. |

Club members can work on this site with an AI agent without knowing Astro — see
[`docs/README.md`](docs/README.md).

## Getting started

```
npm install
npm run dev      # http://localhost:4321
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built output |
| `npm run check` | Astro + TypeScript diagnostics |
| `npm run verify` | `check` + `build`. The gate before calling work done. |
| `npm run shot` | Screenshot and measure a page in a real emulated viewport |
| `npm run weight` | Transferred bytes by resource type — run it against the build |

## Layout

```
src/
  assets/              Images, the OG lockup, the Metropolis face used on cards.
  content/             news/, sites/, pages/ — the MDX the site is built from.
  content.config.ts    Collection schemas. Zod validates them at build.
  lib/                 og.ts (social cards), schema.ts, xcontest.ts, breadcrumbs.ts
  consts.ts            Site name, nav, club coordinates.
  styles/
    tokens.css         Design tokens. Colours are light-dark() pairs.
    global.css         Reset, base elements, .container / .prose / .button primitives.
  layouts/
    BaseLayout.astro   <head>, header, main, footer. Theme no-flash script.
    PageLayout.astro   Interior page: breadcrumbs + h1 + slot.
  components/          Header, Nav, Footer, Breadcrumbs, ThemeToggle, Logo.
  pages/
    index.astro        Homepage hero.
    news/, siti/       Index + entry routes for the two collections.
    og/[...route].jpg  Generated social cards, cached by content hash.
    styleguide.astro   Design-system reference — DELETE before going live.
public/                Favicons and the OG social card, copied from the vr theme.
keystatic.config.ts    The editing UI's schema. Must agree with content.config.ts.
docs/                  Documentation for humans and agents.
scripts/shot.mjs       Headless-Chrome screenshot + layout measurement, no deps.
```

## Things worth knowing

**Theming.** Every colour token is a `light-dark()` pair and the only thing the toggle
changes is `color-scheme` on `<html>`. So "auto" is genuinely the absence of an override
rather than a third palette, and there is one definition per colour instead of three.
Adding a colour means adding one line to `tokens.css`.

**Redirects live in `netlify.toml`, not `astro.config.mjs`.** Astro's `redirects` option
only emits real 301s when a host adapter is present; without one it writes meta-refresh
HTML pages, which pass no ranking signal. See the comment in `astro.config.mjs`.

**No adapter yet.** The site is fully prerendered, so it doesn't need one. `@astrojs/netlify`
goes in at Phase 3, when Keystatic's admin routes need on-demand rendering — adding it
early costs a ~3.6 MB SSR function on every deploy for nothing.

**URLs are load-bearing.** `build.format: 'directory'` is what makes `/siti/montoso/`
resolve the same way the Tome export did. Don't change it. The full URL inventory the
migration must preserve is in `MIGRATION-PLAN.md` §3.

**The old site is the reference.** `../ventorelativo-drupal` stays around read-only.
Its committed `html/` directory is the byte-level output to diff against — particularly
for the OpenAir and CUP flight-computer files in Phase 4.
