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

| Flag | Meaning |
|---|---|
| `--size 390x844` | viewport; repeatable; defaults to `390x844` and `1440x900` |
| `--dark` | emulate `prefers-color-scheme: dark` |
| `--measure ".a,.b"` | report the box of each selector |
| `--out <dir>` | where PNGs land (default `.astro/shots`, git-ignored) |
| `--no-shot` | numbers only |

It exits non-zero if anything overflows the viewport horizontally, so it can gate
a script. Screenshots can be opened by a human, or read directly by an agent that
can see images.

### Why this instead of `chrome --headless --screenshot --window-size=390,844`

Because that lies. Headless Chrome on macOS clamps its window to a **500px
minimum width**, so it lays the page out at 500px and crops the picture to 390.
Every media query below 500px behaves wrongly, and the crop looks exactly like a
horizontal-overflow bug — which is precisely the false alarm it produced here
once. `scripts/shot.mjs` drives Chrome over the DevTools Protocol and sets device
metrics the way the browser's own device toolbar does, so 390 means 390.

The script has no dependencies: Node's built-in WebSocket talks to Chrome
directly. It needs Google Chrome or Chromium installed; set `CHROME_PATH` if it
lives somewhere unusual.

## Checklist for a visual change

- [ ] `npm run verify` clean
- [ ] Measured at **390x844** (phone) and **1440x900** (laptop)
- [ ] Checked in **both colour schemes** — run again with `--dark`
- [ ] No unintended vertical scrolling; no horizontal scrolling at all
- [ ] Text still legible where it sits over a photograph
- [ ] Interactive controls reachable by keyboard, with a visible focus ring
- [ ] Every control has an accessible name (visible text, or visually-hidden text
      beside an `aria-hidden` icon)

## Traps

### The dev server can serve stale CSS

**Symptom:** you edit a `<style>` block, the browser shows the old layout, and
the markup changes from the same edit *do* appear.

**Cause:** Vite's transform cache for the component's style module did not
invalidate. The page is server-rendered fresh while the stylesheet it links is
from before your edit. You can confirm it: `curl http://localhost:4321/` shows
the new CSS while the browser's computed styles show the old rule.

**Fix:** `npx astro dev stop`, `npm run dev`, hard-reload (⌘⇧R / Ctrl⇧R).

If in doubt, `npm run build && npm run preview` bypasses the dev pipeline
entirely and is always authoritative.

### `dist/` is generated

Editing built output changes nothing durable — the next build overwrites it, and
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
