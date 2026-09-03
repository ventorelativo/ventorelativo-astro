/**
 * schema.org structured data (S7).
 *
 * The Drupal `helper` module emitted one `SportsClub` object, identical on
 * every page, and nothing about the page being read. (It never actually
 * shipped — there is no `ld+json` in the archived build at all.) This is the
 * same club, described more precisely, plus per-page nodes that say what each
 * page *is*.
 *
 * ## How it is put together
 *
 * One `@graph` per page holding several nodes, each with an `@id`, so they can
 * reference one another instead of repeating themselves: the article points at
 * the club as its publisher rather than restating the club's name, logo and
 * URL. That is how search engines are meant to read a site — one entity,
 * described once, referred to from everywhere.
 *
 * ## What is deliberately absent
 *
 * No `address` or `geo` on the club: it is a volunteer association with no
 * premises, and inventing a street address to fill a field is how structured
 * data becomes a lie. `areaServed` carries a `GeoCircle` instead, which is a
 * true and more useful statement — it is the same centre and 20 km radius the
 * XContest searches use.
 *
 * The `Place` node for flight sites arrived with Phase 4, as this comment used
 * to promise it would: a site without coordinates was a name and a sentence,
 * and adding one would have said nothing. It has takeoffs now, so it is a real
 * location — see `placeNode`.
 *
 * `Event` used to be absent here, because the dates and places lived only in
 * prose and guessing at them from a body would have produced structured data
 * that quietly drifted from the article. News posts now carry real `event`
 * fields, so the node below is built from the same values the page and the
 * `.ics` use.
 */
import { SITE, CLUB_CENTRE } from '../consts';

type Node = Record<string, unknown>;

/** Stable identifiers, so nodes can reference each other across pages. */
export const ids = {
  club: (site: URL) => `${site.origin}/#club`,
  website: (site: URL) => `${site.origin}/#website`,
  page: (url: URL) => `${url.href}#webpage`,
};

/** The club itself. Emitted on every page; everything else refers to it. */
export function clubNode(site: URL): Node {
  return {
    '@type': 'SportsClub',
    '@id': ids.club(site),
    name: SITE.name,
    alternateName: `${SITE.name} Parapendio Club`,
    description:
      'Parapendio club tra Pinerolo, Val Chisone e Val Pellice: informazioni per i soci, eventi del club e siti di volo della zona.',
    sport: 'Paragliding',
    url: site.href,
    logo: new URL('/social-card.png', site).href,
    image: new URL('/social-card.png', site).href,
    email: SITE.email,
    knowsLanguage: SITE.lang,
    /*
      Named valleys for a human-readable answer, plus the circle the club
      actually flies in — the same point and radius the XContest searches use,
      so the two descriptions of "where this club is" cannot disagree.
    */
    areaServed: [
      { '@type': 'Place', name: 'Pinerolo' },
      { '@type': 'Place', name: 'Val Chisone' },
      { '@type': 'Place', name: 'Val Pellice' },
      {
        '@type': 'GeoCircle',
        geoMidpoint: {
          '@type': 'GeoCoordinates',
          latitude: CLUB_CENTRE.lat,
          longitude: CLUB_CENTRE.lon,
        },
        geoRadius: CLUB_CENTRE.radius,
      },
    ],
    sameAs: ['https://www.facebook.com/ventorelativo'],
  };
}

/** The site as a thing, so a search engine can attribute pages to it. */
export function websiteNode(site: URL): Node {
  return {
    '@type': 'WebSite',
    '@id': ids.website(site),
    url: site.href,
    name: SITE.name,
    inLanguage: SITE.lang,
    publisher: { '@id': ids.club(site) },
  };
}

/**
 * The trail as Google reads it — this is what produces the breadcrumb line in
 * a search result instead of a bare URL.
 */
export function breadcrumbNode(
  site: URL,
  crumbs: { href: string; label: string }[],
): Node | undefined {
  if (!crumbs.length) return undefined;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: site.href },
      ...crumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: crumb.label,
        // Trailing slash: `build.format: 'directory'` means that is the
        // canonical form, and structured data pointing at a URL that redirects
        // is a weaker signal than one pointing at the page itself.
        item: new URL(`${crumb.href}/`.replace(/\/+$/, '/'), site).href,
      })),
    ],
  };
}

