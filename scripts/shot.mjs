#!/usr/bin/env node
/**
 * Screenshot + measure a page in a real emulated viewport.
 *
 * Why this exists: this site's design gate is "does it fit and read on a
 * phone", and that cannot be answered by reading CSS. Two bugs on 2026-09-01
 * were both invisible in the source and obvious in a measurement.
 *
 * Why not `chrome --screenshot --window-size=390,844`: headless Chrome clamps
 * the window to a 500px minimum width on macOS, so it silently renders a 500px
 * layout and crops it to 390. Every media query below 500px lies. This drives
 * Chrome over the DevTools Protocol and uses Emulation.setDeviceMetricsOverride
 * instead, which is what devtools' own device toolbar uses.
 *
 * No dependencies: Node's built-in WebSocket (v22+) talks to Chrome directly.
 *
 *   node scripts/shot.mjs <url> [options]
 *     --size 390x844      viewport, repeatable (default: 390x844 and 1440x900)
 *     --dark              emulate prefers-color-scheme: dark
 *     --out <dir>         where PNGs go (default: .astro/shots)
 *     --measure <sel,...> extra selectors to report boxes for
 *     --click <sel>       click this element first (menus, drawers, disclosures)
 *     --no-shot           measure only, skip the PNGs
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    console.error(
      'No Chrome found. Install Google Chrome, or set CHROME_PATH to its binary.',
    );
    process.exit(1);
  }
  return found;
}

// ----------------------------------------------------------------- CLI parse

function parseArgs(argv) {
  const opts = {
    sizes: [],
    dark: false,
    out: '.astro/shots',
    measure: [],
    shot: true,
    click: null,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--size') opts.sizes.push(argv[++i]);
    else if (a === '--dark') opts.dark = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--measure') opts.measure = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--click') opts.click = argv[++i];
    else if (a === '--no-shot') opts.shot = false;
    else rest.push(a);
  }
  if (!opts.sizes.length) opts.sizes = ['390x844', '1440x900'];
  opts.url = rest[0] ?? 'http://localhost:4321/';
  return opts;
}

// ------------------------------------------------------------- CDP transport

/** Minimal DevTools Protocol client: one socket, flat sessions, promise per id. */
class CDP {
  #ws;
  #id = 0;
  #pending = new Map();
  #handlers = new Map();

  static async connect(wsUrl) {
    const cdp = new CDP();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      cdp.#ws.addEventListener('open', res, { once: true });
      cdp.#ws.addEventListener('error', rej, { once: true });
    });
    cdp.#ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && cdp.#pending.has(msg.id)) {
        const { resolve, reject } = cdp.#pending.get(msg.id);
        cdp.#pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of cdp.#handlers.get(msg.method) ?? []) fn(msg.params);
      }
    });
    return cdp;
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  on(method, fn) {
    if (!this.#handlers.has(method)) this.#handlers.set(method, []);
    this.#handlers.get(method).push(fn);
  }

  once(method, predicate = () => true) {
    return new Promise((resolve) => {
      this.on(method, (params) => predicate(params) && resolve(params));
    });
  }

  close() {
    this.#ws.close();
  }
}

// ------------------------------------------------------- in-page measurement

/**
 * Runs inside the page. Reports the two things that actually go wrong —
 * unintended scrolling and elements escaping the viewport — plus the boxes of
 * whatever selectors were asked for.
 */
function measureInPage(selectors) {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      const cls = typeof el.className === 'string' ? el.className : '';
      overflow.push(
        `${el.tagName.toLowerCase()}${cls ? '.' + cls.trim().split(/\s+/).join('.') : ''}` +
          ` (${r.left.toFixed(0)}..${r.right.toFixed(0)})`,
      );
    }
  }
  const boxes = {};
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) {
      boxes[sel] = null;
      continue;
    }
    const r = el.getBoundingClientRect();
    boxes[sel] = {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
    };
  }
  return {
    viewport: `${vw}x${vh}`,
    scroll: `${de.scrollWidth}x${de.scrollHeight}`,
    scrollsVertically: de.scrollHeight > vh + 1,
    scrollsHorizontally: de.scrollWidth > vw + 1,
    overflow: overflow.slice(0, 10),
    boxes,
  };
}

