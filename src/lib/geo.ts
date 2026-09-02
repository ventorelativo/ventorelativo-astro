/**
 * Turning longitude/latitude into SVG coordinates.
 *
 * Small enough to be exact for what it does: every site here fits inside a few
 * kilometres, and over that distance the earth is flat enough that a proper
 * projection library would be 40 kB spent on a difference nobody can see.
 *
 * The one thing that *is* needed is the longitude squeeze. A degree of
 * longitude at 44.8°N is about 71% of a degree of latitude, so plotting raw
 * lon/lat stretches every landing field sideways. Multiplying longitude by
 * `cos(latitude)` fixes it — that is a local equirectangular projection, and at
 * this scale it is indistinguishable from anything more expensive.
 */
export interface LatLon {
  lat: number;
  lon: number;
}

export interface Bounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** The box containing every point given. Throws on nothing, which is a caller bug. */
export function boundsOf(points: LatLon[]): Bounds {
  if (points.length === 0) throw new Error('boundsOf needs at least one point');

  return points.reduce<Bounds>(
    (box, { lat, lon }) => ({
      minLat: Math.min(box.minLat, lat),
      minLon: Math.min(box.minLon, lon),
      maxLat: Math.max(box.maxLat, lat),
      maxLon: Math.max(box.maxLon, lon),
    }),
    { minLat: 90, minLon: 180, maxLat: -90, maxLon: -180 },
  );
}

/**
 * A viewBox 1000 units wide, and functions putting a coordinate inside it.
 *
 * Width is fixed so the emitted path data is short, readable integers rather
 * than sixteen-digit fractions of a degree — the same SVG, several kB smaller.
 */
export interface Projection {
  width: number;
  height: number;
  x(lon: number): number;
  y(lat: number): number;
}

const VIEW_WIDTH = 1000;

/**
 * Roughly 200 m, the floor for how small the drawn area may be.
 *
 * Without it a site whose features share one point projects to a zero-sized box
 * and every coordinate divides by zero. With it, a single takeoff renders as a
 * marker in a sensibly sized patch of ground instead of `NaN`.
 */
const MIN_SPAN_DEGREES = 0.002;

export function project(bounds: Bounds, aspect: number, padding = 0.12): Projection {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);

  // Planar extent, longitude already squeezed.
  let width = Math.max((bounds.maxLon - bounds.minLon) * lonScale, MIN_SPAN_DEGREES);
  let height = Math.max(bounds.maxLat - bounds.minLat, MIN_SPAN_DEGREES);

  // Breathing room, so a marker never sits against the frame.
  width *= 1 + padding * 2;
  height *= 1 + padding * 2;

  // Grow the short side to the requested aspect rather than shrinking the long
  // one, which would push features out of frame.
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;

  const centreX = ((bounds.minLon + bounds.maxLon) / 2) * lonScale;
  const left = centreX - width / 2;
  const top = midLat + height / 2;
  const scale = VIEW_WIDTH / width;

  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    width: VIEW_WIDTH,
    height: round(VIEW_WIDTH / aspect),
    x: (lon) => round((lon * lonScale - left) * scale),
    y: (lat) => round((top - lat) * scale),
  };
}
