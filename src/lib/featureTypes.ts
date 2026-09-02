/**
 * What each kind of map feature means to the two flight-computer formats.
 *
 * One table rather than a mapping per file, because a type added here without a
 * CUP style or an OpenAir class would otherwise fall through to a default in
 * one place and be forgotten in the other. Ported from the constants in the
 * Drupal `NavdataController`, which is the only record of these numbers.
 *
 * Colours are deliberately *not* here. They are `--color-map-<type>` in
 * tokens.css, because rule 4 says a colour is defined once as a `light-dark()`
 * pair; a hex in this file would be a second definition that cannot follow the
 * theme.
 */
export type FeatureType = 'takeoff' | 'landing' | 'obstacle' | 'poi';

interface FeatureTypeInfo {
  /** Shown to visitors, so Italian. Singular — it labels one row. */
  label: string;
  /**
   * The plural, written out rather than derived.
   *
   * Italian does not pluralise by appending a letter: decollo → decolli,
   * atterraggio → atterraggi, and "punto di interesse" inflects its first word
   * and not its last. A rule that guessed produced "2 decolloi" and
   * "3 atterraggioi" in the screen-reader description before this field
   * existed.
   */
  labelPlural: string;
  /**
   * SeeYou CUP waypoint style. 20 and 21 are what an instrument reads to draw a
   * takeoff or a landable field; the other two are informational.
   */
  cupStyle: number;
  /**
   * OpenAir airspace class. Only landings are ever written — everything else is
   * either filtered out or has no polygon — but the fallback is recorded so the
   * behaviour is visible rather than implied.
   */
  openAirClass: string;
}

const OPENAIR_DEFAULT_CLASS = 'Q';

export const FEATURE_TYPES: Record<FeatureType, FeatureTypeInfo> = {
  takeoff: {
    label: 'Decollo',
    labelPlural: 'decolli',
    cupStyle: 20,
    openAirClass: OPENAIR_DEFAULT_CLASS,
  },
  landing: {
    label: 'Atterraggio',
    labelPlural: 'atterraggi',
    cupStyle: 21,
    openAirClass: 'W',
  },
  obstacle: {
    label: 'Ostacolo',
    labelPlural: 'ostacoli',
    cupStyle: 8,
    openAirClass: OPENAIR_DEFAULT_CLASS,
  },
  poi: {
    label: 'Punto di interesse',
    labelPlural: 'punti di interesse',
    cupStyle: 19,
    openAirClass: OPENAIR_DEFAULT_CLASS,
  },
};
