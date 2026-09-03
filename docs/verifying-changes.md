# Verifying a change

The rule behind this page: **a layout claim you have not measured is a guess.**
Both bugs fixed on 2026-09-01 were invisible in the CSS and unmissable in a
measurement.

## The gate

```
npm run verify        # astro check (types + templates) then a full build
```

Must end with 0 errors and 0 warnings, and the build must complete. Run it before
telling anyone the work is done.

## Measuring a page

```
npm run shot -- http://localhost:4321/ --measure ".hero,footer"
```

Output:

```
http://localhost:4321/  390x844  light
  document      390x844
  scrolls       vertical: no   horizontal: no
  .hero         top=0 bottom=711 h=711
  footer        top=711 bottom=844 h=133
  screenshot    .astro/shots/home-390x844-light.png
```

Options:

| Flag                | Meaning                                                    |
| ------------------- | ---------------------------------------------------------- |
| `--size 390x844`    | viewport; repeatable; defaults to `390x844` and `1440x900` |
| `--dark`            | emulate `prefers-color-scheme: dark`                       |
| `--measure ".a,.b"` | report the box of each selector                            |
| `--out <dir>`       | where PNGs land (default `.astro/shots`, git-ignored)      |
| `--no-shot`         | numbers only                                               |

It exits non-zero if anything overflows the viewport horizontally, so it can gate
a script. Screenshots can be opened by a human, or read directly by an agent that
can see images.

### Why this instead of `chrome --headless --screenshot --window-size=390,844`

Because that lies. Headless Chrome on macOS clamps its window to a **500px
minimum width**, so it lays the page out at 500px and crops the picture to 390.
Every media query below 500px behaves wrongly, and the crop looks exactly like a
horizontal-overflow bug, which is precisely the false alarm it produced here
once. `scripts/shot.mjs` drives Chrome over the DevTools Protocol and sets device
metrics the way the browser's own device toolbar does, so 390 means 390.

The script has no dependencies: Node's built-in WebSocket talks to Chrome
directly. It needs Google Chrome or Chromium installed; set `CHROME_PATH` if it
lives somewhere unusual.

### Light is emulated as explicitly as dark

It did not used to be. The script set `prefers-color-scheme` only for `--dark`
and left it unset otherwise, so Chrome followed the host OS, and on a Mac in
dark appearance every file named `…-light.png` held a dark screenshot, with
nothing to say so. Both directions are now set explicitly. Distrust any light
shot taken before 2026-09-03.

## The three gates in `npm run verify`

Beyond types, lint and the build, `verify` runs five checks that exist because
each guards a promise the site makes and cannot keep by accident:

| Gate                     | Fails when                                                        |
| ------------------------ | ----------------------------------------------------------------- |
| `npm run navdata:check`  | the flight-computer files stop matching the archived Drupal build |
| `npm run urls:check`     | a URL the old site served stops resolving                         |
| `npm run sitemap:check`  | a built page is missing from `/sitemap.xml`, or listed and absent |
| `npm run privacy:check`  | a page starts loading something third-party unasked               |
| `npm run headings:check` | an `h2` reaches `dist/` with no `id`, or two share one on a page  |

All five read `dist/`, so they need a build first: `verify` does that for them.
All five were proved by being broken on purpose: removing a built page, pointing
a redirect at nothing, deleting a sitemap entry, dropping a Google Fonts link
into a page.

`urls:check` and `navdata:check` read `../ventorelativo-drupal`. That archive is
the evidence, which is why Phase 5 archives it rather than deleting it.

## Lighthouse, for the things a screenshot cannot show

`npm run shot` answers "does it fit and read". It says nothing about whether a
control has a name, whether the headings step in order, or whether text clears
its background. Chrome's own audit does, and it is worth running against the
**build** whenever markup changes.

Through the chrome-devtools MCP server: navigate a page, then run the audit at
`device: mobile`. It covers accessibility, best practices, SEO and agentic
browsing, not performance, which `npm run weight` and a throttled trace cover
better.

All seven page types scored **100 in every category** on 2026-09-03. Getting
there took three fixes, and all three are the kind that look fine on screen:

- the gallery's links had no accessible name, because the thumbnail inside them
  carries `alt=""` on purpose and nothing else named the link;
- the category badge sat at 4.43:1 against its own 10% wash in dark mode, under
  the 4.5:1 its size needs;
- `/iscrizioni` opened its body with an `h3` under the page's `h1`.

## Checklist for a visual change

- [ ] `npm run verify` clean
- [ ] Measured at **390x844** (phone) and **1440x900** (laptop)
- [ ] Checked in **both colour schemes**: run again with `--dark`
- [ ] No unintended vertical scrolling; no horizontal scrolling at all
- [ ] Text still legible where it sits over a photograph
- [ ] Interactive controls reachable by keyboard, with a visible focus ring
- [ ] Every control has an accessible name (visible text, or visually-hidden text
      beside an `aria-hidden` icon)
- [ ] Lighthouse still 100 on the page you changed, if you touched its markup

## Traps

### The dev server goes stale

Two versions of this, and the second is the one that wastes an afternoon.

**Stale CSS.** You edit a `<style>` block, the browser shows the old layout, and
the markup changes from the same edit _do_ appear. Vite's transform cache for
that style module did not invalidate. Confirm it with `curl
http://localhost:4321/`, which shows the new CSS while the browser's computed
styles show the old rule.

**Stale pages after a config change.** Add an integration or an adapter to
`astro.config.mjs` and the running server can carry on serving pages built
before it: entire new components missing, no error anywhere. This reads exactly
like code that does not work.

**Telling them apart takes one command.** Build, and compare:

```
npm run build
grep -c 'class="poster' dist/siti/montoso/index.html        # 1
curl -s http://localhost:4321/siti/montoso/ | grep -c poster # 0  → stale server
```

If it is in `dist/` and not on `:4321`, the code is fine and the server is not.

**Fix:** `npx astro dev stop`, `npm run dev`, hard-reload (⌘⇧R / Ctrl⇧R). A
server started by hand rather than with `--background` is not managed by that
command and has to be stopped in the terminal it is running in.

If in doubt, `npm run build && npm run preview` bypasses the dev pipeline
entirely and is always authoritative.

### `dist/` is generated

Editing built output changes nothing durable: the next build overwrites it, and
it is git-ignored. Change the source.

### Astro's `<Image>` / `<Picture>` put your class on the `<img>`

Not on the `<picture>` wrapper. To style or position the wrapper, use
`:global(picture)` inside the parent's scoped styles.

## How many dev servers are running?

```
npx astro dev status     # port, pid, uptime
npx astro dev logs -f    # follow output
npx astro dev stop       # stop it
```

Astro runs the dev server as a managed background process and holds a lock, so
there is normally exactly one. If a port seems occupied by something else,
`lsof -nP -iTCP -sTCP:LISTEN` lists every listener on the machine.
