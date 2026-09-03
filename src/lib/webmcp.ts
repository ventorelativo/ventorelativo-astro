/**
 * The tools this site offers a visitor's AI assistant (WebMCP).
 *
 * Loaded only by browsers that have the API — see `WebMcp.astro`, which does
 * the feature check before importing this file. Everyone else downloads
 * nothing from here.
 *
 * ## What the tools answer from
 *
 * `/api/siti.json`, fetched once on first use. Nothing is duplicated into the
 * bundle: the data has one source, the content collections, and this reads the
 * same file the build wrote from them.
 *
 * ## Why these three tools and not more
 *
 * They are the questions the club's data can answer honestly. Altitude and
 * exposure are prose inside `summary` and are returned as written rather than
 * offered as filters — a `maxAltitude` parameter would have to parse
 * "1581m/1276m" and would be quietly wrong on the sites with two takeoffs.
 *
 * Everything a tool returns is public content already on the page. Nothing
 * here writes, pays, submits or reveals anything a visitor could not read.
 *
 * ## The API is moving
 *
 * It is a W3C Community Group draft, not a standard: Chrome shipped it under
 * `navigator.modelContext` and deprecated that for `document.modelContext` in
 * Chrome 150, and methods have come and gone. Both spellings are accepted
 * below, newest first. If it is renamed again this file is where to look.
 */

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (input: Record<string, unknown>) => Promise<{
    content: { type: 'text'; text: string }[];
  }>;
}

interface ModelContext {
  registerTool: (tool: Tool) => void;
}

interface Place {
  name: string;
  lat: number;
  lon: number;
}

interface Site {
  slug: string;
  name: string;
  summary: string;
  url: string;
  tags: string[];
  takeoffs: Place[];
  landings: Place[];
  guideUrl: string | null;
}

/** Whichever spelling this browser has. Newest first. */
export function modelContext(): ModelContext | undefined {
  const doc = (document as unknown as { modelContext?: ModelContext }).modelContext;
  const nav = (navigator as unknown as { modelContext?: ModelContext }).modelContext;
  return doc ?? nav;
}

let cached: Promise<Site[]> | undefined;

function sites(): Promise<Site[]> {
  cached ??= fetch('/api/siti.json')
    .then((response) => response.json())
    .then((data: { sites: Site[] }) => data.sites);
  return cached;
}

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

/** Great-circle distance in kilometres. */
function distance(a: Place, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const TOOLS: Tool[] = [
  {
    name: 'find_flight_sites',
    description:
      "Search the club's paragliding sites in the Pinerolo, Val Chisone and Val Pellice " +
      'valleys. Filter by attribute (e.g. beginner-friendly, hike & fly), by free text, ' +
      'or by distance from a coordinate. Returns each site with its takeoffs and the ' +
      "club's own one-line description, which carries altitude, exposure and comune in " +
      'Italian.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "Free text matched against the site's name and description.",
        },
        tag: {
          type: 'string',
          description:
            'An attribute the club assigns, in Italian. Known values: ' +
            '"Adatto ai principianti" (beginner-friendly), "Hike&Fly", "Competizioni".',
        },
        near: {
          type: 'object',
          description: 'A coordinate to measure from.',
          properties: {
            lat: { type: 'number' },
            lon: { type: 'number' },
            radiusKm: { type: 'number', description: 'Defaults to 50.' },
          },
          required: ['lat', 'lon'],
        },
      },
    },
    async execute(input) {
      const all = await sites();
      const query = String(input.query ?? '')
        .trim()
        .toLowerCase();
      const tag = String(input.tag ?? '')
        .trim()
        .toLowerCase();
      const near = input.near as
        { lat: number; lon: number; radiusKm?: number } | undefined;

      const matches = all
        .filter(
          (site) =>
            !query || `${site.name} ${site.summary}`.toLowerCase().includes(query),
        )
        .filter((site) => !tag || site.tags.some((t) => t.toLowerCase().includes(tag)))
        .map((site) => {
          if (!near?.lat) return { site, km: undefined as number | undefined };
          const km = Math.min(
            ...site.takeoffs.map((takeoff) => distance(takeoff, near)),
          );
          return { site, km };
        })
        .filter(({ km }) => km === undefined || km <= (near?.radiusKm ?? 50))
        .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));

      return text({
        count: matches.length,
        sites: matches.map(({ site, km }) => ({
          name: site.name,
          description: site.summary,
          attributes: site.tags,
          url: site.url,
          takeoffs: site.takeoffs,
          ...(km === undefined ? {} : { distanceKm: Math.round(km * 10) / 10 }),
        })),
      });
    },
  },
  {
    name: 'get_flight_site',
    description:
      'Everything the club publishes about one flight site: its description, its ' +
      'attributes, every takeoff and landing with coordinates, and the link to its ' +
      'windgram. Use find_flight_sites first to get the identifier.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'The site\'s name or URL slug, e.g. "Montoso" or "montoso".',
        },
      },
      required: ['site'],
    },
    async execute(input) {
      const wanted = String(input.site ?? '')
        .trim()
        .toLowerCase();
      const all = await sites();
      const found = all.find(
        (site) => site.slug === wanted || site.name.toLowerCase() === wanted,
      );
      if (!found) {
        return text({
          error: 'No site by that name.',
          known: all.map((site) => site.name),
        });
      }
      return text(found);
    },
  },
  {
    name: 'get_navigation_data',
    description:
      "The club's waypoint and airspace files, in the formats flight instruments and " +
      'XC planning software read. These are the authoritative files for the area and ' +
      'are regenerated with the site.',
    inputSchema: { type: 'object', properties: {} },
    async execute() {
      return text({
        waypoints: {
          url: new URL('/api/navdata/ventorelativo-waypoints.cup', location.origin)
            .href,
          format: 'SeeYou CUP',
          contains: "Every takeoff, landing and meeting point at the club's sites.",
        },
        airspace: {
          url: new URL('/api/navdata/ventorelativo-airspace.txt', location.origin).href,
          format: 'OpenAir',
          contains: 'The landing zones and local hazards as airspace volumes.',
        },
        note: "Check them against the official AIP before flying. They describe the club's sites, not national airspace.",
      });
    },
  },
];

export function register(): void {
  const context = modelContext();
  if (!context) return;
  for (const tool of TOOLS) context.registerTool(tool);
}
