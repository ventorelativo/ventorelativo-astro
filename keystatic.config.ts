/**
 * Keystatic: the editing UI for people who do not open a code editor.
 *
 * ## The two schemas
 *
 * This file and `src/content.config.ts` describe the same data twice, on
 * purpose and by necessity: Keystatic decides what an editor can type, Zod
 * decides what the build will accept. **Change one and change the other.** Zod
 * is the backstop: if these drift, the build fails with a useful message
 * rather than a page rendering wrong.
 *
 * ## Storage: local, for now
 *
 * `kind: 'github'` means the UI reads and writes this repository through the
 * GitHub API: a save is a commit, and Netlify rebuilds from it. Who may edit is
 * decided by GitHub: anyone with write access to the repo, nobody else.
 *
 * It still runs under `npm run dev`, and it also ships with the deployed site,
 * which is why the Netlify adapter arrives in the same phase: the admin needs
 * two server-rendered routes.
 *
 * ## Italian labels
 *
 * The people using this are Italian-speaking volunteers. Field labels and
 * descriptions are in Italian for the same reason the site is.
 */
import { createElement } from 'react';

import { config, collection, singleton, fields } from '@keystatic/core';

import { SITE_OPTIONS } from './src/lib/siteOptions';
import logoQuadrato from './src/assets/press/logo-quadrato.svg?raw';
import { block, wrapper } from '@keystatic/core/content-components';

/**
 * The components a body may contain.
 *
 * This list must match `MDX_COMPONENTS` in src/components/mdx/components.ts:
 * that one decides what renders, this one decides what an editor can insert:
 * and what Keystatic will accept when reading an existing file. An entry using
 * a component missing from here fails to open at all.
 */
const contentComponents = {
  ActionLinks: block({
    label: 'Pulsanti',
    description: 'Una riga di link in evidenza, es. "Iscriviti" o "Info".',
    schema: {
      links: fields.array(
        fields.object({
          label: fields.text({
            label: 'Testo',
            validation: { isRequired: true },
          }),
          href: fields.text({
            label: 'Indirizzo',
            description: 'Esterno (https://…) o interno (/siti/bourcet).',
            validation: { isRequired: true },
          }),
          variant: fields.select({
            label: 'Stile',
            options: [
              { label: 'Pieno', value: 'primary' },
              { label: 'Contorno', value: 'outline' },
            ],
            defaultValue: 'primary',
          }),
        }),
        { label: 'Pulsanti', itemLabel: (props) => props.fields.label.value },
      ),
    },
  }),

  /*
    `wrapper`, not `block`: the note under the colour is the component's
    children, and Keystatic refuses to parse a block that has any. Declared
    the other way it took the media kit page down with "Missing component
    definition for Swatch".
  */
  Swatch: wrapper({
    label: 'Colore del marchio',
    description: 'Un quadrato con il colore, il nome e il codice. Solo nel media kit.',
    schema: {
      color: fields.text({
        label: 'Codice esadecimale',
        description: 'Per esempio #1F52A6.',
        validation: { isRequired: true },
      }),
      name: fields.text({ label: 'Nome', validation: { isRequired: true } }),
    },
  }),

  Facts: block({
    label: 'Scheda dati',
    description:
      'Una riga di dati brevi. Per la data e il luogo di un evento usa invece "È un evento" nella colonna a destra, così finiscono anche nel calendario e su Google.',
    schema: {
      items: fields.array(
        fields.object({
          label: fields.text({ label: 'Etichetta' }),
          value: fields.text({ label: 'Valore' }),
          html: fields.text({
            label: 'Valore con link (avanzato)',
            description:
              'Lasciare vuoto salvo che serva un link. Sovrascrive il valore.',
          }),
        }),
        { label: 'Dati', itemLabel: (props) => props.fields.label.value },
      ),
    },
  }),
};

/** One band of the home page, as an editor sees it. */
const homeSection = (label: string) =>
  fields.object(
    {
      title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
      intro: fields.text({
        label: 'Testo introduttivo',
        description: 'Una o due frasi sotto il titolo. Si può lasciare vuoto.',
        multiline: true,
      }),
      link: fields.text({
        label: 'Testo del link in fondo',
        description: 'Dove porta è fisso: la sezione corrispondente del sito.',
        validation: { isRequired: true },
      }),
    },
    { label },
  );

