/**
 * Keystatic — the editing UI for people who do not open a code editor.
 *
 * ## The two schemas
 *
 * This file and `src/content.config.ts` describe the same data twice, on
 * purpose and by necessity: Keystatic decides what an editor can type, Zod
 * decides what the build will accept. **Change one and change the other.** Zod
 * is the backstop — if these drift, the build fails with a useful message
 * rather than a page rendering wrong.
 *
 * ## Storage: local, for now
 *
 * `kind: 'github'` means the UI reads and writes this repository through the
 * GitHub API: a save is a commit, and Netlify rebuilds from it. Who may edit is
 * decided by GitHub — anyone with write access to the repo, nobody else.
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
import { config, collection, singleton, fields } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';

/**
 * The components a body may contain.
 *
 * This list must match `MDX_COMPONENTS` in src/components/mdx/components.ts:
 * that one decides what renders, this one decides what an editor can insert —
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
 *    served at `modifiche-estate--…`, which `{branch}` would not produce — so
 *    BRANCH_PREFIX below ends in a dash rather than a slash.
 *  - **The project name**, not the domain. This stays correct after go-live
 *    moves ventorelativo.it to this project, because branch deploys keep their
 *    netlify.app address regardless.
 */
const PREVIEW_BASE = 'https://{branch}--ventorelativo-astro.netlify.app';

/**
 * Every edit happens on a branch named `modifiche-…`.
 *
 * Without this a save commits straight to `main` and rebuilds the public site —
 * once per save, with half-finished work visible in between. With it an editor
 * makes a batch of changes, previews them, and merges once.
 *
 * It also filters the branch picker, so a volunteer sees their own drafts
 * rather than every development branch in the repository.
 */
const BRANCH_PREFIX = 'modifiche-';

export default config({
  /*
    Deployed: GitHub mode. The club edits from a browser and every save is a
    commit, which Netlify builds. Requires the four KEYSTATIC_* variables — see
    .env.example; without them /keystatic shows its setup screen.

    Local: the working copy, and no login at all. A developer running
    `npm run dev` wants to edit the files in front of them, not authenticate
    against GitHub and commit to the real repository from a dev machine.

    `import.meta.env.DEV` and not a variable of our own, because Vite replaces
    it with a literal `false` when building. The dangerous direction is a
    deployed admin that thinks it is local — it would write to a serverless
    filesystem and lose every edit — and a compile-time constant makes that
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
    brand: { name: 'VentoRelativo' },
    navigation: {
      Contenuti: ['news', 'sites'],
      Pagine: ['home', 'voli', 'iscrizioni', 'contatti'],
      Impostazioni: ['social'],
    },
  },

  collections: {
    news: collection({
      label: 'News',
      path: 'src/content/news/*',
      previewUrl: `${PREVIEW_BASE}/news/{slug}/`,
      format: { contentField: 'content' },
      /*
        The slug is the URL. Existing posts keep theirs — these URLs are live
        and preserved from the Drupal site (D9), so renaming one is a
        deliberate act, not a side effect of editing a title.
      */
      slugField: 'title',
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({
          name: { label: 'Titolo', validation: { isRequired: true } },
          slug: {
            label: 'Indirizzo (URL)',
            description:
              'La parte finale dell’indirizzo della pagina. Cambiarlo su un articolo già pubblicato rompe i link esistenti.',
          },
        }),
        date: fields.date({
          label: 'Data',
          validation: { isRequired: true },
          defaultValue: { kind: 'today' },
        }),
        summary: fields.text({
          label: 'Sommario',
          description:
            'Una o due frasi. Compare nell’elenco delle news, su Google e quando il link viene condiviso — quindi serve sempre.',
          multiline: true,
          validation: { isRequired: true, length: { min: 40, max: 300 } },
        }),
        image: imageWithAlt('src/assets/news', '../../assets/news/'),
        category: fields.select({
          label: 'Categoria',
          options: [
            { label: 'Eventi', value: 'Eventi' },
            { label: 'Competizioni', value: 'Competizioni' },
            { label: 'Hike&Fly', value: 'Hike&Fly' },
          ],
          defaultValue: 'Eventi',
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
              location: fields.text({
                label: 'Decollo / ritrovo',
                description: 'Dove ci si trova. Es. "Montoso (Bagnolo Piemonte)".',
                validation: { isRequired: true },
              }),
              landing: fields.text({ label: 'Atterraggio' }),
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
          name: { label: 'Nome', validation: { isRequired: true } },
          slug: {
            label: 'Indirizzo (URL)',
            description:
              'Cambiarlo rompe i link esistenti e le ricerche già indicizzate.',
          },
        }),
        summary: fields.text({
          label: 'Scheda breve',
          description:
            'Quota, esposizione e comune — es. "1969m, S-SE, Roure (TO)". Compare nell’elenco dei siti e su Google.',
          validation: { isRequired: true },
        }),
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
      free-text name because the icon is an SVG path in Footer.astro — one that
      is not in that list would render a hole, so the schema refuses it.
    */
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
        description: fields.text({ label: 'Descrizione per Google', multiline: true }),
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
        ctas: fields.array(
          fields.object({
            label: fields.text({ label: 'Testo', validation: { isRequired: true } }),
            href: fields.text({ label: 'Indirizzo', validation: { isRequired: true } }),
            primary: fields.checkbox({
              label: 'Pulsante principale',
              description: 'Uno solo: gli altri sono con il contorno.',
            }),
          }),
          { label: 'Pulsanti', itemLabel: (props) => props.fields.label.value },
        ),
        content: fields.mdx({ label: 'Testo (non usato oggi)' }),
      },
    }),

    voli: singleton({
      previewUrl: `${PREVIEW_BASE}/voli/`,
      label: 'Pagina: I nostri voli',
      path: 'src/content/pages/voli',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: fields.text({
          label: 'Descrizione per Google',
          multiline: true,
        }),
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
        description: fields.text({
          label: 'Descrizione per Google',
          multiline: true,
        }),
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
            benefits: fields.array(fields.text({ label: 'Vantaggio' }), {
              label: 'Vantaggi',
              itemLabel: (props) => props.value,
            }),
            payUrl: fields.url({
              label: 'Link di pagamento',
              validation: { isRequired: true },
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

    contatti: singleton({
      previewUrl: `${PREVIEW_BASE}/contatti/`,
      label: 'Pagina: Contatti',
      path: 'src/content/pages/contatti',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Titolo', validation: { isRequired: true } }),
        description: fields.text({
          label: 'Descrizione per Google',
          multiline: true,
        }),
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
