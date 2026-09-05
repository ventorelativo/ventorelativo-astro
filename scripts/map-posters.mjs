#!/usr/bin/env node
/**
 * The map, as it looks once it has finished arriving, captured at build time.
 *
 * The facade used to be a flat rectangle of the basemap's paper colour, and
 * before that a drawing. Both were placeholders for a map, and a visitor got
 * the real thing only by paying for it: on /siti/ the interactive map opened
 * itself, which cost 6.5 MB of terrain tiles and eight seconds of blocked main
 * thread on a mid-range phone. This renders each map once, here, and ships the
 * result as an image. Opening the real map is still one tap away.
 *
 * Two captures per map, because the frame is 600px tall at every width: a
 * phone gets a portrait box and a laptop a wide one, and MapLibre frames its
 * bounds for the viewport it is given. Cropping one into the other would cut
 * sites off the edge of the overview.
 *
 *   npm run map:posters            only what changed
 *   npm run map:posters -- --force everything
 *   npm run map:posters -- --only montoso
 *
 * Needs a build first: it drives Chrome against `dist/`, so what is captured
 * is what is deployed. Requires a MapTiler key in the environment, like the
 * site itself; without one the map draws nothing and the run aborts.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { CDP } from './cdp.mjs';

const OUT_DIR = 'src/assets/map-posters';
const MANIFEST = join(OUT_DIR, 'manifest.json');
const DIST = 'dist';

/*
  One capture, in a viewport wide enough for the container to reach its own
  maximum (68rem), which is where the map stops growing. A narrower viewport shows the middle of it, which is
  what the live map does when the window shrinks: same centre, less of the
  sides. So the poster is displayed as a centred crop rather than re-captured
  per breakpoint.
*/
const SHAPE = { width: 1280, height: 600 };
const SCALE = 2;

/*
  Bumped when the capture itself changes: a different size, a different wait,
  a different style. The manifest hashes the map's own data too, so a moved
  takeoff re-captures on its own.
*/
const CAPTURE_VERSION = 1;

const args = process.argv.slice(2);
const force = args.includes('--force');
/*
  `--check` answers "is any poster stale?" without opening a browser: the
  manifest records the hash of the map data each still was rendered from, so a
  moved takeoff or a new site fails the build instead of shipping a picture
  that no longer matches the map behind it.
*/
const check = args.includes('--check');
// `indexOf` returns -1 when the flag is absent, which would read args[0].
const onlyAt = args.indexOf('--only');
const only = onlyAt === -1 ? null : args[onlyAt + 1];

// --------------------------------------------------------------- the pages

/** Every built page with a map on it, and the name its poster takes. */
async function mapPages() {
  const pages = [{ slug: 'overview', url: '/siti/' }];
  for (const entry of await readdir(join(DIST, 'siti'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    pages.push({ slug: entry.name, url: `/siti/${entry.name}/` });
  }
  return only ? pages.filter((p) => p.slug === only) : pages;
}

/**
 * What the built page tells the map to draw.
 *
 * The geometry, the colours and the icons all arrive as JSON in the page, so
 * hashing it answers "would this capture look different" without rendering
 * anything. A page with no map data has no map.
 */
async function inputHash(url) {
  const html = await readFile(join(DIST, url.replace(/^\//, ''), 'index.html'), 'utf8');
  const data = html.match(/data-map-data[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!data) return null;
  return createHash('sha256')
    .update(`v${CAPTURE_VERSION}\n`)
    .update(data)
    .digest('hex')
    .slice(0, 16);
}

// -------------------------------------------------------- the static server

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function serve(root) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    const file = path.endsWith('/') ? join(root, path, 'index.html') : join(root, path);
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, port: server.address().port }),
    );
  });
}

// -------------------------------------------------------------------- chrome

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
  .filter(Boolean)
  .find((p) => existsSync(p));

if (!CHROME) {
  console.error('No Chrome found. Set CHROME_PATH to its binary.');
  process.exit(1);
}

/*
  SwiftShader, not the GPU: this has to produce the same image on a build
  machine that has no display, and Chrome's `--disable-gpu` gives a WebGL
  context that draws nothing at all rather than failing loudly.
*/
const chrome = check
  ? { kill() {}, stderr: { on() {} } }
  : spawn(CHROME, [
      '--headless=new',
      /*
    The real GPU, not SwiftShader: a terrain map in software renders, slowly,
    and the posters are generated on a developer's machine and committed, so
    nothing here has to run where there is no GPU.
  */
      '--use-angle=metal',
      // A backgrounded renderer throttles rAF, which is MapLibre's render loop.
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${join(tmpdir(), `vr-posters-${process.pid}`)}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ]);

const wsUrl = check
  ? null
  : await new Promise((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => reject(new Error('Chrome did not start')), 20_000);
      chrome.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/ws:\/\/\S+/);
        if (m) {
          clearTimeout(timer);
          resolve(m[0]);
        }
      });
    });

const cdp = check ? null : await CDP.connect(wsUrl);
const { server, port } = check ? { server: null, port: 0 } : await serve(DIST);

/** Runs an expression in the page and hands back its value. */
async function evaluate(sessionId, expression) {
  const { result } = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  return result.value;
}

/**
 * Capture one map, once it has stopped moving.
 *
 * There is no event for "the terrain has risen, the camera has been re-framed
 * and every tile is in": `idle` fires between the animations, and waiting a
 * fixed number of seconds is a guess that is wrong on both sides. So the frame
 * itself is the signal: shoot it repeatedly and stop when two in a row come
 * back identical, which is exactly the condition being waited for.
 */
