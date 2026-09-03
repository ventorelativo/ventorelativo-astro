/**
 * The components a content body may use.
 *
 * Passed to `<Content components={MDX_COMPONENTS} />` rather than imported at
 * the top of each MDX file. Two reasons, both about the people editing:
 *
 *  - Keystatic cannot parse an `import` inside a content file at all — it
 *    rejects the whole entry with "Unhandled type mdxjsEsm".
 *  - An import line is code in a document, and the point of Phase 3 is that
 *    nobody has to write code to publish a news post.
 *
 * Anything added here must also be declared in `keystatic.config.ts`, or the
 * editor will refuse to open an entry that uses it. The two lists are one list.
 */
import ActionLinks from './ActionLinks.astro';
import Facts from './Facts.astro';
import Swatch from './Swatch.astro';

export const MDX_COMPONENTS = { ActionLinks, Facts, Swatch };
