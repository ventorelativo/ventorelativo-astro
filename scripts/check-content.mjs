#!/usr/bin/env node
/**
 * Rules for content files that a type-checker cannot express.
 *
 * Right now there is one, and it earned its place: an MDX body containing an
 * `import` statement makes Keystatic refuse to open the entry at all, with
 * "Unhandled type mdxjsEsm". The site still builds, so nothing catches it until
 * a volunteer opens the post and finds a red box. Body components are handed to
 * `<Content components={MDX_COMPONENTS} />`: see src/components/mdx/components.ts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONTENT_DIR = 'src/content';

async function mdxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return mdxFiles(path);
      return entry.name.endsWith('.mdx') ? [path] : [];
    }),
  );
  return files.flat();
}

const problems = [];

for (const file of await mdxFiles(CONTENT_DIR)) {
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

if (problems.length) {
  console.error(`\n${problems.join('\n\n')}\n`);
  console.error(`${problems.length} problem(s) in content files.\n`);
  process.exit(1);
}

console.log('content files ok');
