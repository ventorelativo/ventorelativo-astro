/**
 * What each kind of map feature means to the two flight-computer formats.
 *
 * One table rather than a mapping per file, because a type added here without a
 * CUP style or an OpenAir class would otherwise fall through to a default in
 * one place and be forgotten in the other. Ported from the constants in the
 * Drupal `NavdataController`, which is the only record of these numbers.
 *
 * Marker colours and icons join this table with the maps (Phase 4b); nothing
 * needs them yet, and inventing them now would be guessing.
 */
export type FeatureType = 'takeoff' | 'landing' | 'obstacle' | 'poi';

interface FeatureTypeInfo {
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
  takeoff: { cupStyle: 20, openAirClass: OPENAIR_DEFAULT_CLASS },
  landing: { cupStyle: 21, openAirClass: 'W' },
  obstacle: { cupStyle: 8, openAirClass: OPENAIR_DEFAULT_CLASS },
  poi: { cupStyle: 19, openAirClass: OPENAIR_DEFAULT_CLASS },
};
