# How this site is built

Written for someone who has not used Astro before, and for agents that need to
know why things are arranged this way. Concepts first, then how this repo uses
them.

## 1. The build model: HTML now, not HTML later

Astro renders pages **at build time**, on your machine or on Netlify's build
server, and writes plain `.html` files. The visitor's browser downloads finished
HTML. There is no framework booting up, no data fetching on load, no server
executing anything per request.

```
src/pages/index.astro  ──[ npm run build ]──▶  dist/index.html + hashed CSS/images
```

`astro.config.mjs` sets `output: 'static'`, which is this and only this. Two
consequences worth internalising:

- **Anything in a component's frontmatter runs once, at build, and never reaches
  the browser.** Secrets, file reads and heavy computation are all fine there.
- **There is no server to hold state.** Contact form submissions go to Netlify
  Forms; nothing else needs a backend.

Astro's other mode (`server`, with an _adapter_) renders per request. We
deliberately have no adapter yet: adding one emits a ~3.6 MB serverless function
on every deploy even when every page is prerendered. It arrives in Phase 3, when
Keystatic's admin routes genuinely need to run server-side.

## 2. Routing is the file tree

Every file in `src/pages/` becomes a URL. No router to configure.

| File                                      | URL                   |
| ----------------------------------------- | --------------------- |
| `src/pages/index.astro`                   | `/`                   |
| `src/pages/styleguide.astro`              | `/styleguide/`        |
| `src/pages/siti/[slug].astro` _(Phase 4)_ | `/siti/montoso/` etc. |

`build.format: 'directory'` makes Astro write `styleguide/index.html` rather than
`styleguide.html`, so the URL is `/styleguide/`. That exactly matches what the
old Drupal/Tome export produced — which is why the config comment tells you not
to change it. URLs are the one thing a migration cannot silently alter.

Files in `public/` are copied to the site root untouched (favicons, the social
card). Files in `src/` are processed. That distinction matters — see §5.

## 3. Anatomy of an `.astro` file

```astro
---
// FRONTMATTER — JavaScript/TypeScript. Runs at build time, on the server.
// Never shipped to the browser.
import Logo from '../components/Logo.astro';
const items = ['a', 'b'];
---

<!-- TEMPLATE — HTML with {expressions}. -->
<ul>{items.map((i) => <li>{i}</li>)}</ul>

<style>
  /* SCOPED CSS. Astro rewrites these selectors so they only hit this file. */
  ul {
    display: flex;
  }
</style>

<script>
  // CLIENT JS. Bundled, deferred, runs in the browser. Optional and rare here.
</script>
```

Three separate worlds in one file: build-time logic, markup, and (only when
needed) browser code. Most components in this repo have no `<script>` at all —
[`ThemeToggle.astro`](../src/components/ThemeToggle.astro) and
[`Nav.astro`](../src/components/Nav.astro) are the exceptions.

### Scoped styles, and the trap in them

Astro scopes `<style>` by stamping a `data-astro-cid-*` attribute onto the
elements _this file_ writes, and rewriting selectors to match. Two things follow:

- Styling something rendered by another component does not work by default. Use
  `:global(selector)` to opt out of scoping deliberately.
- When you put `class="x"` on a _component_, that class is forwarded to whatever
  that component treats as its root element — which may not be the element you
  pictured.

That second point caused a real bug: `<Picture class="hero__bg">` puts the class
on the inner `<img>`, so `position: absolute` never reached the wrapping
`<picture>`, which stayed in flow as an extra grid row and pushed the hero
content downward. The fix is `.hero :global(picture) { position: absolute }` —
see the comment in [`index.astro`](../src/pages/index.astro).

## 4. Layouts and slots

A layout is just a component that renders `<slot />` where the page's content
goes. This repo has two, one wrapping the other:

```
BaseLayout.astro     <head>, skip link, Header, <main><slot/></main>, Footer
  └─ PageLayout.astro   breadcrumbs + <h1> + <slot/>, for interior pages
       └─ your page
```

The homepage skips `PageLayout` and passes `bare` to `BaseLayout`, which makes
the header transparent and lets the hero own the viewport.

**Layout composition is where "every page has X" belongs.** If a change should
appear on all pages, it goes in a layout, not copied into pages.

## 5. Images: `src/assets/` vs `public/`

`astro:assets` (`<Image>`, `<Picture>`) processes images imported from `src/`:
it generates modern formats (avif/webp), resizes to the widths you ask for,
fingerprints the filename for permanent caching, and — importantly — writes
`width`/`height` into the markup so the browser reserves space and the page does
not jump as images load.

```astro
---
import { Picture } from 'astro:assets';
// An import, not a path string — that is what makes the pipeline run.
import { HERO } from '../assets/hero';
---

<Picture
  src={HERO.src}
  formats={['avif', 'webp']}
  widths={[800, 1200, 1600]}
  sizes="100vw"
  alt=""
/>
```

Put an image in `src/assets/` when you want that. Put it in `public/` only when
the exact filename must survive (favicons, `social-card.png`, and later the
flight-data files).

[`src/assets/hero.ts`](../src/assets/hero.ts) shows the pattern this repo prefers:
the image and its photo credit are one object, so a page that does not render the
picture has no credit to render, and the two cannot drift apart.

## 6. The styling system

There is no CSS framework. Bootstrap was removed on purpose.

- [`tokens.css`](../src/styles/tokens.css) — every colour, space, size, radius and
  duration, as custom properties.
- [`global.css`](../src/styles/global.css) — reset, base element styles, and four
  primitives: `.container`, `.prose`, `.button`, `.visually-hidden`.
- Everything else is scoped to its component.

**Dark mode is one line of thinking.** Each colour is a `light-dark(a, b)` pair,
`:root` sets `color-scheme: light dark`, and the theme toggle's _only_ job is to
pin `color-scheme` to `light` or `dark` via a `data-theme` attribute. So:

- "Auto" is genuinely the absence of an override, not a third palette.
- Adding a colour means adding one line, not three.
- A component never needs a dark-mode block. If you find yourself writing one,
  the colour belongs in `tokens.css` instead.

A no-flash inline script in `BaseLayout`'s `<head>` reads `localStorage` before
first paint, so a chosen theme does not flash the wrong colours on load. It must
stay inline and synchronous to work.

## 7. What is deliberately absent

| Absent                              | Why                                            | Arrives |
| ----------------------------------- | ---------------------------------------------- | ------- |
| Content collections, `src/content/` | Content migration not started                  | Phase 2 |
| Keystatic CMS, `/keystatic`         | Needs GitHub App + server routes               | Phase 3 |
| Netlify adapter                     | Dead 3.6 MB function until something needs SSR | Phase 3 |
| Maps, flight data                   | Riskiest part, deliberately last               | Phase 4 |
| Any UI framework (React etc.)       | Nothing here needs one                         | if ever |

Astro _can_ run React/Vue/Svelte components as "islands" — interactive
components hydrated individually while the rest stays static HTML. This site has
no islands and needs none; the two interactive pieces are a `<dialog>` and three
radio buttons.

## 8. Dev server vs build

`npm run dev` serves modules through Vite with hot reloading; `npm run build`
does the real thing. They are not identical, and one difference has already
bitten: **the dev server can serve stale scoped CSS** after an edit, so the
markup updates while the styles do not. Restart it. See
[`verifying-changes.md`](verifying-changes.md).

When something looks wrong, `npm run build && npm run preview` is the
authoritative answer.
