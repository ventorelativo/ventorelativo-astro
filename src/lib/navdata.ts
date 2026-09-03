/**
 * The two flight-computer files, `/api/navdata/*`.
 *
 * **This is safety-critical output** (AGENTS.md rule 9). Pilots load it into
 * their instruments, so it is not a place to improve on the original: the goal
 * is bytes identical to what Drupal served. `npm run navdata:check` diffs both
 * files against the archived build and is the gate on any change here.
 *
 * Every decision below was read off `NavdataController.php` and
 * `views.view.flight_data.yml` in the Drupal repo, not inferred from the output:
 *
 *  - **Which features go in each file** is decided by the view, not by the type
 *    table. Waypoints take everything except `poi`; airspace everything except
 *    `obstacle`. A feature then contributes only if it has the geometry that
 *    file is made of, which is why the counts are 29 and 13 rather than 33 and
 *    14. The obstacle is a bare line, so it has no point and no polygon.
 *  - **Both files sort by name**, ascending, inherited from the view's default
 *    display.
 *  - **PHP's `%f` rounds; its `(int)` cast truncates.** Reproduced exactly:
 *    `toFixed` rounds the same way, and `Math.trunc` matches the cast. The
 *    difference is visible in the data: Bagnolo's longitude is 18.1395 minutes
 *    to the eye, but 18.139499999999984 as a double, so it renders `18.139` and
 *    not `18.140`.
 */
import { FEATURE_TYPES, type FeatureType } from './featureTypes';

/** One feature, reduced to what these two files need. */
export interface NavFeature {
  name: string;
  type: FeatureType;
  point?: { lat: number; lon: number };
  shape?: { discriminant: 'polygon' | 'line'; value: [number, number][] };
}

/**
 * Decimal degrees as CUP `DDMM.mmm` / `DDDMM.mmm`.
 *
 * PHP: `sprintf('%02d%06.3f%s')`. The `%06` is a zero-padded width of six
 * covering the whole `MM.mmm`, so nine minutes is `09.000` and never `9.000`.
 */
export function toCupCoordinate(degrees: number, isLongitude: boolean): string {
  const hemisphere = isLongitude
    ? degrees >= 0
      ? 'E'
      : 'W'
    : degrees >= 0
      ? 'N'
      : 'S';
  const absolute = Math.abs(degrees);
  const wholeDegrees = Math.trunc(absolute);
  const minutes = (absolute - wholeDegrees) * 60;

  return (
    String(wholeDegrees).padStart(isLongitude ? 3 : 2, '0') +
    minutes.toFixed(3).padStart(6, '0') +
    hemisphere
  );
}

/**
 * Decimal degrees as OpenAir `DD:MM:SS.SS N` / `DDD:MM:SS.SS E`.
 *
 * PHP: `sprintf('%02d:%02d:%05.2f %s')`. Minutes are truncated before seconds
 * are taken from the remainder, so the rounding only ever happens once, in the
 * seconds.
 */
export function toDms(degrees: number, isLongitude: boolean): string {
  const hemisphere = isLongitude
    ? degrees >= 0
      ? 'E'
      : 'W'
    : degrees >= 0
      ? 'N'
      : 'S';
  const absolute = Math.abs(degrees);
  const wholeDegrees = Math.trunc(absolute);
  const rawMinutes = (absolute - wholeDegrees) * 60;
  const minutes = Math.trunc(rawMinutes);
  const seconds = (rawMinutes - minutes) * 60;

  return [
    String(wholeDegrees).padStart(isLongitude ? 3 : 2, '0'),
    String(minutes).padStart(2, '0'),
    `${seconds.toFixed(2).padStart(5, '0')} ${hemisphere}`,
  ].join(':');
}

/** Name ascending, as the view ordered it. */
function byName(a: NavFeature, b: NavFeature): number {
  return a.name.localeCompare(b.name, 'it');
}

/**
 * `ventorelativo-waypoints.cup`: everything but points of interest, provided
 * it has a point.
 *
 * The empty columns are not padding: a CUP row is twelve fields, and readers
 * position by comma. `code`, `elev`, `rwdir`, `rwlen`, `rwwidth`, `freq` and
 * `desc` were empty in the Drupal output and stay empty here.
 */
export function buildCup(features: NavFeature[]): string {
  const rows = features
    .filter((feature) => feature.type !== 'poi' && feature.point)
    .sort(byName)
    .map((feature) => {
      const { lat, lon } = feature.point!;
      // A quote inside a CUP name is escaped by doubling it, as in CSV.
      const name = feature.name.replace(/"/g, '""');
      const style = FEATURE_TYPES[feature.type].cupStyle;

      return `"${name}",,IT,${toCupCoordinate(lat, false)},${toCupCoordinate(lon, true)},,${style},,,,,`;
    });

  return (
    [
      'name,code,country,lat,lon,elev,style,rwdir,rwlen,rwwidth,freq,desc',
      ...rows,
    ].join('\n') + '\n'
  );
}

/**
 * `ventorelativo-airspace.txt`: everything but obstacles, provided it has a
 * polygon. In practice that is the thirteen landing zones.
 *
 * `generated` is the only line that varies between builds, and the only line
 * the diff gate ignores.
 */
export function buildOpenAir(features: NavFeature[], generated: Date): string {
  const lines = [
    '* Ventorelativo - zone di volo (OpenAir)',
    `* Generated: ${generated.toISOString().slice(0, 10)}`,
    '',
  ];

  for (const feature of features
    .filter(
      (feature) =>
        feature.type !== 'obstacle' && feature.shape?.discriminant === 'polygon',
    )
    .sort(byName)) {
    lines.push(
      `AC ${FEATURE_TYPES[feature.type].openAirClass}`,
      `AN ${feature.name}`,
      'AL SFC',
      // Surface to 100ft above ground: a landing zone, not controlled airspace.
      'AH 100ft AGL',
    );
    for (const [lon, lat] of feature.shape!.value) {
      lines.push(`DP ${toDms(lat, false)} ${toDms(lon, true)}`);
    }
    // Blank line after each block. The last one supplies the file's final
    // newline through the join, which is why nothing is appended below.
    lines.push('');
  }

  return lines.join('\n');
}
