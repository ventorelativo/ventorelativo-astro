/**
 * Heading slugs, for `id` attributes you can link to.
 *
 * Astro already does this for headings written in MDX: its markdown pipeline
 * runs `github-slugger`, which is why `## Sostenitore o Socio?` arrives in the
 * HTML as `id="sostenitore-o-socio"`. Headings rendered by a *component* go
 * through none of that, so half the `h2`s on the site had no id and could not
 * be linked to.
 *
 * This reproduces the same rules rather than picking a nicer set, because the
 * two have to agree: a link written by hand, or by an editor in a content file,
 * cannot know whether the heading it points at came from MDX or from a
 * component.
 *
 *   lowercase, strip anything that is not a letter, number, space or hyphen,
 *   then spaces to hyphens.
 *
 * Accented letters survive (`à` stays `à`) and apostrophes vanish rather than
 * becoming hyphens, so "Dati dell'associazione" is `dati-dellassociazione`.
 * Both are github-slugger's behaviour, and both would be easy to get wrong by
 * writing something that merely looks right.
 */
export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N} -]+/gu, '')
      .replace(/\s+/g, '-')
      /*
      A heading ending in something the line above strips leaves a trailing
      space, and so a trailing hyphen: a post titled "... X-CRO" with an emoji
      after it slugged to `...-x-cro-`. github-slugger keeps that hyphen; this
      does not, because no MDX heading on the site is affected and the anchor
      reads better without it.
    */
      .replace(/^-+|-+$/g, '')
  );
}