async function capture(url) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Page.bringToFront', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      {
        width: SHAPE.width,
        // Taller than the frame, so the map is on screen without scrolling
        // the header off and re-laying anything out.
        height: SHAPE.height + 400,
        deviceScaleFactor: SCALE,
        mobile: false,
      },
      sessionId,
    );

    const loaded = cdp.once('Page.loadEventFired', (p) => p.sessionId === sessionId);
    await cdp.send(
      'Page.navigate',
      { url: `http://127.0.0.1:${port}${url}` },
      sessionId,
    );
    await loaded;

    // The button, so the capture takes the same path a visitor's tap does.
    const opened = await evaluate(
      sessionId,
      `(() => { const b = document.querySelector('[data-map-open]'); if (!b) return false; b.click(); return true; })()`,
    );
    if (!opened) throw new Error('no map on this page');

    /*
      Page coordinates, not viewport ones: `clip` is measured from the document
      origin whatever the page is scrolled to, and reading the rect straight
      off the element captured the header instead of the map.
    */
    const clip = async () => {
      const box = await evaluate(
        sessionId,
        `(() => { const c = document.querySelector('.map canvas'); if (!c) return null;
           const r = c.getBoundingClientRect();
           return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`,
      );
      return box;
    };

    // Into view, so the frame is captured from the viewport rather than from
    // beyond it: `captureBeyondViewport` re-lays the page out and the map
    // resizes under the capture.
    await evaluate(
      sessionId,
      `document.querySelector('.map').scrollIntoView({ block: 'start', behavior: 'instant' })`,
    );

    /*
      Wait for the map to say it has arrived.

      Comparing consecutive frames does not work: a MapLibre map repaints
      continuously, and under software rendering two captures are never
      byte-identical. `data-map-ready` is set by the component at the one
      moment that matters, when the terrain has risen and the last re-framing
      pass found nothing left to correct.
    */
    const deadline = Date.now() + 120_000;
    let ready = false;
    while (Date.now() < deadline) {
      ready = await evaluate(
        sessionId,
        `document.querySelector('.map')?.dataset.mapReady !== undefined`,
      );
      if (ready) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) throw new Error(`${url}: the map never signalled ready`);

    /*
      The controls come out, the attribution stays.

      A picture of a zoom button cannot be pressed or focused, and the real
      ones appear in the same place the moment the map opens. The attribution
      is not decoration: it is the condition on which the tiles are used, and
      this file is a rendering of them.
    */
    await evaluate(
      sessionId,
      `document.querySelectorAll('.map .maplibregl-ctrl-group').forEach((n) => { n.style.display = 'none'; })`,
    );
    // One more paint after the signal, so the last frame is the one captured.
    await new Promise((r) => setTimeout(r, 600));

    const box = await clip();
    /*
      The surface capture, which is the one that honours `clip`: the renderer
      path (`fromSurface: false`) ignores it and hands back the whole viewport,
      header and all. The surface only settles once the map has stopped
      animating, which is exactly what `data-map-ready` waited for.
    */
    const settled = await Promise.race([
      cdp
        .send(
          /*
            WebP at capture, not PNG: the same frame is 1.5 MB lossless and
            about a fifth of that at quality 85, with no difference anyone can
            see on a shaded relief map. This file is the source the image
            pipeline re-encodes from, and it lives in the repository.
          */
          'Page.captureScreenshot',
          {
            format: 'webp',
            quality: 85,
            clip: { ...box, scale: 1 },
          },
          sessionId,
        )
        .then(
          (r) => r.data,
          () => null,
        ),
      new Promise((r) => setTimeout(() => r(null), 30_000)),
    ]);

    if (!settled) throw new Error(`${url}: the capture timed out`);
    return Buffer.from(settled, 'base64');
  } finally {
    await cdp.send('Target.closeTarget', { targetId });
  }
}

// ---------------------------------------------------------------------- main

let failed = false;
try {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = existsSync(MANIFEST)
    ? JSON.parse(await readFile(MANIFEST, 'utf8'))
    : {};
  const pages = await mapPages();
  let captured = 0;
  const stale = [];

  for (const { slug, url } of pages) {
    const hash = await inputHash(url);
    if (!hash) {
      console.log(`  ${slug.padEnd(22)} no map on the page, skipped`);
      continue;
    }
    if (
      !force &&
      manifest[slug]?.hash === hash &&
      existsSync(join(OUT_DIR, `${slug}.webp`))
    ) {
      console.log(`  ${slug.padEnd(22)} unchanged`);
      continue;
    }
    if (check) {
      stale.push(slug);
      continue;
    }
    process.stdout.write(`  ${slug.padEnd(22)} capturing…`);
    const png = await capture(url);
    await writeFile(join(OUT_DIR, `${slug}.webp`), png);
    console.log(
      `\r  ${slug.padEnd(22)} ${String(Math.round(png.length / 1024)).padStart(4)} kB   `,
    );
    manifest[slug] = { hash };
    captured++;
  }

  if (check) {
    if (stale.length) {
      console.error(
        `\n${stale.length} map poster(s) out of date: ${stale.join(', ')}.` +
          `\n    Run: npm run map:posters\n`,
      );
      failed = true;
    } else {
      console.log(`map posters ok: ${pages.length} up to date`);
    }
  } else {
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(captured ? `\n${captured} map(s) captured.` : '\nNothing to do.');
  }
} catch (error) {
  failed = true;
  console.error(`\n${error.message}\n`);
} finally {
  cdp?.close();
  chrome.kill();
  server?.close();
  process.exit(failed ? 1 : 0);
}
