# How to make common changes

Recipes for the changes that actually come up. Each says which file to open and
what to watch for. If you are asking an AI agent to do one of these, pasting the
recipe into your request is a good way to get the result you meant.

Before starting: `npm install`, then `npm run dev`, then open
<http://localhost:4321>. After finishing: `npm run verify`.

---

## Edit news, flight sites or the fixed pages — without touching files

```
npm run dev
```

then open <http://localhost:4321/keystatic>. That is a full editor: news posts,
the fourteen flight sites, and the three fixed pages, with image upload and a
rich-text body. It writes to the files in this working copy, so your changes
show up as ordinary edits to commit.

It runs only under `npm run dev` for now — it needs a server, and the published
site deliberately has none. Phase 3 moves it to the live site, where the club
edits in a browser.

**Batching edits.** Once it is live, Keystatic can work on a *branch*: pick one
in the branch menu, make as many changes as you like, then merge when the batch
is ready. With Netlify set to build only `main`, that is one rebuild for the
whole session rather than one per save — and half-finished edits never appear on
the public site.

Everything below is the same job done by hand, which is still fine.

## Change the club name, slogan, email or site description

[`src/consts.ts`](../src/consts.ts) — the `SITE` object. The description is the
text search engines show under the title.

## Add, remove or reorder a navigation item

[`src/consts.ts`](../src/consts.ts) — the `NAV` array. Order in the array is the
order on screen, in both the desktop bar and the mobile drawer (one list is
rendered once and shown two ways, so there is nothing to keep in sync).

```ts
export const NAV = [
  { label: 'Siti', href: '/siti' },
  { label: 'Voli', href: '/voli' },
  // ...
] as const;
```

A nav entry does not create a page — see the next recipe.

## Add a new page

Create a file in `src/pages/`. Its path becomes its URL:
`src/pages/scuola.astro` → `/scuola/`.

```astro
---
import PageLayout from '../layouts/PageLayout.astro';
---

<PageLayout
  title="Scuola"
  description="Una frase per Google e per le anteprime social."
  intro="Un'introduzione opzionale sotto il titolo."
>
  <div class="prose">
    <p>Il contenuto della pagina.</p>
  </div>
</PageLayout>
```

`PageLayout` supplies the breadcrumbs, the `<h1>` and the page shell. `.prose`
constrains the text to a readable column width and spaces the paragraphs. Write
the visible text in Italian.

## Change a colour, spacing or font size

[`src/styles/tokens.css`](../src/styles/tokens.css). One line per value.

Colours are `light-dark(lightValue, darkValue)` pairs — edit the pair and both
themes follow. **Do not** add a `@media (prefers-color-scheme: dark)` block or a
hex value inside a component; that is the thing this system exists to avoid.

`/styleguide` renders every token and primitive on one page. Open it after a
token change to see what you affected.

## Add an image to a page

Put the file in `src/assets/`, import it, and render it with `<Image>`:

```astro
---
import { Image } from 'astro:assets';
import lancio from '../assets/lancio.jpg';
---

<Image src={lancio} alt="Decollo dal Montoso in una mattina limpida" widths={[600, 1200]} sizes="(width < 40rem) 100vw, 600px" />
```

Astro converts, resizes and fingerprints it at build time. Always write a real
`alt` describing what is in the photo; use `alt=""` only when the image is purely
decorative and the page reads fine without it.

If a photo needs a credit, keep the credit with the image the way
[`src/assets/hero.ts`](../src/assets/hero.ts) does, so it cannot end up displayed
on a page where the photo isn't.

## Add a redirect

[`netlify.toml`](../netlify.toml), not `astro.config.mjs`:

```toml
[[redirects]]
  from = "/vecchio-indirizzo"
  to = "/nuovo-indirizzo"
  status = 301
  force = true
```

Astro's own `redirects` option would emit a meta-refresh HTML page here, which
search engines treat as a weak client-side hop rather than a real move.

## Change something that appears on every page

The header, footer, `<head>` tags and skip link live in
[`BaseLayout.astro`](../src/layouts/BaseLayout.astro) and the components it
renders. Change it once there rather than in each page.

## Save your changes

```
git add -A
git commit -m "Descrizione della modifica"
```

**There is no remote and no deployment yet** — this repository is local only, and
the live site is still the old Drupal one. Pushing to GitHub and automatic
Netlify builds arrive with Phase 3, and the domain switches over at Phase 5
(MIGRATION-PLAN.md §7). Until then, commit locally; nothing you do here is
visible to the public.

`netlify.toml` is already written and waiting: build command, redirects and cache
headers are configured, so connecting the repository later is a settings step,
not a code change.

---

## Things not to do

- Don't change `build.format` in `astro.config.mjs` — it would change every URL
  on the site.
- Don't add the Netlify adapter, or a CSS framework, or an icon package.
- Don't edit anything in `dist/` — it is regenerated by every build and your
  change would vanish.
- Don't touch `../ventorelativo-drupal`. It is the frozen reference copy of the
  old site.
- Don't hand-write the flight-computer files under `/api/navdata/` (Phase 4).
  Pilots load those into their instruments; they are generated and verified
  against the old site byte for byte.

## When something doesn't look right

If a style change does not show up in the browser, the dev server is probably
serving a stale stylesheet. `npx astro dev stop`, `npm run dev`, hard-reload.
Full detail in [`verifying-changes.md`](verifying-changes.md).
