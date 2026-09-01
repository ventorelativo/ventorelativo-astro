/**
 * Site-wide constants.
 *
 * Values here came from Drupal config (`system.site.yml`, `metatag.*`,
 * `menu_link_content`). In Phase 2 the editable ones move into Keystatic
 * singletons (MIGRATION-PLAN.md G3, G4, G7); this file keeps the things that
 * are genuinely code-level and shouldn't be editor-facing.
 */

export const SITE = {
  /**
   * system.site.yml recorded this as 'Ventorelativo', but the club writes it
   * with the internal capital — as the article bodies and the logo artwork do.
   * Deliberate divergence from the Drupal value, not a transcription slip.
   */
  name: 'VentoRelativo',
  /** system.site.yml: slogan */
  slogan: 'Parapendio Club',
  /** Content language. Single locale; GTranslate handles the rest client-side. */
  lang: 'it',
  /** system.site.yml: mail */
  email: 'segreteria@ventorelativo.it',
  /** metatag.metatag_defaults.global.yml: description */
  description:
    'Esplora la passione per il parapendio con Ventorelativo: il tuo punto di riferimento per il parapendio club situato tra Pinerolo, Val Chisone e Val Pellice. Trova informazioni essenziali per i soci, rimani aggiornato sugli eventi del club e scopri dettagli sui migliori siti di volo della zona.',
} as const;

/**
 * Main navigation — from the 5 `menu_link_content` entities in the `main` menu,
 * in their Drupal weight order (Siti -49, Voli -48, News -47, Iscrizioni -46,
 * Contatti 50).
 *
 * Phase 2 moves this to a Keystatic `navigation` singleton (G4).
 */
export const NAV = [
  { label: 'Siti', href: '/siti' },
  { label: 'Voli', href: '/voli' },
  { label: 'News', href: '/news' },
  { label: 'Iscrizioni', href: '/iscrizioni' },
  { label: 'Contatti', href: '/contatti' },
] as const;

/**
 * The club's reference point, used to centre maps and to scope the XContest
 * searches. Same coordinates the Drupal scraper block used
 * (`filter[point]=7.116547 44.903584`, radius 20 km).
 */
export const CLUB_CENTRE = {
  lat: 44.903584,
  lon: 7.116547,
  /** metres — XContest `filter[radius]` */
  radius: 20000,
} as const;
