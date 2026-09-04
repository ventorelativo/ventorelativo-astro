#!/usr/bin/env node
/**
 * The authoring contract against the schemas it describes.
 *
 * AGENTS.md rule 12 says three lists describe content and must agree:
 * `src/content.config.ts` (what the build accepts), `keystatic.config.ts` (what
 * an editor can type) and `src/components/mdx/components.ts` (what renders).
 * `src/authoring/istruzioni.md` is a fourth, and it is the one nothing else
 * would catch: it is prose, it is read by a machine that will not question it,
 * and a field it names wrongly comes back as a value nobody can file.
 *
 * What is checked, and why only this much:
 *
 *  - **Field names, both ways.** A field in the schema and not in the document
 *    is a field the AI will never fill; a field in the document and not in the
 *    schema is an instruction to write something that cannot be saved.
 *  - **The news categories, both ways.** A closed `z.enum`, so an invented
 *    value fails the build later with a Zod error a volunteer cannot read.
 *  - **Site tags, one way only.** They are free strings by schema, so an editor
 *    may add one without touching this document; what must not happen is the
 *    reverse, the document offering a tag the club does not use.
 *
 * Labels are deliberately not checked. They are what a volunteer matches to the
 * form, but Keystatic's config nests them past what a regex can follow
 * honestly, and a wrong label shows itself the first time someone uses it.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const CONTRACT = 'src/authoring/istruzioni.md';
const SCHEMA = 'src/content.config.ts';

/**
 * In the schema and deliberately absent from the document.
 *
 * `mapFeatures` is `fields.ignored()` in Keystatic: the map features are
 * safety-critical and are not edited through the CMS at all, so the document
 * tells the model to leave coordinates alone rather than describing a field it
 * must not touch.
 */
const UNDOCUMENTED = { news: [], sites: ['mapFeatures'], pages: [], settings: [] };

/**
 * Which block of the document describes which collections, and how deep that
 * collection's Zod keys are indented.
 *
 * `pages` and `settings` share one block because a volunteer does not think of
 * them as two things: "Pagina: Contatti" and "Social" are both entries in the
 * same sidebar. The check treats their fields as one set, which is enough to
 * catch a renamed or dropped field, the drift that actually happens.
 *
 * The indent is per collection because `settings` takes a plain `z.object` and
 * the others take a function of `{ image }`, which costs them a level.
 */
const DESCRIBES = [
  { block: 'news', collections: [['news', 6]] },
  { block: 'siti', collections: [['sites', 6]] },
  {
    block: 'pagine',
    collections: [
      ['pages', 6],
      ['settings', 4],
    ],
  },
];

const contract = await readFile(CONTRACT, 'utf8');
const schema = await readFile(SCHEMA, 'utf8');

/** The text between a `blocco:` marker and its close. */
function block(name) {
  const match = contract.match(
    new RegExp(`<!-- blocco:${name} -->\\n([\\s\\S]*?)<!-- /blocco:${name} -->`),
  );
  if (!match) throw new Error(`${CONTRACT} has no "blocco:${name}" block.`);
  return match[1];
}

/** The top-level keys of one collection's Zod object. */
function schemaFields(collection, indent) {
  const start = schema.indexOf(`const ${collection} = defineCollection(`);
  if (start === -1) throw new Error(`${SCHEMA} has no "${collection}" collection.`);
  const end = schema.indexOf('\nconst ', start + 1);
  const body = schema.slice(start, end === -1 ? undefined : end);
  return [...body.matchAll(new RegExp(`^ {${indent}}(\\w+): `, 'gm'))].map((m) => m[1]);
}

/** The field names in the first column of the document's tables. */
function documentedFields(name) {
  return [...block(name).matchAll(/^\| `([\w.]+)`/gm)].map((m) => m[1].split('.')[0]);
}

const problems = [];
const report = (message) => problems.push(message);

for (const { block: name, collections } of DESCRIBES) {
  const documented = new Set(documentedFields(name));
  const declared = new Set();

  for (const [collection, indent] of collections) {
    const skip = new Set(UNDOCUMENTED[collection]);
    for (const field of schemaFields(collection, indent)) {
      declared.add(field);
      if (!documented.has(field) && !skip.has(field)) {
        report(
          `${CONTRACT}  "${collection}.${field}" is in the schema and not in ` +
            `the "${name}" block.\n    An editor's AI will never fill it. Add a ` +
            `row for it, or list it in\n    UNDOCUMENTED with the reason.`,
        );
      }
    }
  }

  for (const field of documented) {
    if (!declared.has(field)) {
      report(
        `${CONTRACT}  "${field}" is in the "${name}" block and in none of the ` +
          `schemas it\n    describes (${collections.map(([c]) => c).join(', ')}). ` +
          `The AI would produce a value\n    nobody can file. Rename it or drop ` +
          `the row.`,
      );
    }
  }
}

