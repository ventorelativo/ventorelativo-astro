# How to make common changes

Recipes for the changes that actually come up. Each says which file to open and
what to watch for. If you are asking an AI agent to do one of these, pasting the
recipe into your request is a good way to get the result you meant.

Before starting: `npm install`, then `npm run dev`, then open
<http://localhost:4321>. After finishing: `npm run verify`.

---

## Edit news, flight sites or the fixed pages, without touching files

Go to **<https://ventorelativo-astro.netlify.app/keystatic>** and sign in with
GitHub. No checkout, no terminal, nothing to install. That is a full editor:
news posts, the fourteen flight sites, and the fixed pages, with image upload
and a rich-text body. Who may edit is decided by GitHub: write access to the
repository, and nothing else.

(After the cutover the address becomes `ventorelativo.it/keystatic`. Everything
else about it is the same.)

Locally, `npm run dev` then <http://localhost:4321/keystatic> gives the same
editor writing to the files in your working copy, with no login.

**A save publishes, unless you make a branch first.** Keystatic commits to
whichever branch the picker at the top left is showing, and that is `main` by
default: press Save there and the site rebuilds and goes live, with no preview
and nothing to approve. It only forces a branch when GitHub refuses the commit,
which needs a branch-protection rule on `main` that this repository does not
have.

So for anything you want to look at first, press **New branch...** on the
dashboard before you start. Keystatic names it `modifiche-…`, each entry then
carries a preview link to that branch's own deploy, and you merge once at the
end: one rebuild for the session rather than one per save.

Nothing is lost either way. A commit straight to `main` can be reverted in
GitHub.

Full runbook: [`deploying.md`](deploying.md).

## Draft a post with ChatGPT or Gemini

Open **`/redazione`**, copy the prompt for what you are writing, paste it into
whatever chat you use, and add your raw notes underneath. You get back a value
for every field, the text to paste into the body, and a list of what the model
could not fill in.

It works on a free account and needs nothing installed. The rules the model is
given, the club's tone, the fields, the things it must never invent, are one
document: [`src/authoring/istruzioni.md`](../src/authoring/istruzioni.md).
Change it there and `/redazione` follows; `npm run verify` fails if it stops
agreeing with the schemas.

**Read what comes back before you save it.** A model gets dates wrong with
total confidence. The reasoning, and what is deliberately not built, is in
[`authoring-with-ai.md`](authoring-with-ai.md).

Everything below is the same job done by hand, which is still fine.

## Change the club name, slogan, email or site description

[`src/consts.ts`](../src/consts.ts): the `SITE` object. The description is the
text search engines show under the title.

## Add, remove or reorder a navigation item

[`src/consts.ts`](../src/consts.ts): the `NAV` array. Order in the array is the
order on screen, in both the desktop bar and the mobile drawer (one list is
rendered once and shown two ways, so there is nothing to keep in sync).

```ts
export const NAV = [
  { label: 'Siti', href: '/siti' },
  { label: 'Voli', href: '/voli' },
  // ...
] as const;
```

A nav entry does not create a page: see the next recipe.

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

Colours are `light-dark(lightValue, darkValue)` pairs: edit the pair and both
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

<Image
  src={lancio}
  alt="Decollo dal Montoso in una mattina limpida"
  widths={[600, 1200]}
  sizes="(width < 40rem) 100vw, 600px"
/>
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
git push
```

**Pushing to `main` deploys.** Netlify builds every push and the result is live
within a couple of minutes: today at `ventorelativo-astro.netlify.app`, and at
`ventorelativo.it` once the domain moves (Phase 5, see
[`cutover.md`](cutover.md)). Editing through Keystatic does the same thing; it
commits on your behalf.

If you are making several related changes, push once at the end rather than per
commit. Each push is a build.

---

## Things not to do

- Don't change `build.format` in `astro.config.mjs`: it would change every URL
  on the site.
- Don't add a CSS framework or an icon package.
- Don't put `export const prerender = false` on a page. The Netlify adapter is
  installed, but only Keystatic's two admin routes use it; every other page is
  built as a file and served from the CDN, and moving one off it trades a file
  for a cold start.
- Don't edit anything in `dist/`: it is regenerated by every build and your
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
