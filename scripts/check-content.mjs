#!/usr/bin/env node
/**
 * Rules for the repository's text that a type-checker cannot express.
 *
 * **No import in a content file.** An MDX body containing an `import` statement
 * makes Keystatic refuse to open the entry at all, with "Unhandled type
 * mdxjsEsm". The site still builds, so nothing catches it until a volunteer
 * opens the post and finds a red box. Body components are handed to `<Content
 * components={MDX_COMPONENTS} />`: see src/components/mdx/components.ts.
 *
 * **No em dash, anywhere.** AGENTS.md rule 11: the club does not want the
 * character in this project, in content or in code. It was a style rule kept by
 * hand until `/redazione` invited volunteers to draft posts with an AI, and an
 * em dash is the one house rule a language model breaks by reflex. A rule that
 * arrives through a CMS branch needs a machine to enforce it.
 *
 * This runs from `prebuild` as well as from `lint`, which is the point: Netlify
 * builds a Keystatic branch with `npm run build` and never runs `lint`, so a
 * check that lived only there would miss every post an editor writes.
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const CONTENT_DIR = 'src/content';

/** Generated, vendored or not ours. Everything else is checked. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.astro',
  '.netlify',
  'vendor',
]);

const TEXT = new Set([
  '.md',
  '.mdx',
  '.ts',
  '.tsx',
  '.astro',
  '.css',
  '.mjs',
  '.js',
  '.yaml',
  '.yml',
  '.toml',
]);

/* Written as an escape, not as the character, so the file that enforces the
   rule is not the one file exempt from it. */
const EM_DASH = '\u2014';

async function walk(dir, keep, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await walk(path, keep, found);
    } else if (keep(path)) {
      found.push(path);
    }
  }
  return found;
}

const problems = [];

for (const file of await walk(CONTENT_DIR, (path) => path.endsWith('.mdx'))) {
  const lines = (await readFile(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    if (/^import\s/.test(line)) {
      problems.push(
        `${file}:${i + 1}  import statement in a content file\n` +
          `    ${line.trim()}\n` +
          `    Keystatic cannot open an entry containing an import. Remove the\n` +
          `    line and add the component to src/components/mdx/components.ts.`,
      );
    }
  });
}

for (const file of await walk('.', (path) => TEXT.has(extname(path)))) {
  const lines = (await readFile(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    const at = line.indexOf(EM_DASH);
    if (at === -1) return;
    problems.push(
      `${file}:${i + 1}:${at + 1}  em dash\n` +
        `    ${line.trim()}\n` +
        `    AGENTS.md rule 11: this project does not use the character. Put a\n` +
        `    comma, a colon, a semicolon, brackets or a full stop in its place,\n` +
        `    whichever the sentence actually needs.`,
    );
  });
}

if (problems.length) {
  console.error(`\n${problems.join('\n\n')}\n`);
  console.error(`${problems.length} problem(s) in the repository's text.\n`);
  process.exit(1);
}

console.log('content files ok');