export interface ArticleInput {
  url: URL;
  title: string;
  description: string;
  image: string;
  published: Date;
  section?: string;
}

/** A news post. `NewsArticle` rather than `Article`: it is dated club news. */
export function articleNode(site: URL, article: ArticleInput): Node {
  return {
    '@type': 'NewsArticle',
    '@id': ids.page(article.url),
    headline: article.title,
    description: article.description,
    image: article.image,
    datePublished: article.published.toISOString(),
    inLanguage: SITE.lang,
    articleSection: article.section,
    isPartOf: { '@id': ids.website(site) },
    mainEntityOfPage: article.url.href,
    // The club writes and publishes its own news; there are no bylines.
    author: { '@id': ids.club(site) },
    publisher: { '@id': ids.club(site) },
  };
}

export interface EventInput {
  /** The article announcing it — the event's identity and its page. */
  url: URL;
  name: string;
  description: string;
  image: string;
  start: Date;
  end?: Date;
  location: string;
}

/**
 * An event announced by a news post.
 *
 * `startDate` is a plain `YYYY-MM-DD`, which is how schema.org expects an
 * all-day event: inventing a time would say the flying starts at midnight.
 */
export function eventNode(site: URL, event: EventInput): Node {
  const day = (date: Date) => date.toISOString().slice(0, 10);
  return {
    '@type': 'Event',
    '@id': `${event.url.href}#event`,
    name: event.name,
    description: event.description,
    image: event.image,
    startDate: day(event.start),
    endDate: day(event.end ?? event.start),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: event.location },
    organizer: { '@id': ids.club(site) },
    url: event.url.href,
  };
}

export interface PlaceInput {
  url: URL;
  name: string;
  description: string;
  /** The site's takeoffs. The first one stands for the site's position. */
  takeoffs: { name: string; lat: number; lon: number }[];
  /** Site attributes — "Adatto ai principianti", "Hike&Fly". */
  tags?: string[];
  /** Absolute URL of one photograph, when the site has any. */
  image?: string;
}

/**
 * A flight site.
 *
 * `SportsActivityLocation` rather than plain `Place`: it says what the location
 * is *for*, which is the entire point of the page. A search engine or an
 * assistant asked "where can I fly near Pinerolo" can answer from this without
 * reading the prose.
 *
 * The site's own `geo` is its first takeoff, not a centroid of everything it
 * owns. A centroid of a takeoff and its landings is a point in mid-air over a
 * valley, which is not where anybody goes. Landings are deliberately not
 * modelled as places of their own — they are parts of a flight, not
 * destinations, and `/api/navdata/*` already publishes every one of them in
 * the format a pilot's instrument actually reads.
 *
 * No `elevation`: the club has never recorded altitudes as data. It is in the
 * prose of each page, and the `elev` column of the CUP file is empty for all
 * 29 waypoints. Copying a number out of a sentence is how structured data
 * starts lying.
 */
export function placeNode(site: URL, place: PlaceInput): Node | undefined {
  const [first] = place.takeoffs;
  if (!first) return undefined;

  return {
    '@type': 'SportsActivityLocation',
    '@id': `${place.url.href}#place`,
    name: place.name,
    description: place.description,
    url: place.url.href,
    image: place.image,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: first.lat,
      longitude: first.lon,
    },
    sport: 'Parapendio',
    keywords: place.tags?.length ? place.tags.join(', ') : undefined,
    /*
      Every takeoff, so a site with several is not reduced to its first. They
      are `Place`, not another SportsActivityLocation: a takeoff is a spot
      within the site, not a venue of its own.
    */
    containsPlace: place.takeoffs.map((takeoff) => ({
      '@type': 'Place',
      name: takeoff.name,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: takeoff.lat,
        longitude: takeoff.lon,
      },
    })),
    isPartOf: { '@id': ids.website(site) },
    mainEntityOfPage: place.url.href,
  };
}

/** Wraps the nodes for one page into the single script tag that is emitted. */
export function graph(nodes: (Node | undefined)[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}
