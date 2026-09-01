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
 * No `Place` node for flight sites yet. A site without coordinates is a name
 * and a sentence, which adds nothing; with them it becomes a real location
 * search engines can place on a map. The coordinates arrive in Phase 4 with the
 * map features, and that is when a `SportsActivityLocation` node is worth
 * adding.
 *
 * No `Event` for the news posts that describe events. Two of the three do, but
 * their dates and places live in prose, and guessing at them from a body would
 * produce structured data that quietly drifts from the article. It becomes
 * correct the day Keystatic gives news posts real event fields (Phase 3).
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

/** Wraps the nodes for one page into the single script tag that is emitted. */
export function graph(nodes: (Node | undefined)[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}
