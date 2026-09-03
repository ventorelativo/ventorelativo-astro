/**
 * The privacy gate: nothing third-party may load on its own.
 *
 * The claim `/privacy` makes to visitors is architectural — "opening a page of
 * this site starts no request to anyone else" — and it is the reason the site
 * needs no consent banner. A claim like that is worth exactly as much as the
 * check behind it, and it is one careless `<script src>` from being false.
 *
 * So: scan the built HTML for everything a browser fetches without being
 * asked, and fail on any origin that is not this site's own or on the list
 * below. The list is short on purpose, and every line of it has to be true in
 * `src/content/pages/privacy.mdx` as well.
 *
 * What this does **not** cover, and cannot: URLs inside JavaScript that only
 * run on interaction — the map's tile providers, Google's translate script.
 * Those are the facades, they are disclosed, and the point is that they are
 * behind a click. `scripts/shot.mjs --requests` is the tool for watching what
 * a real page load actually fetches.
 *
 * Runs after a build, in `npm run verify`.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BUILD = 'dist';

/**
 * Origins allowed to load without the visitor asking, and why. Keep this in
 * step with the "Statistiche di visita" section of the privacy notice — if
 * something is added here and not there, the notice is wrong.
 */
const ALLOWED = {
  'static.cloudflareinsights.com':
    'Cloudflare Web Analytics (S16) — cookieless, aggregate, disclosed in /privacy',
};

/** Attributes a browser fetches before anyone clicks anything. */
const EAGER = [
  /<script\b[^>]*\bsrc="([^"]+)"/g,
  /<link\b[^>]*\bhref="([^"]+)"/g,
  /<img\b[^>]*\bsrc="([^"]+)"/g,
  /<img\b[^>]*\bsrcset="([^"]+)"/g,
  /<source\b[^>]*\bsrcset="([^"]+)"/g,
  /<iframe\b[^>]*\bsrc="([^"]+)"/g,
  /@font-face[^}]*url\(["']?([^"')]+)/g,
];

function pages(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) pages(path, found);
    else if (name.endsWith('.html')) found.push(path);
  }
  return found;
}

let failed = false;
const seen = new Map();

for (const file of pages(BUILD)) {
  /*
    Keystatic's admin is not a page of the site. It is a React app two people
    sign into, it is `noindex`, and it legitimately talks to GitHub.
  */
  if (file.includes('/keystatic/')) continue;

  const html = readFileSync(file, 'utf8');
  for (const pattern of EAGER) {
    for (const [, value] of html.matchAll(pattern)) {
      for (const url of value.split(',').map((part) => part.trim().split(/\s+/)[0])) {
        if (!/^https?:\/\//.test(url)) continue;
        const { hostname } = new URL(url);
        if (hostname.endsWith('ventorelativo.it') || hostname === 'localhost') continue;
        if (hostname in ALLOWED) continue;
        if (!seen.has(hostname)) seen.set(hostname, new Set());
        seen.get(hostname).add(file.replace(`${BUILD}/`, '/'));
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error('✗ pages load something third-party before anyone asks:');
  for (const [hostname, files] of seen) {
    console.error(`    ${hostname}`);
    for (const file of [...files].slice(0, 3)) console.error(`      ${file}`);
  }
  console.error('  Put it behind an interaction, or add it to ALLOWED in this file');
  console.error('  and to the privacy notice in src/content/pages/privacy.mdx.');
} else {
  const allowed = Object.keys(ALLOWED).length;
  console.log(
    `✓ no page loads a third party unasked  ` +
      `(${allowed} origin${allowed === 1 ? '' : 's'} allowed, and disclosed)`,
  );
}

process.exit(failed ? 1 : 0);
