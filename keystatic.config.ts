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
 * `kind: 'local'` means the UI writes straight to the files in this working
 * copy. It runs under `npm run dev` at http://localhost:4321/keystatic and is
 * not part of the production build — the admin needs server-rendered routes,
 * and this site is deliberately adapter-less until Phase 3
 * (MIGRATION-PLAN.md §7, AGENTS.md rule 3).
 *
 * Phase 3 switches this to `kind: 'github'`, at which point the club edits the
 * live site from a browser and Netlify rebuilds on the commit Keystatic makes.
 * Nothing else in this file changes.
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
      'Una riga di dati brevi — es. Quando / Decollo / Atterraggio.',
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

export default config({
  storage: { kind: 'local' },

  ui: {
    brand: { name: 'VentoRelativo' },
    navigation: {
      Contenuti: ['news', 'sites'],
      Pagine: ['voli', 'iscrizioni', 'contatti'],
    },
  },

  collections: {
    news: collection({
      label: 'News',
      path: 'src/content/news/*',
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
        tags: fields.array(fields.text({ label: 'Etichetta' }), {
          label: 'Etichette',
          description:
            'Caratteristiche del sito, es. "Adatto ai principianti", "Hike&Fly".',
          itemLabel: (props) => props.value,
        }),
        featured: fields.checkbox({
          label: 'In evidenza',
          description: 'I siti in evidenza compaiono per primi nell’elenco.',
          defaultValue: false,
        }),
        images: fields.array(
          imageWithAlt('src/assets/sites', '../../assets/sites/'),
          {
            label: 'Galleria',
            itemLabel: (props) => props.fields.alt.value || 'Immagine',
          },
        ),
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
    voli: singleton({
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
