/**
 * The map features, out to GeoJSON and back.
 *
 * The geometry lives in `src/content/map-features/*.yaml` because that is what
 * the site reads and what Zod validates. It is a poor thing to *edit*: nobody
 * adjusts a landing field by typing coordinates into a YAML string. This moves
 * it to a single GeoJSON file that QGIS, geojson.io or Google Earth can open,
 * and moves the result back.
 *
 *   npm run geo:export   →  geo/map-features.geojson
 *   npm run geo:import   →  rewrites the YAML from that file
 *
 * **Import rewrites flight data.** `/api/navdata/*` is built from these
 * coordinates and pilots load it into their instruments (AGENTS.md rule 9), so
 * `npm run verify` diffs both files against the archived Drupal build. Run it
 * after importing; a diff there means the edit changed something real, which is
 * either the point of the edit or a mistake, and only you know which.
 *
 * Round-trip fidelity is the design goal: exporting and importing without
 * touching the file in between must leave the YAML byte-identical. That is what
 * makes the diff after a real edit readable.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';

const CONTENT = 'src/content/map-features';
const OUT_DIR = 'geo';
const OUT_FILE = join(OUT_DIR, 'map-features.geojson');

/** The fields that travel; anything else in the YAML would be lost silently. */
const KNOWN = new Set(['name', 'type', 'point', 'shape', 'guideUrl']);

function read() {
  return readdirSync(CONTENT)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .map((file) => {
      const id = basename(file, '.yaml');
      const data = parse(readFileSync(join(CONTENT, file), 'utf8'));
      const unknown = Object.keys(data).filter((key) => !KNOWN.has(key));
      if (unknown.length) {
        throw new Error(
          `${file}: unhandled field(s) ${unknown.join(', ')} — teach geo.mjs about them first`,
        );
      }
      return { id, data };
    });
}

function toFeatures({ id, data }) {
  const features = [];
  if (data.point) {
    features.push({
      type: 'Feature',
      id: `${id}:point`,
      properties: { id, name: data.name, kind: data.type, part: 'point' },
      geometry: { type: 'Point', coordinates: [data.point.lon, data.point.lat] },
    });
  }
  if (data.shape) {
    const ring = JSON.parse(data.shape.value);
    features.push({
      type: 'Feature',
      id: `${id}:shape`,
      properties: {
        id,
        name: data.name,
        kind: data.type,
        part: data.shape.discriminant,
      },
      geometry:
        data.shape.discriminant === 'polygon'
          ? { type: 'Polygon', coordinates: [ring] }
          : { type: 'LineString', coordinates: ring },
    });
  }
  return features;
}

/**
 * The YAML this project writes, reproduced exactly.
 *
 * Hand-rolled rather than serialised by the `yaml` package: that would quote,
 * order and wrap to its own taste, and every file would churn on the first
 * export/import round trip even where nothing changed.
 */
function toYaml({ name, type, point, shape, guideUrl }) {
  const lines = [`name: ${JSON.stringify(name)}`, `type: ${type}`];
  if (guideUrl) lines.push(`guideUrl: ${JSON.stringify(guideUrl)}`);
  if (point) lines.push('point:', `  lat: ${point.lat}`, `  lon: ${point.lon}`);
  if (shape) {
    const pairs = shape.value.map(([lon, lat]) => `[${lon}, ${lat}]`).join(', ');
    lines.push(
      'shape:',
      `  discriminant: ${shape.discriminant}`,
      `  value: '[${pairs}]'`,
    );
  }
  return lines.join('\n') + '\n';
}

function exportGeo() {
  const collection = {
    type: 'FeatureCollection',
    features: read().flatMap(toFeatures),
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(collection, null, 2) + '\n');
  console.log(
    `${OUT_FILE}  ${collection.features.length} features from ${read().length} points of interest`,
  );
}

function importGeo() {
  const collection = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
  const existing = new Map(read().map((entry) => [entry.id, entry.data]));

  // Gather each id's parts before writing, so a file is never half-updated.
  const updates = new Map();
  for (const feature of collection.features) {
    const { id, part } = feature.properties ?? {};
    const current = existing.get(id);
    if (!current) throw new Error(`${OUT_FILE}: unknown feature id "${id}"`);

    const next = updates.get(id) ?? { ...current };
    if (part === 'point') {
      const [lon, lat] = feature.geometry.coordinates;
      next.point = { lat, lon };
    } else {
      const ring =
        feature.geometry.type === 'Polygon'
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates;
      next.shape = { discriminant: part, value: ring };
    }
    updates.set(id, next);
  }

  let changed = 0;
  for (const [id, data] of updates) {
    const path = join(CONTENT, `${id}.yaml`);
    const before = readFileSync(path, 'utf8');
    const after = toYaml({
      ...data,
      shape: data.shape && {
        discriminant: data.shape.discriminant,
        value: Array.isArray(data.shape.value)
          ? data.shape.value
          : JSON.parse(data.shape.value),
      },
    });
    if (before === after) continue;
    writeFileSync(path, after);
    console.log(`  updated ${id}`);
    changed++;
  }

  console.log(
    changed === 0
      ? 'No changes — the file round-tripped exactly.'
      : `${changed} file(s) changed. Run \`npm run verify\`: it diffs the flight-computer output against the archive.`,
  );
}

const command = process.argv[2];
if (command === 'export') exportGeo();
else if (command === 'import') importGeo();
else {
  console.error('Usage: node scripts/geo.mjs export|import');
  process.exit(1);
}
