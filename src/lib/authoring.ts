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
  return (
    text
      .replaceAll('{{keystatic}}', new URL('/keystatic', site).href)
      .replaceAll('{{istruzioni}}', new URL('/redazione/istruzioni.txt', site).href)
      .replaceAll('{{contenuti}}', new URL('/redazione/contenuti.json', site).href)
      /*
      Straight to the empty form, which saves a volunteer two steps. The branch
      segment is not optional: in GitHub mode `/keystatic/collection/news/create`
      answers "Not found", checked on the deployed admin. `main` is where an
      editor is by default, and where the club has decided they should be.
    */
      .replaceAll(
        '{{nuovanews}}',
        new URL('/keystatic/branch/main/collection/news/create', site).href,
      )
  );
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
export function prompt(site: URL): string {
  return [
    /* One line per paragraph, not wrapped at 80 columns like the document
       below it: this part is read inside a narrow box on a phone, where a hard
       wrap breaks a second time and comes out ragged. */
    'Devi aiutarmi con il sito del Parapendio Club VentoRelativo.',
    '',
    'Segui alla lettera le istruzioni del club che ti incollo qui sotto: sono le regole della casa, comprese quelle su cosa non inventare mai e sul trattino lungo, che non va usato.',
    '',
    'Dopo le istruzioni trovi le informazioni che ho. Se non bastano a riempire i campi obbligatori, fai prima le domande e poi la risposta completa.',
    '',
    '----- ISTRUZIONI DEL CLUB -----',
    '',
    instructions(site),
    '',
    '----- FINE DELLE ISTRUZIONI -----',
    '',
    'Le informazioni che ho:',
    '',
  ].join('\n');
}

/**
 * The short prompt: what the volunteer copies, and what rides in a `?q=`.
 *
 * The full one is 26,736 characters encoded and does not fit in a URL: Google
 * answers 400 to a Gemini link somewhere between 8k and 20k. This one names
 * `/redazione/istruzioni.txt` instead and fits anywhere.
 *
 * The last sentence is what makes it safe to send. `robots.txt` allows this one
 * file on every host, preview builds included, but a free tier usually cannot
 * fetch a page at all. Told to say so rather than to guess, it asks, and
 * `/redazione` keeps the full text one disclosure away for exactly that answer.
 */
export function linkPrompt(site: URL): string {
  return [
    `Leggi le istruzioni del Parapendio Club VentoRelativo su ${new URL('/redazione/istruzioni.txt', site).href}`,
    'e seguile alla lettera per aiutarmi con il loro sito.',
    'Se non riesci ad aprire quella pagina dimmelo subito e te le incollo io: non tirare a indovinare.',
    'Ecco cosa mi serve:',
  ].join(' ');
}

/**
 * The document's tables, as data, for `/redazione/contenuti.json`.
 *
 * Generated rather than written, and generated from the same markdown a person
 * reads, because a hand-kept JSON copy would be a fifth description of the same
 * fields (AGENTS.md rule 12) and the first one to go stale: nothing renders it,
 * so nobody would notice.
 *
 * The columns are mapped explicitly and an unknown header throws. A generic
 * slugifier would quietly turn a renamed column into a new key and every
 * consumer would read `undefined` from then on.
 */
const COLUMNS: Record<string, string> = {
  Campo: 'campo',
  Etichetta: 'etichetta',
  Obbligatorio: 'obbligatorio',
  Regole: 'regole',
  Indirizzo: 'indirizzo',
  "Cosa c'è": 'contenuto',
  'Dove si modifica': 'dove',
  Voce: 'voce',
  Quante: 'quante',
  'Cosa comanda': 'comanda',
  Cosa: 'cosa',
  Perché: 'perche',
};

export interface Table {
  /** The `##` or `###` heading the table sits under. */
  titolo: string;
  righe: Record<string, string | boolean>[];
}

/** Markdown emphasis is for the reader; a consumer of the JSON wants the text. */
const plain = (cell: string) => cell.replace(/[`*]/g, '').trim();

/** "sì" and "no" become booleans; "se è un evento" stays the sentence it is. */
function value(column: string, cell: string): string | boolean {
  const text = plain(cell);
  if (column !== 'obbligatorio') return text;
  if (text === 'sì') return true;
  if (text === 'no') return false;
  return text;
}

function tables(block: string): Table[] {
  const found: Table[] = [];
  let heading = '';
  const lines = block.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const title = line.match(/^#{2,3} (.+)$/);
    if (title) {
      heading = title[1];
      continue;
    }
    if (!line.startsWith('|')) continue;

    const rows: string[] = [];
    while (i < lines.length && lines[i].startsWith('|')) {
      rows.push(lines[i]);
      i += 1;
    }

    /* `| a | b |` splits to ['', 'a', 'b', '']: the outer pipes are borders. */
    const cells = (row: string) => row.split('|').slice(1, -1);
    const columns = cells(rows[0]).map((name) => {
      const key = COLUMNS[plain(name)];
      if (!key) {
        throw new Error(
          `istruzioni.md has a table column "${plain(name)}" that ` +
            'src/lib/authoring.ts does not know. Add it to COLUMNS.',
        );
      }
      return key;
    });

    found.push({
      titolo: heading,
      /* Row 1 is the `---` separator every markdown table carries. */
      righe: rows.slice(2).map((row) =>
        Object.fromEntries(
          cells(row)
            .map((cell, index) => [columns[index], value(columns[index], cell)])
            .filter(([, cell]) => cell !== ''),
        ),
      ),
    });
  }

  return found;
}

export function contentModel(site: URL) {
  return {
    sito: site.origin,
    gestoreContenuti: new URL('/keystatic', site).href,
    istruzioni: new URL('/redazione/istruzioni.txt', site).href,
    lingua: 'it',
    nota:
      'Generato da src/authoring/istruzioni.md, che resta il testo autorevole. ' +
      'Le regole di scrittura e i divieti stanno lì, non qui.',
    mappa: tables(blocks.get('mappa')!),
    tipi: (['news', 'siti', 'pagine'] as Kind[]).map((kind) => ({
      id: kind,
      sezioni: tables(blocks.get(kind)!),
    })),
  };
}
