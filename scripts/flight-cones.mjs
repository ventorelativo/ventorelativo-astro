#!/usr/bin/env node
/**
 * Glide cones for every takeoff, fetched once and shipped as data.
 *
 *   npm run cones            fetch what is missing or stale
 *   npm run cones -- --check no network: is anything stale?
 *   npm run cones -- --only rucas
 *   npm run cones -- --force refetch everything
 *
 * ## What a cone is
 *
 * hikeandfly.org models where a glider can reach from a point in still air at
 * a given glide ratio, with no thermals and no wind. It answers on a grid of
 * roughly 185 m, capped at 20 km from the takeoff, over Jonathan de Ferranti's
 * 3 arc second elevation data.
 *
 *   GET /flight_cone?lat=..&lon=..&start_altitude=0&gz=9
 *   { "status": "ok", "data": { "44.74486,7.23186": [1578, 49, "44.74486,7.22952", false, 184.8] } }
 *                                                      │     │
 *                             arrival altitude, m ASL ─┘     └ height above the
 *                                                              ground on arrival
 *
 * The second number is the one worth drawing. It is what the colours mean on
 * the original: arrive here with fifty metres under you, or four hundred.
 *
 * ## Why this runs at build and not in the browser
 *
 * Three reasons, in the order they matter.
 *
 * **It is one person's server.** hikeandfly.org is run by an individual, has
 * no published API and no stated policy on automated access. Sixteen takeoffs
 * fetched once when the data changes is a courtesy; the same request from
 * every visitor to a flight site page is someone else's bandwidth bill and
 * someone else's uptime holding up this club's map.
 *
 * **It would be a third party at runtime.** This site loads nothing from
 * anywhere until a visitor asks, `npm run privacy:check` enforces it, and the
 * privacy notice lists every provider by name. A cone served from our own
 * origin needs none of that.
 *
 * **A cone does not change.** The terrain is the same next year.
 *
 * ## The output is not GeoJSON
 *
 * A cone is up to a few thousand cells, and as GeoJSON polygons each one costs
 * five coordinate pairs and a properties object: a couple of hundred kilobytes
 * for a picture of one valley. The grid is regular, so the file below records
 * the origin, the step and one triple per cell, and the browser expands that
 * into squares. Identical on screen, roughly a fifth of the bytes, and the
 * expansion is a dozen lines in the map.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const FEATURES = 'src/content/map-features';
const OUT_DIR = 'public/api/cones';
const MANIFEST = join(OUT_DIR, 'manifest.json');

/**
 * The glide ratios worth pre-computing, decided 2026-09-08.
 *
 * Round numbers a pilot can map onto their own wing rather than a slider
 * nobody moves: 6 for a conservative day or a heavy load, 8 for the everyday
 * modern A or B, 10 for a clean glide. Each one is a fetch per takeoff, so
 * the list is short on purpose.
 */
const RATIOS = [6, 8, 10];

/**
 * Metres above the ground on arrival, at takeoff level.
 *
 * `start_altitude` is the height above the takeoff you begin the glide at, and
 * zero is the honest default: it is what you have standing there. Anything
 * else is a thermal this model explicitly does not include.
 */
const START_ALTITUDE = 0;

const args = process.argv.slice(2);
const check = args.includes('--check');
const force = args.includes('--force');
const onlyFlag = args.indexOf('--only');
/* `indexOf` returns -1 when the flag is absent, and args[0] is not a filter. */
const only = onlyFlag === -1 ? null : args[onlyFlag + 1];

/** Everything that is a takeoff, with the coordinates a cone starts from. */
async function takeoffs() {
  const files = (await readdir(FEATURES)).filter((f) => f.endsWith('.yaml'));
  const found = [];
  for (const file of files) {
    const text = await readFile(join(FEATURES, file), 'utf8');
    if (!/^type:\s*takeoff\s*$/m.test(text)) continue;
    const lat = Number(text.match(/^\s*lat:\s*(-?[\d.]+)/m)?.[1]);
    const lon = Number(text.match(/^\s*lon:\s*(-?[\d.]+)/m)?.[1]);
    const name = text.match(/^name:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`${file}: takeoff without usable coordinates`);
    }
    found.push({ slug: file.replace(/\.yaml$/, ''), name, lat, lon });
  }
  return found.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** What the cone was computed from. Change any of it and the cone is stale. */