/**
 * "Descrizione per Google", wherever it appears.
 *
 * The limit is enforced, not suggested: a result truncates at about 160
 * characters, two pages had already sailed past it, and a note an editor can
 * ignore is how they got there. `help` is whatever that particular page needs
 * said on top of the length.
 */
const metaDescription = (help?: string) =>
  fields.text({
    label: 'Descrizione per Google',
    description: [help, 'Massimo 160 caratteri: dopo, Google taglia.']
      .filter(Boolean)
      .join(' '),
    multiline: true,
    validation: { length: { max: 160 } },
  });

/** Reused by both content collections: an image with its alt text. */
const imageWithAlt = (directory: string, publicPath: string) =>
  fields.object(
    {
      src: fields.image({
        label: 'Immagine',
        directory,
        publicPath,
        validation: { isRequired: true },
      }),
      alt: fields.text({
        label: 'Testo alternativo',
        description:
          'Descrive la foto a chi non può vederla, e compare se l’immagine non carica. Es. "Decollo del Bourcet visto da terra".',
        validation: { isRequired: true },
      }),
    },
    { label: 'Immagine' },
  );

/**
 * Where an entry's "Anteprima" button points.
 *
 * Netlify gives every branch its own deploy at `{branch}--{project}.netlify.app`,
 * so an editor sees their own unmerged work rather than the public site.
 * Keystatic substitutes `{branch}` and `{slug}` from wherever the editor is.
 *
 * Two things this depends on, both easy to break:
 *
 *  - **Netlify sanitises branch names into subdomains**, turning anything that
 *    is not alphanumeric into a dash. A branch called `modifiche/estate` is
 *    served at `modifiche-estate--…`, which `{branch}` would not produce, so
 *    BRANCH_PREFIX below ends in a dash rather than a slash.
 *  - **The project name**, not the domain. This stays correct after go-live
 *    moves ventorelativo.it to this project, because branch deploys keep their
 *    netlify.app address regardless.
 */
const PREVIEW_BASE = import.meta.env.DEV
  ? /*
      Relative, so the preview link resolves against whatever the dev server
      is: in local mode there is no branch, `{branch}` became the empty string
      and every preview pointed at `https://--ventorelativo-astro.netlify.app`.
      A relative href also survives a different port without being told.
    */
    ''
  : 'https://{branch}--ventorelativo-astro.netlify.app';

/**
 * Every edit happens on a branch named `modifiche-…`.
 *
 * Without this a save commits straight to `main` and rebuilds the public site:
 * once per save, with half-finished work visible in between. With it an editor
 * makes a batch of changes, previews them, and merges once.
 *
 * It also filters the branch picker, so a volunteer sees their own drafts
 * rather than every development branch in the repository.
 */
const BRANCH_PREFIX = 'modifiche-';

/**
 * The club's mark for the admin's corner, cut from the press kit.
 *
 * `logo-quadrato.svg` is square only because of its white field: the artwork
 * inside is the full lockup, 600 wide by 262 tall, and at mark size its
 * wordmark is a smudge that repeats the "VentoRelativo" printed beside it.
 *
 * So the viewBox is cropped to the mountain alone, measured with `getBBox`:
 * the drawing sits at y 168 to 357, and the two lines of type below 370 fall
 * outside the viewport and are clipped. The white background rect goes with
 * them, so the mark sits on the sidebar's own colour in either theme.
 *
 * `dangerouslySetInnerHTML` because this is our own build-time asset, inlined
 * by Vite: there is no user input anywhere near it.
 */
const LOGO_BODY = logoQuadrato
  .slice(logoQuadrato.indexOf('>') + 1, logoQuadrato.lastIndexOf('</svg>'))
  .replace('<rect width="600" height="600" fill="white"/>', '');

/*
 * The mark, wrapped in a link to the site itself.
 *
 * Keystatic draws the brand as plain decoration, and a logo in the corner is
 * the one thing everybody clicks. It goes to the front page rather than to
 * the dashboard, which the sidebar's first item already reaches: what an
 * editor wants from here is to see what they published.
 */
function BrandMark() {
  return createElement(
    'a',
    {
      href: '/',
      'aria-label': 'Vai al sito',
      style: { display: 'inline-flex', color: 'inherit' },
    },
    createElement('svg', {
      viewBox: '0 168 600 189',
      width: 63,
      height: 20,
      'aria-hidden': true,
      dangerouslySetInnerHTML: { __html: LOGO_BODY },
    }),
  );
}