// --------------------------------------------------------------------- main

const opts = parseArgs(process.argv.slice(2));
const profile = join(tmpdir(), `vr-shot-${process.pid}`);
const chrome = spawn(findChrome(), [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
]);

const wsUrl = await new Promise((resolve, reject) => {
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

const cdp = await CDP.connect(wsUrl);
let failed = false;

try {
  await mkdir(opts.out, { recursive: true });

  for (const size of opts.sizes) {
    const [width, height] = size.split('x').map(Number);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId);
    // The real fix for the 500px window floor: emulate metrics, don't resize.
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 2, mobile: width < 700 },
      sessionId,
    );
    if (opts.dark) {
      await cdp.send(
        'Emulation.setEmulatedMedia',
        { features: [{ name: 'prefers-color-scheme', value: 'dark' }] },
        sessionId,
      );
    }

    const idle = cdp.once(
      'Page.lifecycleEvent',
      (p) => p.sessionId === sessionId && p.name === 'networkIdle',
    );
    await cdp.send('Page.navigate', { url: opts.url }, sessionId);
    await Promise.race([idle, new Promise((r) => setTimeout(r, 10_000))]);
    // Webfonts can reflow after networkIdle; one frame of slack.
    await new Promise((r) => setTimeout(r, 250));

    // Open whatever needs opening before measuring: a details panel, a dialog,
    // a drawer. Closed-state CSS is easy to review; open-state CSS is not.
    if (opts.click) {
      const { result: clicked } = await cdp.send(
        'Runtime.evaluate',
        {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(opts.click)});
            if (!el) return 'not found';
            el.click();
            return 'clicked';
          })()`,
          returnByValue: true,
        },
        sessionId,
      );
      if (clicked.value === 'not found') {
        console.error(`  ⚠ --click ${opts.click}: no such element`);
        failed = true;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const { result } = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(${measureInPage.toString()})(${JSON.stringify(opts.measure)})`,
        returnByValue: true,
      },
      sessionId,
    );
    const m = result.value;

    const scheme = opts.dark ? 'dark' : 'light';
    console.log(`\n${opts.url}  ${m.viewport}  ${scheme}`);
    console.log(`  document      ${m.scroll}`);
    console.log(
      `  scrolls       vertical: ${m.scrollsVertically ? 'YES' : 'no'}` +
        `   horizontal: ${m.scrollsHorizontally ? 'YES' : 'no'}`,
    );
    if (m.overflow.length) {
      failed = true;
      console.log(`  ⚠ off-viewport (horizontal):`);
      for (const o of m.overflow) console.log(`      ${o}`);
    }
    for (const [sel, box] of Object.entries(m.boxes)) {
      console.log(
        `  ${sel.padEnd(20)} ${
          box
            ? `top=${box.top} bottom=${box.bottom} h=${box.height}  left=${box.left} right=${box.right}`
            : 'not present'
        }`,
      );
    }

    if (opts.shot) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      const slug =
        new URL(opts.url).pathname.replace(/^\/|\/$/g, '').replace(/\W+/g, '-') || 'home';
      const name = `${slug}-${size}-${scheme}.png`;
      const file = join(opts.out, name);
      await writeFile(file, Buffer.from(data, 'base64'));
      console.log(`  screenshot    ${file}`);
    }

    await cdp.send('Target.closeTarget', { targetId });
  }
} finally {
  cdp.close();
  chrome.kill();
  // Chrome keeps writing to its profile for a moment after SIGTERM; deleting it
  // underneath throws ENOTEMPTY. Wait for the process, then sweep, and never
  // let a leftover temp directory fail the run.
  await Promise.race([
    new Promise((r) => chrome.once('exit', r)),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}

process.exit(failed ? 1 : 0);
