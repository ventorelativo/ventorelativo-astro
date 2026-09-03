/**
 * Date formatting for a single-locale, Italian-language site.
 *
 * `SITE.lang` is 'it' and there is no i18n routing (GTranslate handles other
 * languages client-side), so the locale is hardcoded here rather than threaded
 * through every component.
 */

const FORMATTER = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "26 ottobre 2025", the human-facing form. */
export const formatDate = (date: Date) => FORMATTER.format(date);

/** "2025-10-26", for <time datetime>, sitemaps and RSS. */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