export default config({
  /*
    Deployed: GitHub mode. The club edits from a browser and every save is a
    commit, which Netlify builds. Requires the four KEYSTATIC_* variables: see
    .env.example; without them /keystatic shows its setup screen.

    Local: the working copy, and no login at all. A developer running
    `npm run dev` wants to edit the files in front of them, not authenticate
    against GitHub and commit to the real repository from a dev machine.

    `import.meta.env.DEV` and not a variable of our own, because Vite replaces
    it with a literal `false` when building. The dangerous direction is a
    deployed admin that thinks it is local: it would write to a serverless
    filesystem and lose every edit, and a compile-time constant makes that
    unreachable rather than merely unlikely.
  */
  storage: import.meta.env.DEV
    ? { kind: 'local' }
    : {
        kind: 'github',
        repo: { owner: 'ventorelativo', name: 'ventorelativo-astro' },
        branchPrefix: BRANCH_PREFIX,
      },

  ui: {
    /*
      The club's mark in the admin's corner, so an editor can see whose site
      they are in: Keystatic looks identical for every project otherwise, and
      the club will have more than one thing on GitHub eventually.

      `createElement` rather than JSX because this file is `.ts`, and renaming
      it to `.tsx` would mean touching every import that names it. The mark is
      the logo's monogram, drawn small: the full lockup is 708x292 and would be
      a stripe in a 24px slot.
    */
    brand: { name: 'VentoRelativo', mark: BrandMark },
    navigation: {
      Contenuti: ['news', 'sites'],
      Pagine: ['home', 'siti', 'voli', 'iscrizioni', 'contatti', 'privacy', 'stampa'],
      Impostazioni: ['social', 'organizzazione'],
    },
  },

  collections: {
    news: collection({
      label: 'News',
      path: 'src/content/news/*',
      previewUrl: `${PREVIEW_BASE}/news/{slug}/`,
      format: { contentField: 'content' },
      /*
        The slug is the URL. Existing posts keep theirs: these URLs are live
        and preserved from the Drupal site (D9), so renaming one is a
        deliberate act, not a side effect of editing a title.
      */
      slugField: 'title',
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({
          name: {
            label: 'Titolo',
            /*
              Where the kit gets found. Keystatic's `ui.navigation` takes
              collection and singleton keys only, so the admin has nowhere to
              hang a link, and under `entryLayout: 'content'` the body field's
              own description is never drawn: the first sidebar field is.

              A path, not a URL: the CMS is served from the same host, and
              that host changes at the cutover.
            */
            description:
              'Meglio sotto i 60 caratteri: dopo, Google taglia il titolo. Serve una mano a scrivere? Su /redazione trovi il testo da incollare in ChatGPT o Gemini per farti preparare tutti i campi.',
            validation: { isRequired: true },
          },
          slug: {
            label: 'Indirizzo (URL)',
            description:
              'La parte finale dell’indirizzo della pagina. Cambiarlo su un articolo già pubblicato rompe i link esistenti.',
          },
        }),
        date: fields.date({
          label: 'Data di pubblicazione',
          description:
            'Il giorno in cui esce la notizia. Non è la data dell’evento: quella si scrive più in basso, in "È un evento".',
          validation: { isRequired: true },
          defaultValue: { kind: 'today' },
        }),
        summary: fields.text({
          label: 'Sommario',
          description:
            'Una o due frasi. Compare nell’elenco delle news, su Google e quando il link viene condiviso, quindi serve sempre. Massimo 160 caratteri: dopo, Google taglia.',
          multiline: true,
          /*
            160, not the 300 this allowed: the summary is the page's meta
            description, and one post had already written past what a result
            shows. A limit the field enforces is the only kind that holds.
          */
          validation: { isRequired: true, length: { min: 40, max: 160 } },
        }),
        image: imageWithAlt('src/assets/news', '../../assets/news/'),
        category: fields.select({
          label: 'Categoria',
          options: [
            { label: 'Evento', value: 'Evento' },
            { label: 'Competizione', value: 'Competizione' },
            { label: 'Hike&Fly', value: 'Hike&Fly' },
            { label: 'Assemblea', value: 'Assemblea' },
          ],
          defaultValue: 'Evento',
        }),
        /*
          Filled in only when the post announces an event. Keystatic's
          conditional field shows the date and place inputs when the box is
          ticked and hides them otherwise, so an ordinary news post is not asked
          for a date it does not have.
        */
        event: fields.conditional(
          fields.checkbox({
            label: 'È un evento',
            description:
              'Aggiunge data e luogo, il pulsante "Aggiungi al calendario" e la scheda evento per Google.',
            defaultValue: false,
          }),
          {
            false: fields.empty(),
            true: fields.object({
              start: fields.date({
                label: 'Giorno dell’evento',
                description: 'Non la data di pubblicazione: il giorno in cui si vola.',
                validation: { isRequired: true },
              }),
              end: fields.date({
                label: 'Ultimo giorno (solo se dura più giorni)',
              }),
              /*
                One findable place, not a takeoff.

                This string becomes `LOCATION` in the `.ics`, which Google
                Calendar hands to its geocoder, and a takeoff is precisely what
                a geocoder cannot find: no road, no address, no name a map
                knows. The club gathers at the landing anyway, because that is
                where the cars are. Which site it belongs to is the field
                below.
              */
              location: fields.text({
                label: 'Luogo del ritrovo',
                description:
                  'Un indirizzo, un comune, un parcheggio: qualcosa che Google Maps sappia trovare, perché finisce nel calendario di chi si iscrive. Es. "Bagnolo Piemonte (CN)".',
                validation: { isRequired: true },
              }),
              /*
                A select, not `fields.relationship`, for one reason: the
                relationship input renders `<Item>{item.slug}</Item>`, so the
                picker would offer "pian-dellalpe" where a volunteer is looking
                for "Pian dell'Alpe". A select takes a label and a value.

                The list is generated from the sites themselves by
                scripts/build-site-options.mjs, before every dev and build, so
                renaming or adding a site is a content change and nothing else.
                This file is bundled for the browser and cannot read the
                content directory itself.
              */
              site: fields.select({
                label: 'Sito di volo',
                description:
                  'Se si vola in uno dei nostri siti, scegli quale: la news mostra il collegamento alla sua scheda, che dice dove sono i decolli.',
                defaultValue: '',
                options: [
                  /* Empty, not absent: a select has no empty state, so "no
                     site" needs a value of its own. Zod turns it back into
                     undefined. */
                  { label: '(nessuno)', value: '' },
                  ...SITE_OPTIONS,
                ],
              }),
            }),
          },
        ),
        draft: fields.checkbox({
          label: 'Bozza',
          description: 'Se selezionato, l’articolo non viene pubblicato.',
          defaultValue: false,
        }),
        content: fields.mdx({
          label: 'Contenuto',
          options: {
            image: {
              directory: 'src/assets/news',
              publicPath: '../../assets/news/',
            },
          },
          components: contentComponents,
        }),
      },
    }),

    sites: collection({
      label: 'Siti di volo',
      path: 'src/content/sites/*',
      previewUrl: `${PREVIEW_BASE}/siti/{slug}/`,
      format: { contentField: 'content' },
      slugField: 'title',
      entryLayout: 'content',
      columns: ['title', 'summary'],
      schema: {
        title: fields.slug({
          name: {
            label: 'Nome',
            /* Same reasoning as the news title above. */
            description:
              'Serve una mano a scrivere? Su /redazione trovi il testo da incollare in ChatGPT o Gemini per farti preparare tutti i campi.',
            validation: { isRequired: true },
          },
          slug: {
            label: 'Indirizzo (URL)',
            description:
              'Cambiarlo rompe i link esistenti e le ricerche già indicizzate.',
          },
        }),
        summary: fields.text({
          label: 'Scheda breve',
          description:
            'Quota, esposizione e comune. Per esempio "1969m, S-SE, Roure (TO)". Compare nell’elenco dei siti e su Google.',
          validation: { isRequired: true },
        }),
        description: metaDescription(
          'Una o due frasi che dicano dove si trova e cosa ci si vola. Compare nei risultati di ricerca, dove la scheda breve qui sopra non dice niente a chi non conosce il posto. Nomina il comune e i paesi vicini: è così che ti trovano.',
        ),
        guideUrl: fields.url({
          label: 'Windgram',
          description:
            'Pagina con il windgram e le previsioni per questo sito, per esempio su paragliding-kubernetes.web-forge.info. Lasciare vuoto se non ce n’è una.',
        }),
        tags: fields.array(fields.text({ label: 'Etichetta' }), {
          label: 'Etichette',
          description:
            'Caratteristiche del sito, es. "Adatto ai principianti", "Hike&Fly".',
          itemLabel: (props) => props.value,
        }),
        /*
          Phase 4's map geometry, carried through untouched.

          It has to be declared even though nobody edits it here: Keystatic
          refuses to open an entry whose frontmatter contains a key its schema
          does not know, and every site file carries `mapFeatures` (AGENTS.md
          rule 11). `ignored()` parses the value and writes it back unchanged
          while rendering no input at all.

          Deliberately not an editable relationship yet. These slugs point at
          the geometry behind /api/navdata/*, which pilots load into their
          instruments (rule 9); attaching and detaching them is a Phase 4
          design question, not a text box to add in passing.
        */
        mapFeatures: fields.ignored(),
        featured: fields.checkbox({
          label: 'In evidenza',
          description: 'I siti in evidenza compaiono per primi nell’elenco.',
          defaultValue: false,
        }),
        images: fields.array(imageWithAlt('src/assets/sites', '../../assets/sites/'), {
          label: 'Galleria',
          itemLabel: (props) => props.fields.alt.value || 'Immagine',
        }),
        content: fields.mdx({
          label: 'Descrizione',
          options: {
            image: {
              directory: 'src/assets/sites',
              publicPath: '../../assets/sites/',
            },
          },
          components: contentComponents,
        }),
      },
    }),
  },

  singletons: {
    /*
      Site-wide, belonging to no page. The network is a choice rather than a
      free-text name because the icon is an SVG path in Footer.astro: one that
      is not in that list would render a hole, so the schema refuses it.
    */
    organizzazione: singleton({
      label: "Dati dell'associazione",
      path: 'src/content/settings/organization',
      format: 'yaml',
      schema: {
        legalName: fields.text({
          label: 'Denominazione',
          description: 'Il nome per esteso, come sullo statuto.',
        }),
        taxCode: fields.text({ label: 'Codice fiscale' }),
        vatNumber: fields.text({
          label: 'Partita IVA',
          description: 'Se ne avete una.',
        }),
        registeredOffice: fields.text({
          label: 'Sede legale',
          description:
            'Lascia vuoto se è un indirizzo privato: non è obbligatorio pubblicarlo, e la mail basta come recapito.',
        }),
        pec: fields.text({ label: 'PEC' }),
        registryNumber: fields.text({
          label: 'Numero registro',
          description:
            'Registro nazionale delle attività sportive dilettantistiche (RASD).',
        }),
        affiliation: fields.text({
          label: 'Affiliazione',
          description: 'Per esempio «Affiliata FIVL n. 1234».',
        }),
      },
    }),

    social: singleton({
      label: 'Social',
      path: 'src/content/settings/social',
      format: 'yaml',
      schema: {
        links: fields.array(
          fields.object({
            network: fields.select({
              label: 'Rete',
              options: [
                { label: 'Facebook', value: 'facebook' },
                { label: 'Instagram', value: 'instagram' },
                { label: 'YouTube', value: 'youtube' },
              ],
              defaultValue: 'facebook',
            }),
            href: fields.url({ label: 'Indirizzo', validation: { isRequired: true } }),
          }),
          { label: 'Profili', itemLabel: (props) => props.fields.network.value },
        ),
      },
    }),

    home: singleton({
      previewUrl: `${PREVIEW_BASE}/`,
      label: 'Pagina: Home',
      path: 'src/content/pages/home',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: metaDescription(),
        hero: fields.object(
          {
            src: fields.image({
              label: 'Immagine di sfondo',
              directory: 'src/assets',
              publicPath: '../../assets/',
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: 'Testo alternativo',
              description:
                'Lasciare vuoto: la foto è decorativa e il senso della pagina non dipende da essa.',
            }),
            /*
              Inside the image, not beside it: the credit belongs to the
              photograph, so swapping one asks for the other in the same breath.
            */
            credit: fields.object(
              {
                text: fields.text({ label: 'Autore' }),
                href: fields.url({ label: 'Link all’originale' }),
              },
              { label: 'Crediti foto' },
            ),
          },
          { label: 'Sfondo' },
        ),
        /*
          The words around each band of the home page. Not its contents: the
          site list, the news cards, the searches and the quote cards all come
          from the entries themselves, and the address each link points at is
          the site's own section, so it stays in the code where a typo cannot
          quietly break the home page.
        */
        sections: fields.object(
          {
            siti: homeSection('Dove voliamo'),
            news: homeSection('Eventi e news'),
            voli: homeSection('I nostri voli'),
            iscrizioni: homeSection('Iscriversi'),
            contatti: homeSection('Contatti'),
          },
          { label: 'Sezioni della home' },
        ),
        content: fields.mdx({
          label: 'Testo della home',
          description:
            'I paragrafi sotto la foto grande. Dì che club siamo, dove voliamo e nomina i paesi: è così che ci trova chi cerca "parapendio" e il nome di un posto.',
        }),
      },
    }),

    voli: singleton({
      previewUrl: `${PREVIEW_BASE}/voli/`,
      label: 'Pagina: I nostri voli',
      path: 'src/content/pages/voli',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: metaDescription(),
        content: fields.mdx({ label: 'Testo introduttivo' }),
      },
    }),

    iscrizioni: singleton({
      previewUrl: `${PREVIEW_BASE}/iscrizioni/`,
      label: 'Pagina: Iscrizioni',
      path: 'src/content/pages/iscrizioni',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: metaDescription(),
        content: fields.mdx({ label: 'Testo introduttivo' }),
        /*
          The quote fields §2.4 asked for. When the committee settles D10, the
          switch from Satispay to Stripe is these URLs and nothing else.
        */
        tiers: fields.array(
          fields.object({
            name: fields.text({ label: 'Nome', validation: { isRequired: true } }),
            price: fields.integer({
              label: 'Prezzo in euro',
              validation: { isRequired: true },
            }),
            period: fields.text({
              label: 'Periodo',
              description: "Per esempio «all'anno». Lascia vuoto per non indicarlo.",
            }),
            tagline: fields.text({
              label: 'A chi è rivolta',
              description: 'Una riga sotto il nome.',
            }),
            benefits: fields.array(fields.text({ label: 'Vantaggio' }), {
              label: 'Cosa comprende',
              itemLabel: (props) => props.value,
            }),
            limits: fields.array(fields.text({ label: 'Limite' }), {
              label: 'Cosa non comprende',
              description:
                'Serve a dire chiaramente la differenza tra Sostenitore e Socio.',
              itemLabel: (props) => props.value,
            }),
            badge: fields.text({
              label: 'Etichetta',
              description: 'Per esempio «Consigliata». Solo sulla quota in evidenza.',
            }),
            payUrl: fields.url({
              label: 'Link di pagamento',
              validation: { isRequired: true },
            }),
            payLabel: fields.text({
              label: 'Testo del pulsante',
              defaultValue: 'Paga con Satispay',
            }),
            highlight: fields.checkbox({
              label: 'In evidenza',
              defaultValue: false,
            }),
          }),
          { label: 'Quote', itemLabel: (props) => props.fields.name.value },
        ),
        bankTransfer: fields.object(
          {
            holder: fields.text({ label: 'Intestatario' }),
            iban: fields.text({ label: 'IBAN' }),
          },
          { label: 'Bonifico bancario' },
        ),
      },
    }),

    siti: singleton({
      previewUrl: `${PREVIEW_BASE}/siti/`,
      label: 'Pagina: Siti di volo',
      path: 'src/content/pages/siti',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: metaDescription(),
        content: fields.mdx({ label: 'Testo introduttivo' }),
      },
    }),

    stampa: singleton({
      previewUrl: `${PREVIEW_BASE}/stampa/`,
      label: 'Pagina: Media kit',
      path: 'src/content/pages/stampa',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: metaDescription(),
        content: fields.mdx({
          label: 'Linee guida',
          // Without this the page will not open: its body uses <Swatch>.
          components: contentComponents,
        }),
      },
    }),

    privacy: singleton({
      previewUrl: `${PREVIEW_BASE}/privacy/`,
      label: 'Pagina: Privacy',
      path: 'src/content/pages/privacy',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: metaDescription(),
        content: fields.mdx({ label: 'Informativa' }),
      },
    }),

    contatti: singleton({
      previewUrl: `${PREVIEW_BASE}/contatti/`,
      label: 'Pagina: Contatti',
      path: 'src/content/pages/contatti',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: metaDescription(),
        content: fields.mdx({ label: 'Testo introduttivo' }),
        contacts: fields.array(
          fields.object({
            kind: fields.select({
              label: 'Tipo',
              options: [
                { label: 'Telefono', value: 'phone' },
                { label: 'WhatsApp', value: 'whatsapp' },
                { label: 'Email', value: 'email' },
              ],
              defaultValue: 'phone',
            }),
            label: fields.text({ label: 'Etichetta' }),
            href: fields.text({
              label: 'Link',
              description: 'Es. tel:+39…, https://wa.me/39…, mailto:…',
            }),
          }),
          { label: 'Contatti', itemLabel: (props) => props.fields.label.value },
        ),
      },
    }),
  },
});
