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
 *     --click-wait <ms>   how long to wait after the click (default 700)
 *     --computed <sel,...> dump the computed styles that matter for a port
 *     --hover <sel>       park a real mouse pointer over this element first
 *     --reduced-motion    emulate prefers-reduced-motion: reduce
 *     --weight            report transferred bytes by resource type
 *     --eval <js>         evaluate an expression in the page and print it
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
    computed: [],
    hover: null,
    reducedMotion: false,
    weight: false,
    clickWait: 700,
    eval: null,
    webgl: false,
    console: false,
    requests: null,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--size') opts.sizes.push(argv[++i]);
    else if (a === '--dark') opts.dark = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--measure')
      opts.measure = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--click') opts.click = argv[++i];
    else if (a === '--click-wait') opts.clickWait = Number(argv[++i]);
    else if (a === '--eval') opts.eval = argv[++i];
    else if (a === '--hover') opts.hover = argv[++i];
    else if (a === '--reduced-motion') opts.reducedMotion = true;
    else if (a === '--weight') opts.weight = true;
    else if (a === '--webgl') opts.webgl = true;
    else if (a === '--console') opts.console = true;
    else if (a === '--requests') opts.requests = argv[++i];
    else if (a === '--computed')
      opts.computed = argv[++i].split(',').map((x) => x.trim());
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
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        // In flat mode the session is on the envelope, not in params. Merge it
        // in so handlers can tell which page an event came from.
        const params = { ...msg.params, sessionId: msg.sessionId };
        for (const fn of cdp.#handlers.get(msg.method) ?? []) fn(params);
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
function measureInPage(selectors, computedSelectors) {
  /** Does this element sit inside a box that scrolls sideways on purpose? */
  function insideScroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const style = getComputedStyle(p);
      const scrolls = style.overflowX === 'auto' || style.overflowX === 'scroll';
      if (scrolls && p.scrollWidth > p.clientWidth) return true;
    }
    return false;
  }

  const de = document.documentElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // Overlays legitimately park content off-screen — a lightbox's adjacent
    // slides, a drawer waiting to slide in. Only flow content can "overflow".
    if (el.closest('[role="dialog"], dialog, [aria-modal="true"]')) continue;
    /*
      Nor does content inside its own horizontal scroller overflow anything: a
      wide table in an `overflow-x: auto` wrapper is the fix for overflow, not
      an instance of it. Reported as a failure it trained the reader to ignore
      the warning, which is worse than not warning at all.
    */
    if (insideScroller(el)) continue;
    /*
      Nor does the inside of a closed <details>. Chrome hides it with
      `content-visibility`, which still reports a box, so a drawer parked
      off-screen until it opens looked like content escaping the viewport.
    */
    const closed = el.closest('details:not([open])');
    if (closed && !el.closest('summary')) continue;
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
  const computed = {};
  for (const sel of computedSelectors) {
    const el = document.querySelector(sel);
    if (!el) {
      computed[sel] = null;
      continue;
    }
    const cs = getComputedStyle(el);
    const props = [
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'letter-spacing',
      'text-transform',
      'text-decoration-line',
      'color',
      'background-color',
      'border-width',
      'border-style',
      'border-color',
      'border-radius',
      'padding',
      'margin',
      'gap',
      'width',
      'height',
    ];
    const out = {};
    for (const prop of props) {
      const v = cs.getPropertyValue(prop);
      if (v && v !== 'normal' && v !== 'none' && v !== '0px' && v !== 'auto')
        out[prop] = v;
    }
    // font-family is long and mostly fallbacks; keep the first family only.
    if (out['font-family']) out['font-family'] = out['font-family'].split(',')[0];
    computed[sel] = out;
  }

  return {
    viewport: `${vw}x${vh}`,
    scroll: `${de.scrollWidth}x${de.scrollHeight}`,
    scrollsVertically: de.scrollHeight > vh + 1,
    scrollsHorizontally: de.scrollWidth > vw + 1,
    overflow: overflow.slice(0, 10),
    boxes,
    computed,
  };
}

// --------------------------------------------------------------------- main

const opts = parseArgs(process.argv.slice(2));
const profile = join(tmpdir(), `vr-shot-${process.pid}`);
/*
  `--disable-gpu` is right for screenshots — it is faster and its output is
  deterministic — but it also means no WebGL context at all, so anything drawn
  with one comes out as an empty rectangle. `--webgl` swaps it for SwiftShader,
  Chrome's software renderer, which is slow and entirely enough to prove that a
  map renders. Opt-in, because every shot would otherwise pay for it.
*/
const gpuArgs = opts.webgl
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--disable-gpu'];