function hashOf(takeoff, ratio) {
  return createHash('sha256')
    .update(`${takeoff.lat},${takeoff.lon},${ratio},${START_ALTITUDE}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * The service's grid, packed.
 *
 * Cell keys are "lat,lon" on a regular lattice, so the whole thing reduces to
 * an origin, a step and integer offsets. The steps are derived from the data
 * rather than assumed: they are a function of latitude, and hard-coding the
 * ones this valley happens to produce would break the day somebody adds a
 * takeoff in another one.
 */
export function pack(data) {
  const cells = Object.entries(data).map(([key, value]) => {
    const [lat, lon] = key.split(',').map(Number);
    return { lat, lon, agl: Math.round(value[1] ?? 0), alt: Math.round(value[0] ?? 0) };
  });
  if (!cells.length) throw new Error('the service returned an empty cone');

  const lats = [...new Set(cells.map((c) => c.lat))].sort((a, b) => a - b);
  const lons = [...new Set(cells.map((c) => c.lon))].sort((a, b) => a - b);
  const step = (values) => {
    const gaps = values
      .slice(1)
      .map((v, i) => Number((v - values[i]).toFixed(6)))
      .filter((g) => g > 0);
    /* The smallest gap is the lattice; larger ones are cells the model left
       out because they are unreachable, and there are plenty of those. */
    return Math.min(...gaps);
  };

  const latStep = lats.length > 1 ? step(lats) : 0.00166;
  const lonStep = lons.length > 1 ? step(lons) : 0.00234;
  const lat0 = lats[0];
  const lon0 = lons[0];

  return {
    lat0,
    lon0,
    latStep,
    lonStep,
    /* [row, column, height above ground]. Rounded to the metre: the model's
       own vertical resolution is nothing like that fine. */
    cells: cells.map((c) => [
      Math.round((c.lat - lat0) / latStep),
      Math.round((c.lon - lon0) / lonStep),
      c.agl,
    ]),
  };
}

async function fetchCone(takeoff, ratio) {
  const url =
    'https://www.hikeandfly.org/flight_cone' +
    `?lat=${takeoff.lat}&lon=${takeoff.lon}` +
    `&start_altitude=${START_ALTITUDE}&gz=${ratio}`;

  const response = await fetch(url, {
    headers: {
      /* Say who is calling. It is one person's server and this is a robot. */
      'User-Agent': 'ventorelativo.it build (segreteria@ventorelativo.it)',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const body = await response.json();
  if (body.status !== 'ok') throw new Error(`status ${body.status}`);
  return pack(body.data);
}

async function main() {
  const sites = (await takeoffs()).filter((t) => !only || t.slug === only);
  if (!sites.length)
    throw new Error(only ? `no takeoff named "${only}"` : 'no takeoffs');

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = existsSync(MANIFEST)
    ? JSON.parse(await readFile(MANIFEST, 'utf8'))
    : {};

  const stale = [];
  let written = 0;

  for (const takeoff of sites) {
    for (const ratio of RATIOS) {
      const key = `${takeoff.slug}-${ratio}`;
      const hash = hashOf(takeoff, ratio);
      const file = join(OUT_DIR, `${key}.json`);
      const current = manifest[key]?.hash === hash && existsSync(file);

      if (current && !force) {
        if (!check) console.log(`  ${key.padEnd(28)} unchanged`);
        continue;
      }
      if (check) {
        stale.push(key);
        continue;
      }

      process.stdout.write(`  ${key.padEnd(28)} fetching... `);
      const cone = await fetchCone(takeoff, ratio);
      const json = JSON.stringify(cone);
      await writeFile(file, `${json}\n`);
      manifest[key] = { hash, cells: cone.cells.length };
      written += 1;
      console.log(`${cone.cells.length} cells, ${(json.length / 1024).toFixed(0)} kB`);

      /* One at a time, with a pause. Forty-eight requests in a burst at
         somebody's hobby server is not how to be a good guest. */
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  if (check) {
    if (stale.length) {
      console.error(`\n✗ ${stale.length} glide cones are stale or missing:\n`);
      for (const key of stale) console.error(`    ${key}`);
      console.error('\n  Run `npm run cones` (needs network).\n');
      process.exit(1);
    }
    console.log(`✓ glide cones ok  (${Object.keys(manifest).length} up to date)`);
    return;
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n${written} written, ${Object.keys(manifest).length} in total.`);
}

/*
  Only when run, never when imported.

  Without this guard, importing `pack` to test it fetched all forty-eight
  cones as a side effect, which is a rude way to find out that a module's top
  level is not a main function.
*/
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`\n✗ ${error.message}\n`);
    process.exit(1);
  });
}
