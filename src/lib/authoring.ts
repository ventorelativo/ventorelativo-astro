/**
 * The authoring contract, sliced and addressed.
 *
 * One Italian document (`src/authoring/istruzioni.md`) is the source: read by a
 * volunteer on `/redazione`, by the model they paste it into, and served as
 * plain text at `/redazione/istruzioni.txt`. Three consumers, one file, so the
 * rules cannot say different things in different places.
 *
 * ## Why it is sliced
 *
 * A free tier has a small context window and drops instructions when it fills
 * up. A volunteer writing a news post has no use for the flight-site rules, so
 * `instructions()` takes the types it should include and the copy button ships
 * only those. The `<!-- blocco:… -->` markers in the markdown are the seams.
 *
 * ## Why the URLs are placeholders
 *
 * `{{keystatic}}` and `{{istruzioni}}` are filled from `Astro.site`, which is
 * the staging host today and `ventorelativo.it` after the cutover, and is the
 * branch's own URL in a Keystatic preview. A hardcoded address in the document
 * would send a volunteer to the wrong site the day the domain moves.
 */
import source from '../authoring/istruzioni.md?raw';

/** The content types a volunteer can ask about. Matches the `blocco:` markers. */
export type Kind = 'news' | 'siti' | 'pagine';

export const KINDS: { kind: Kind; label: string; hint: string }[] = [
  {
    kind: 'news',
    label: 'Una news o un evento',
    hint: 'Un annuncio, una gara, un hike & fly, un ritrovo.',
  },
  {
    kind: 'siti',
    label: 'Un sito di volo',
    hint: 'La scheda di uno dei quattordici siti, da correggere o completare.',
  },
  {
    kind: 'pagine',
    label: 'Una pagina fissa o le impostazioni',
    hint: 'Home, iscrizioni, contatti, privacy, kit stampa, i social, i dati del club.',
  },
];

/**
 * Always sent, whatever the volunteer is editing.
 *
 * `comune` is the brief and the rules. `mappa` is the inventory: every page,
 * the entry that controls it, and what is not editable from the CMS at all.
 * Without it a model answers the question it was asked rather than the one the
 * volunteer has, and half of these live somewhere other than the page they are
 * visible on: the footer's legal line is a site-wide setting, the flight list
 * comes from XContest, the map comes from data nobody edits here.
 */
const ALWAYS = ['comune', 'mappa'] as const;

const BLOCK = /<!-- blocco:([a-z]+) -->\n([\s\S]*?)<!-- \/blocco:\1 -->/g;

/** The document's `#` title, everything before the first block. */
const title = source.slice(0, source.search(/<!-- blocco:/)).trim();

const blocks = new Map<string, string>();
for (const [, name, body] of source.matchAll(BLOCK)) blocks.set(name, body.trim());

/* A missing block means the markdown was edited and a marker lost. Fail loudly
   at build time: the alternative is a contract that quietly omits a rule. */
for (const name of [...ALWAYS, 'news', 'siti', 'pagine', 'chiusura']) {
  if (!blocks.has(name)) {
    throw new Error(
      `istruzioni.md has no "blocco:${name}" block. The markers are what ` +
        'src/lib/authoring.ts slices on; restore it or update this list.',
    );
  }
}

function fill(text: string, site: URL): string {
  return text
    .replaceAll('{{keystatic}}', new URL('/keystatic', site).href)
    .replaceAll('{{istruzioni}}', new URL('/redazione/istruzioni.txt', site).href);
}

/**
 * The contract as Markdown, for the given content types.
 *
 * Defaults to all of them: that is what `/redazione/istruzioni.txt` serves and
 * what a model following the link should see.
 */
export function instructions(
  site: URL,
  kinds: Kind[] = ['news', 'siti', 'pagine'],
): string {
  return fill(
    [
      title,
      ...ALWAYS.map((name) => blocks.get(name)),
      ...kinds.map((kind) => blocks.get(kind)),
      blocks.get('chiusura'),
    ].join('\n\n'),
    site,
  );
}

/**
 * What the copy button puts on the clipboard: the request, then the contract.
 *
 * The instructions travel *with* the prompt rather than as a link, because
 * `robots.txt` returns `Disallow: /` for every host that is not the live
 * domain, and the assistant crawlers honour it. Until the cutover a model
 * cannot read the URL even when it is able to browse. Pasting always works.
 *
 * No date here on purpose: the copy script prepends today's, so it is the day
 * the volunteer copied and not the day the site was built.
 */
export function prompt(site: URL, kind: Kind): string {
  const what = {
    news: 'Devi prepararmi una news o un evento',
    siti: 'Devi aiutarmi con la scheda di un sito di volo',
    pagine: 'Devi aiutarmi a modificare una pagina fissa o le impostazioni',
  }[kind];

  return [
    /* One line per paragraph, not wrapped at 80 columns like the document
       below it: this part is read inside a narrow box on a phone, where a hard
       wrap breaks a second time and comes out ragged. */
    `${what} per il sito del Parapendio Club VentoRelativo.`,
    '',
    'Segui alla lettera le istruzioni del club che ti incollo qui sotto: sono le regole della casa, comprese quelle su cosa non inventare mai e sul trattino lungo, che non va usato.',
    '',
    'Dopo le istruzioni trovi le informazioni che ho. Se non bastano a riempire i campi obbligatori, fai prima le domande e poi la risposta completa.',
    '',
    '----- ISTRUZIONI DEL CLUB -----',
    '',
    instructions(site, [kind]),
    '',
    '----- FINE DELLE ISTRUZIONI -----',
    '',
    'Le informazioni che ho:',
    '',
  ].join('\n');
}
