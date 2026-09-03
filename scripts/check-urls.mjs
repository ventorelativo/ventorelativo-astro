/**
 * The cutover gate: every URL the old site served must still resolve.
 *
 * Phase 2 diffed the URL sets once, by hand. This does it on every build,
 * because the risk did not end there: deleting a site in Keystatic or renaming
 * a news post removes a live URL, and nothing else in the pipeline would say so.
 * The domain moves in Phase 5 (MIGRATION-PLAN.md §7), and after that a missing
 * URL is a 404 in front of the club rather than a diff in a terminal.
 *
 * The archived Drupal build is the evidence, exactly as it is for the navdata
 * gate: `../ventorelativo-drupal/html/` is what the old site actually served,
 * whatever any plan says it served.
 *
 * Every old URL must be one of three things, and the third needs a reason
 * written down here:
 *
 *   1. built   : a page at the same path in `dist/`
 *   2. redirected: a 301 in `netlify.toml` (Astro's own `redirects` option is
 *      banned, AGENTS.md rule 2, because without a host adapter it emits
 *      meta-refresh HTML that passes no ranking signal)
 *   3. dropped : deliberately, with the decision that dropped it
 *
 * Run after a build. Wired into `npm run verify`.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVE = '../ventorelativo-drupal/html';
const BUILD = 'dist';

/**
 * URLs the old site served that the new one deliberately does not, each with
 * the decision that says so. Anything not listed here and not built or
 * redirected fails the gate.
 */
const DROPPED = {
  '/tags/adatto-ai-principianti/': 'D13, tag archives dropped, tags kept as pills',
  '/tags/asdasd/': 'D13, and it was junk',
  '/tags/competizioni/': 'D13',
  '/tags/eventi/': 'D13',
  '/tags/hikefly/': 'D13',
  /*
    Astro emits `dist/404.html`, which Netlify serves for any unmatched path:
    the same behaviour, without a page of its own at `/404/`. Nothing links
    there on purpose.
  */
  '/404/': 'Astro serves 404.html directly; no page lives at /404/',
  // Deleted at cutover (Phase 5). Until then it is built but kept out of the
  // sitemap and out of search.
  '/styleguide/': 'design reference, not a page of the site, noindex, no sitemap',
  /*
    Drupal's own contact path. It did render a page in the archived build, and
    briefly had a redirect here, but the club confirms it was an artefact of
    the CMS rather than an address anyone was given. It was never in the old
    sitemap either. `/contact/contatti` keeps its redirect: that one was a real
    redirect entity in Drupal (S10).
  */
  '/contact/': "Drupal's own path, never advertised, confirmed an artefact",
};

/**
 * Directory listings from the archive, not pages. Tome wrote the module's
 * asset folders into `html/`, and a directory of flag SVGs is not a URL anyone
 * navigated to.
 */
const NOT_A_PAGE = /^\/modules\//;

/** Files, not pages: they have no `index.html` to be found by the walk. */
const FILES = [
  '/api/navdata/ventorelativo-waypoints.cup',
  '/api/navdata/ventorelativo-airspace.txt',
];

/** Every path with an `index.html` under a directory tree, as a URL. */
function pages(root) {
  const found = new Set();
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, `${prefix}${name}/`);
      else if (name === 'index.html') found.add(prefix);
    }
  };
  walk(root, '/');
  return found;
}

/** The `from` paths of the 301s in netlify.toml, normalised with a trailing slash. */
function redirects() {
  const toml = readFileSync('netlify.toml', 'utf8');
  const found = new Map();
  for (const block of toml.split('[[redirects]]').slice(1)) {
    const from = block.match(/from\s*=\s*"([^"]+)"/)?.[1];
    const to = block.match(/to\s*=\s*"([^"]+)"/)?.[1];
    if (from && to) found.set(from.endsWith('/') ? from : `${from}/`, to);
  }
  return found;
}

if (!existsSync(ARCHIVE)) {
  console.error(`✗ no archive at ${ARCHIVE}`);
  console.error('  The Drupal repo is the evidence this gate compares against.');
  process.exit(1);
}
if (!existsSync(BUILD)) {
  console.error('✗ no dist/. Run `npm run build` first.');
  process.exit(1);
}

const old = [...pages(ARCHIVE)].filter((url) => !NOT_A_PAGE.test(url)).sort();
const built = pages(BUILD);
const rules = redirects();

let failed = false;
const counts = { built: 0, redirected: 0, dropped: 0 };

for (const url of old) {
  if (built.has(url)) counts.built++;
  else if (rules.has(url)) counts.redirected++;
  else if (DROPPED[url]) counts.dropped++;
  else {
    console.error(`✗ ${url}: served by the old site, and now nothing serves it.`);
    console.error('  Build it, redirect it in netlify.toml, or add it to DROPPED');
    console.error('  in this file with the decision that dropped it.');
    failed = true;
  }
}

for (const file of FILES) {
  if (existsSync(join(BUILD, file))) counts.built++;
  else {
    console.error(`✗ ${file}: the old site served this and the build does not.`);
    failed = true;
  }
}

/*
  A rule that points at something that no longer exists is a 301 into a 404.

  The target may be a page or a file: `/sitemap.xml` → `/sitemap-index.xml` is
  the latter. `/keystatic` is neither: it is the one route rendered on demand
  by the function, so there is nothing in `dist/` to find.
*/
for (const [from, to] of rules) {
  if (!to.startsWith('/') || to.startsWith('/keystatic')) continue;
  const asPage = to.endsWith('/') ? to : `${to}/`;
  if (built.has(asPage) || existsSync(join(BUILD, to))) continue;
  console.error(`✗ redirect ${from} → ${to}, and ${to} is not in the build.`);
  failed = true;
}

if (!failed) {
  console.log(
    `✓ every old URL still resolves  ` +
      `(${counts.built} built, ${counts.redirected} redirected, ${counts.dropped} dropped by decision)`,
  );
}

process.exit(failed ? 1 : 0);
