/**
 * The Phase 4 gate: flight-computer output must match the archived Drupal build.
 *
 * These two files go into pilots' instruments (AGENTS.md rule 9). "Looks right"
 * is not a standard that belongs anywhere near them, so the standard is bytes:
 * the built output has to equal what the old site served, with the single
 * exception of the OpenAir `* Generated:` line, which is the build date.
 *
 * Run after a build: it reads `dist/`, not the dev server. Wired into
 * `npm run verify`.
 *
 * If this fails, the answer is almost never to update the reference. It is the
 * evidence of what pilots already have loaded.
 */
import { readFileSync, existsSync } from 'node:fs';

const REFERENCE_DIR = '../ventorelativo-drupal/html/api/navdata';
const BUILD_DIR = 'dist/api/navdata';

/** The one line allowed to differ, and why. */
const VOLATILE = /^\* Generated: \d{4}-\d{2}-\d{2}$/;

const FILES = [
  { name: 'ventorelativo-waypoints.cup', exact: true },
  { name: 'ventorelativo-airspace.txt', exact: false },
];

/** First differing line, with a little context: enough to see what moved. */
function firstDifference(expected, actual) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return [
        `  line ${i + 1}:`,
        `    archived: ${a[i] === undefined ? '<end of file>' : JSON.stringify(a[i])}`,
        `    built:    ${b[i] === undefined ? '<end of file>' : JSON.stringify(b[i])}`,
      ].join('\n');
    }
  }
  return '  files differ only in trailing bytes';
}

let failed = false;

for (const { name, exact } of FILES) {
  const referencePath = `${REFERENCE_DIR}/${name}`;
  const builtPath = `${BUILD_DIR}/${name}`;

  if (!existsSync(referencePath)) {
    console.error(`✗ ${name}: no reference at ${referencePath}`);
    console.error('  The Drupal repo is the archive this gate compares against.');
    failed = true;
    continue;
  }
  if (!existsSync(builtPath)) {
    console.error(`✗ ${name}: not in the build. Run \`npm run build\` first.`);
    failed = true;
    continue;
  }

  const reference = readFileSync(referencePath, 'utf8');
  const built = readFileSync(builtPath, 'utf8');

  /*
    Replace the date line, do not delete it.

    Deleting it from both sides was the first attempt and it was wrong: a build
    that stopped emitting the header altogether still compared equal, because
    the filter removed a line from one side that was not there on the other.
    Substituting a fixed marker keeps the line counted, so losing it is a
    difference like any other. This was found by deliberately breaking the
    build output and watching the gate pass.
  */
  const strip = (text) =>
    exact
      ? text
      : text
          .split('\n')
          .map((line) => (VOLATILE.test(line) ? '* Generated: <build date>' : line))
          .join('\n');

  if (strip(reference) === strip(built)) {
    const how = exact ? 'byte-for-byte' : 'identical but for the build date';
    console.log(`✓ ${name}  ${how}  (${built.split('\n').length - 1} lines)`);
  } else {
    console.error(`✗ ${name}: differs from the archived Drupal output.`);
    console.error(firstDifference(strip(reference), strip(built)));
    failed = true;
  }
}

if (failed) {
  console.error('\nFlight-computer data must match the archive. See AGENTS.md rule 9.');
  process.exit(1);
}