const chrome = spawn(findChrome(), [
  '--headless=new',
  ...gpuArgs,
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
    await cdp.send('Runtime.enable', {}, sessionId);

    /*
      Without this, a script that throws inside a callback fails silently: the
      page looks merely wrong, and there is nothing to read. Finding why a map
      rendered the whole world instead of one valley took a run with this on.
    */
    if (opts.console) {
      const say = (kind, text) => {
        if (text) console.log(`  ${kind.padEnd(9)} ${String(text).slice(0, 300)}`);
      };
      cdp.on('Runtime.consoleAPICalled', (p) => {
        if (p.sessionId !== sessionId) return;
        say(
          p.type,
          (p.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' '),
        );
      });
      cdp.on('Runtime.exceptionThrown', (p) => {
        if (p.sessionId !== sessionId) return;
        const d = p.exceptionDetails ?? {};
        say('exception', d.exception?.description ?? d.text);
      });
    }

    /*
      Page weight, measured rather than assumed. This site's budget is small
      and deliberate (see AGENTS.md); the only way to keep it that way is to
      be able to see it. `encodedDataLength` is bytes on the wire, so
      compression counts — which is what a visitor actually pays.
    */
    const weight = new Map();
    if (opts.weight || opts.requests) {
      await cdp.send('Network.enable', {}, sessionId);
      const types = new Map();
      cdp.on('Network.responseReceived', (p) => {
        if (p.sessionId === sessionId) types.set(p.requestId, p.type);
        /*
          Counting bytes says how much arrived; it does not say what was asked
          for or what came back 404. `--requests <substring>` prints the status
          of every URL matching it, which is how a silently missing worker gets
          found.
        */
        if (
          opts.requests &&
          p.sessionId === sessionId &&
          p.response?.url.includes(opts.requests)
        ) {
          console.log(
            `  ${String(p.response.status).padEnd(4)} ${p.response.url.slice(0, 110)}`,
          );
        }
      });
      cdp.on('Network.loadingFinished', (p) => {
        if (p.sessionId !== sessionId) return;
        const type = types.get(p.requestId) ?? 'Other';
        const current = weight.get(type) ?? { bytes: 0, count: 0 };
        weight.set(type, {
          bytes: current.bytes + p.encodedDataLength,
          count: current.count + 1,
        });
      });
    }
    cdp.on('Runtime.exceptionThrown', (p) => {
      if (p.sessionId !== sessionId) return;
      console.error(
        `  ⚠ page error: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`,
      );
      failed = true;
    });
    await cdp.send('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId);
    // The real fix for the 500px window floor: emulate metrics, don't resize.
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 2, mobile: width < 700 },
      sessionId,
    );
    /*
      Light is emulated as explicitly as dark. Left unset, Chrome follows the
      host OS — so on a Mac in dark appearance every "light" screenshot this
      script has ever produced was in fact a dark one, silently, while the
      filename said otherwise.
    */
    const media = [
      { name: 'prefers-color-scheme', value: opts.dark ? 'dark' : 'light' },
    ];
    if (opts.reducedMotion)
      media.push({ name: 'prefers-reduced-motion', value: 'reduce' });
    await cdp.send('Emulation.setEmulatedMedia', { features: media }, sessionId);

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
      // Generous: what a click opens is often behind a dynamic import.
      await new Promise((r) => setTimeout(r, opts.clickWait));
    }

    /*
      Hover states cannot be read from a stylesheet with any confidence — a
      cascade can carry several competing :hover rules — and getComputedStyle
      will not report one that is not actually active. So dispatch a real mouse
      move over the element and measure what the browser settles on.
    */
    if (opts.hover) {
      const { result: box } = await cdp.send(
        'Runtime.evaluate',
        {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(opts.hover)});
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })()`,
          returnByValue: true,
        },
        sessionId,
      );
      if (!box.value) {
        console.error(`  ⚠ --hover ${opts.hover}: no such element`);
        failed = true;
      } else {
        await cdp.send(
          'Input.dispatchMouseEvent',
          { type: 'mouseMoved', x: box.value.x, y: box.value.y, buttons: 0 },
          sessionId,
        );
        await new Promise((r) => setTimeout(r, 300)); // let transitions settle
      }
    }

    const { result } = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(${measureInPage.toString()})(${JSON.stringify(opts.measure)}, ${JSON.stringify(opts.computed)})`,
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

    if (opts.weight || opts.requests) {
      const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
      const total = [...weight.values()].reduce((a, b) => a + b.bytes, 0);
      const rows = [...weight.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
      console.log(
        `  transferred   ${kb(total)} over ${rows.reduce(
          (a, [, v]) => a + v.count,
          0,
        )} requests`,
      );
      for (const [type, v] of rows) {
        console.log(`      ${type.padEnd(12)} ${kb(v.bytes).padStart(9)}  ${v.count}`);
      }
    }

    if (opts.eval) {
      const { result: evaluated } = await cdp.send(
        'Runtime.evaluate',
        { expression: opts.eval, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      console.log(
        `  eval          ${JSON.stringify(evaluated.value ?? evaluated.description)}`,
      );
    }

    for (const [sel, props] of Object.entries(m.computed)) {
      if (!props) {
        console.log(`  computed ${sel}: not present`);
        continue;
      }
      console.log(`  computed ${sel}`);
      for (const [k, v] of Object.entries(props)) console.log(`      ${k}: ${v}`);
    }

    if (opts.shot) {
      /*
        A page running a continuous animation — a lightbox mid-transition, say —
        can leave captureScreenshot waiting for a stable frame indefinitely.
        Time it out and carry on: the measurements above are the part that
        matters, and losing the PNG should not lose them too.
      */
      const capture = (params) =>
        Promise.race([
          cdp.send('Page.captureScreenshot', { format: 'png', ...params }, sessionId),
          new Promise((r) => setTimeout(() => r(null), 8000)),
        ]);
      /*
        The default capture reads the compositor surface, which never settles
        while something animates. `fromSurface: false` renders straight from the
        renderer instead and does settle — a little less faithful, but a picture
        beats none.
      */
      const shot = (await capture({})) ?? (await capture({ fromSurface: false }));
      if (!shot) {
        console.error('  ⚠ screenshot timed out (page may be animating)');
        await cdp.send('Target.closeTarget', { targetId });
        continue;
      }
      const { data } = shot;
      const slug =
        new URL(opts.url).pathname.replace(/^\/|\/$/g, '').replace(/\W+/g, '-') ||
        'home';
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
