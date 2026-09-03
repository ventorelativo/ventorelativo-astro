/**
 * Every `h2` in the built site can be linked to.
 *
 * Headings written in MDX get an `id` from Astro's markdown pipeline; headings
 * rendered by a component get one from `src/components/H2.astro`. A plain
 * `<h2>` in a component gets nothing, which is invisible until somebody tries
 * to link to it, so this fails the build instead.
 *
 * It also catches two headings on one page slugging to the same id, which is
 * invalid HTML and silently sends every link to the first one.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BUILD = 'dist';

async function html(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await html(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

const missing = [];
const duplicated = [];

for (const file of await html(BUILD)) {
  const page = file.replace(`${BUILD}/`, '/').replace(/index\.html$/, '');
  const source = await readFile(file, 'utf8');
  const seen = new Map();

  for (const [, attrs, text] of source.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g)) {
    const words = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const id = attrs.match(/\bid="([^"]*)"/)?.[1];
    if (!id) {
      missing.push(`${page}  "${words.slice(0, 48)}"`);
      continue;
    }
    if (seen.has(id)) duplicated.push(`${page}  #${id}  ("${words.slice(0, 32)}")`);
    seen.set(id, words);
  }
}

if (missing.length || duplicated.length) {
  if (missing.length) {
    console.error(`\n✗ ${missing.length} h2 without an id:\n`);
    for (const line of missing) console.error(`  ${line}`);
    console.error('\n  Render it with <H2> (src/components/H2.astro) instead of <h2>.');
  }
  if (duplicated.length) {
    console.error(`\n✗ ${duplicated.length} duplicate h2 id:\n`);
    for (const line of duplicated) console.error(`  ${line}`);
    console.error('\n  Pass an explicit `id` to <H2> to break the tie.');
  }
  process.exit(1);
}

console.log('✓ every h2 can be linked to  (ids present and unique per page)');
