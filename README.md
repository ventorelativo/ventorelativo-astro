# Ventorelativo

Website of **Ventorelativo**, a paragliding club (*Parapendio Club*) between Pinerolo,
Val Chisone and Val Pellice. Content is in Italian.

Astro, statically built, deployed to Netlify. Replaces the Drupal 11 + Tome site in
`../ventorelativo-drupal`.

> **Migration in progress.** [`MIGRATION-PLAN.md`](MIGRATION-PLAN.md) is the source of
> truth for what is being built, what has been decided (D1–D13) and what is still open.
> **Phase 1 (skeleton & design system) is done.** Phase 2 is content.

## Documentation

| Where | What |
|---|---|
| [`docs/how-to.md`](docs/how-to.md) | Making a change: text, nav, colours, pages, images. Start here. |
| [`docs/architecture.md`](docs/architecture.md) | How Astro builds this site, and why it is arranged this way. |
| [`docs/verifying-changes.md`](docs/verifying-changes.md) | Proving a change works, plus the traps that waste an afternoon. |
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

## Layout

```
src/
  assets/hero.ts       The homepage photo and its credit, kept as one object.
  consts.ts            Site name, nav, club coordinates. Moves to Keystatic in Phase 2.
  styles/
    tokens.css         Design tokens. Colours are light-dark() pairs.
    global.css         Reset, base elements, .container / .prose / .button primitives.
  layouts/
    BaseLayout.astro   <head>, header, main, footer. Theme no-flash script.
    PageLayout.astro   Interior page: breadcrumbs + h1 + slot.
  components/          Header, Nav, Footer, Breadcrumbs, ThemeToggle, Logo.
  pages/
    index.astro        Homepage hero.
    styleguide.astro   Design-system reference — DELETE at the end of Phase 2.
public/                Favicons and the OG social card, copied from the vr theme.
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