/* News categories: a closed enum on both sides. */
const enumValues = schema
  .slice(schema.indexOf('category: z.enum(['))
  .match(/\[([^\]]*)\]/)[1]
  .match(/'([^']+)'/g)
  .map((value) => value.slice(1, -1));

const enumDocumented = [...block('news').matchAll(/Esattamente uno di: (.+?)\./g)]
  .flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)])
  .map((m) => m[1]);

for (const value of enumValues) {
  if (!enumDocumented.includes(value)) {
    report(`${CONTRACT}  the category "${value}" exists and is not documented.`);
  }
}
for (const value of enumDocumented) {
  if (!enumValues.includes(value)) {
    report(
      `${CONTRACT}  the category "${value}" is documented and is not in the ` +
        `enum.\n    Zod would reject the entry after the volunteer typed it.`,
    );
  }
}

/* Site tags: the document must not offer one the club does not use. */
const used = new Set();
for (const file of await readdir('src/content/sites')) {
  const body = await readFile(join('src/content/sites', file), 'utf8');
  for (const m of body.matchAll(/^ {2}- '?([^'\n]+?)'?$/gm)) used.add(m[1]);
}

const tagsDocumented = [...block('siti').matchAll(/Solo valori già in uso: (.+?)\./g)]
  .flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)])
  .map((m) => m[1]);

for (const tag of tagsDocumented) {
  if (!used.has(tag)) {
    report(
      `${CONTRACT}  the tag "${tag}" is offered to editors and no site carries ` +
        `it.\n    Either a site should, or the document is inventing a ` +
        `vocabulary.`,
    );
  }
}

/*
  The generated site list against the sites themselves.

  `src/lib/siteOptions.ts` feeds the "Sito di volo" picker, and is written by
  scripts/build-site-options.mjs before every dev and build. It is committed,
  because `astro check` runs before the build and an import of a file that does
  not exist fails it. Committed means it can be committed stale, so it is
  checked: run `node scripts/build-site-options.mjs` and the difference goes.
*/
const unquote = (s) => s.replaceAll(/\\(.)/g, '$1');

const generated = new Map(
  [
    // Either quote: the generator writes whichever one Prettier would keep,
    // so "Pian dell'Alpe" is double-quoted and the other thirteen are not.
    ...(await readFile('src/lib/siteOptions.ts', 'utf8')).matchAll(
      /\{ label: (["'])((?:[^\\]|\\.)*?)\1, value: (["'])((?:[^\\]|\\.)*?)\3 \}/g,
    ),
  ].map((m) => [unquote(m[4]), unquote(m[2])]),
);

const real = new Map();
for (const file of await readdir('src/content/sites')) {
  if (!file.endsWith('.mdx')) continue;
  const raw = (await readFile(join('src/content/sites', file), 'utf8')).match(
    /^title:\s*(.+)$/m,
  )[1];
  const value = raw.trim();
  /* YAML doubles an apostrophe inside single quotes: 'Pian dell''Alpe'. */
  const title = /^'.*'$/.test(value)
    ? value.slice(1, -1).replaceAll("''", "'")
    : value.replace(/^"(.*)"$/, '$1');
  real.set(file.replace(/\.mdx$/, ''), title);
}

for (const [slug, title] of real) {
  if (generated.get(slug) !== title) {
    report(
      `src/lib/siteOptions.ts is out of date: "${title}" (${slug}) is ` +
        `${generated.has(slug) ? `listed as "${generated.get(slug)}"` : 'missing'}.` +
        `\n    Run: node scripts/build-site-options.mjs`,
    );
  }
}
for (const [slug] of generated) {
  if (!real.has(slug)) {
    report(
      `src/lib/siteOptions.ts offers "${slug}", which is not a site.` +
        `\n    Run: node scripts/build-site-options.mjs`,
    );
  }
}

if (problems.length) {
  console.error(`\n${problems.join('\n\n')}\n`);
  console.error(`${problems.length} problem(s) in the authoring contract.\n`);
  process.exit(1);
}

const unique = (name) => new Set(documentedFields(name)).size;

console.log(
  `authoring contract ok: ${unique('news')} news fields, ${unique('siti')} site ` +
    `fields, ${unique('pagine')} page and setting fields, ` +
    `${enumValues.length} categories, ${tagsDocumented.length} tags`,
);
