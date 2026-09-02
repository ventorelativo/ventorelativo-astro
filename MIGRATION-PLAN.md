# Ventorelativo — Drupal 11 → Astro + Keystatic migration plan

**Status:** approved. Phase 1 complete.
**Source site:** `/Users/marcus/Repos/ventorelativo-drupal` (Drupal 11.3.12, Tome static export → Netlify)
**Target:** Astro 7 (`output: 'static'`) + Keystatic (GitHub mode) + **Netlify** (D1 resolved)

**Decisions settled (12 of 13):** D1 Netlify · D2 single editor, GitHub accounts fine ·
D3 Netlify Forms · D4 split geometry fields · D5 per-site geo.json dropped · D6 quicklinks
only, no scraped tables · D7 site specs stay as prose · D8 stay on MapTiler, behind an
adapter · D9 no URLs need protecting · D11 refined minimal · D12 freeze content now ·
D13 tags reshaped (news category only, archives dropped).

**Still open:** D10 (payments) only — parked pending the committee.

**Phase 1 complete.** Next: Phase 2 (content).

---

## 0. Inventory summary

Everything below was read from `config/` (exported Drupal config), `content/` (Tome JSON
export), `web/modules/custom/`, `web/themes/custom/vr/` and the committed `html/` static
build. Counts are actual item counts in `content/`.

### Content entities

| Entity              | Bundle        | Label          | Count             | Fields                                                                                            |
| ------------------- | ------------- | -------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `node`              | `page`        | Pagina base    | 8                 | `body`, `layout_builder__layout`                                                                  |
| `node`              | `article`     | Articolo       | 3 (1 unpublished) | `body` (+summary), `field_image`, `field_tags`                                                    |
| `node`              | `sito`        | Sito di volo   | 14                | `body` (+summary), `field_images` (multi), `field_map_elements` → storage, `field_tags`, `sticky` |
| `storage`           | `map_feature` | Elemento mappa | 34                | `name` (base), `field_type` (list), `field_location` (geofield/WKT)                               |
| `taxonomy_term`     | `tags`        | Etichette      | 4                 | `name`                                                                                            |
| `block_content`     | `basic`       | Blocco base    | 7                 | `body`                                                                                            |
| `menu_link_content` | `main`        | —              | 5                 | —                                                                                                 |
| `path_alias`        | —             | —              | 29                | —                                                                                                 |
| `redirect`          | —             | —              | 1                 | `/contact/contatti` → `/contatti` (301)                                                           |
| `file`              | —             | —              | 18                | 3 unused/orphaned                                                                                 |

`map_feature` breakdown by `field_type`: **16 takeoff, 13 landing, 4 poi, 1 obstacle**.

Geometry shapes actually stored in `field_location` (WKT):

- takeoff / poi → `POINT`
- landing → `GEOMETRYCOLLECTION` (a `POINT` marker **plus** a `POLYGON` zone)
- obstacle → `LINESTRING` (one item: the Villar Chisone power line)

### Custom modules

| Module    | What it does                                                                                                                                                                   | Ported how                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `helper`  | Dark/light theme toggle block + sitewide `SportsClub` JSON-LD + homepage hero preload hint                                                                                     | Inline script + `<Schema>` component + `<link rel=preload>` |
| `mapper`  | MapTiler SDK map block for `/siti` (`/api/sites/all/geo.json`); geofield formatter; admin map widget; WKT `GEOMETRYCOLLECTION` splitter for Leaflet                            | MapTiler SDK island (see §4.2)                              |
| `navdata` | Generates `/api/navdata/ventorelativo-airspace.txt` (OpenAir) and `…-waypoints.cup` (SeeYou CUP) from `storage` geometries; plus an SDC download-links block                   | Two Astro static endpoints (see §4.3)                       |
| `scraper` | XContest flight scraper block on `/voli` — **the table rendering is commented out**; only 5 outbound XContest search buttons actually render. Login disabled since Cloudflare. | 5 static links (see §4.4)                                   |

### Views

| View                               | Displays                                                                                                                               | Purpose                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `sites_map`                        | `block_1`, `map_sites_node`, `geojson_sites_all` (`/api/sites/all/geo.json`), `geojson_sites_contextual` (`/api/sites/%node/geo.json`) | GeoJSON feeds + Leaflet map blocks                                   |
| `flight_sites`                     | `flight_sites_list` (block)                                                                                                            | Responsive grid of `sito` teasers on `/siti`                         |
| `site_features`                    | `map_sites_node` (block)                                                                                                               | Table of a site's map features + Google Maps / Meteo-Parapente links |
| `xcontest_flights`                 | `map_sites_node` (block)                                                                                                               | Per-takeoff XContest search links                                    |
| `flight_data`                      | `airspace`, `waypoints` (embeds)                                                                                                       | Filters feeding the navdata endpoints                                |
| `news`                             | `news_block`, `news_page`, `feed_1`                                                                                                    | Article listing (10/page) + RSS (not currently exported)             |
| `frontpage`, `archive`, `glossary` | —                                                                                                                                      | **Disabled**, no migration needed                                    |

### Theme (`vr`, Bootstrap 5.3 subtheme)

- Regions: `header`, `nav_branding`, `nav_main`, `nav_additional`, `breadcrumb`, `content`, `sidebar_first`, `sidebar_second`, `footer` — **the two sidebar regions are unused by every placed block**.
- SDC components: `listing` (article teaser card), `card-big` (site teaser card), `tags` (linked pills), `badges` (unlinked pills), plus `navdata:navdata-links`.
- Template overrides: `page.html.twig` (fixed header, offcanvas mobile nav, container, footer), `node.html.twig`, two teaser templates, branding block, breadcrumb, `field--field-tags`.
- Footer blocks: social media, footer menu (empty), GTranslate widget, theme toggle, image credits (front page only).
- Page title block hidden on front page; image-credits block shown _only_ on front page.

---

## 1. Feature checklist (old → new)

Grouped by area. **Everything currently on the site is listed**, including small things,
so this doubles as the acceptance checklist.

### 1.1 Global chrome & layout

| #   | Current feature                                                                 | New stack                                                                 |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| G1  | Fixed top header with logo/branding                                             | Astro `<Header>` in base layout                                           |
| G2  | Inline SVG logo (`logo.svg`), language-suffixed variants                        | Inline SVG component. Language variants unused (single locale) — **drop** |
| G3  | Site name + slogan ("Ventorelativo" / "Parapendio Club")                        | Site config in `src/consts.ts` + Keystatic `settings` singleton           |
| G4  | Main nav (5 links, weighted)                                                    | Keystatic `navigation` singleton → `array({label, href})`                 |
| G5  | Offcanvas mobile nav (Bootstrap `offcanvas-lg`)                                 | Custom CSS/`<dialog>` or Alpine-free vanilla JS drawer                    |
| G6  | Breadcrumbs (easy_breadcrumb: home icon + title segment, hidden when only home) | `<Breadcrumbs>` component derived from route + entry title                |
| G7  | Footer: social block, footer menu (empty), GTranslate, theme toggle, legal line | `<Footer>` + Keystatic `footer`/`social` singletons                       |
| G8  | Image-credits line — **front page only**                                        | Prop on the homepage layout                                               |
| G9  | Page title block — hidden on front page                                         | Per-page `showTitle` prop                                                 |
| G10 | Dark/light/auto theme toggle (`data-bs-theme`, localStorage)                    | Inline no-flash script + CSS custom properties + `data-theme`             |
| G11 | GTranslate widget (it → fr/en/de/es, flag icons, inline)                        | Same third-party widget, dropped into the footer. Portable as-is          |
| G12 | Skip link to `#main-content`                                                    | Astro layout                                                              |
| G13 | Unused `sidebar_first` / `sidebar_second` regions                               | **Drop** — nothing is placed in them                                      |

### 1.2 SEO, metadata & feeds

| #       | Current feature                                                                                                                                                                 | New stack                                                                                                                                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1      | Metatag: title pattern `[title] \| [site:name]`, description, canonical                                                                                                         | `<SEO>` component with per-page overrides                                                                                                                                                                                                                                                               |
| S2      | Open Graph + Twitter cards                                                                                                                                                      | Same component                                                                                                                                                                                                                                                                                          |
| S3      | **Auto-generated OG images**: title text (Metropolis Bold, uppercase, outlined) composited over `social-card.png`, 1280×640, entropy smart crop (`textimage` + `image_effects`) | `astro-og-canvas` (build-time) or `satori`+`sharp` in an endpoint. Easy to drop by accident — explicitly on the checklist                                                                                                                                                                               |
| S4      | Article OG image from `field_image` via `social_card_node` style (1280×640, center-bottom crop)                                                                                 | Astro `getImage()` with an equivalent crop                                                                                                                                                                                                                                                              |
| S5      | Front-page-specific title/description/OG overrides                                                                                                                              | Page-level frontmatter                                                                                                                                                                                                                                                                                  |
| S6      | Favicons set (16/32/apple-touch/mstile/safari-pinned-tab/webmanifest)                                                                                                           | Copy `favicons/` to `public/` verbatim                                                                                                                                                                                                                                                                  |
| S7      | `SportsClub` JSON-LD (name, sport, areaServed, sameAs)                                                                                                                          | `<JsonLd>` component in base layout                                                                                                                                                                                                                                                                     |
| S8      | `simple_sitemap` → `/sitemap.xml` (30 URLs, custom priorities for `/` and `/contatti`)                                                                                          | `@astrojs/sitemap` with a `serialize` for priorities                                                                                                                                                                                                                                                    |
| S9      | News RSS feed (`news` view `feed_1`, path `rss.xml`) — **defined but not in the static export**                                                                                 | ❌ **Dropped in Phase 2 at the club's request.** It never worked on the old site either, and nothing subscribes to it                                                                                                                                                                                   |
| S10     | Redirect `/contact/contatti` → `/contatti` (301)                                                                                                                                | `_redirects` / `netlify.toml`                                                                                                                                                                                                                                                                           |
| S11     | `/home` and `/` both resolve to the same node (duplicate content)                                                                                                               | **Fix**: `/home` → `/` 301                                                                                                                                                                                                                                                                              |
| S12     | Quicklink prefetch                                                                                                                                                              | Astro `prefetch: { defaultStrategy: 'viewport' }`                                                                                                                                                                                                                                                       |
| S13     | `minifyhtml`                                                                                                                                                                    | Astro's built-in HTML minification                                                                                                                                                                                                                                                                      |
| S14     | Long-cache headers for `/themes/*`, `/core/*`, `/sites/default/files/{css,js,styles}/*`                                                                                         | `_headers` for `/_astro/*` (content-hashed)                                                                                                                                                                                                                                                             |
| S15     | Hero LCP preload hint (`homepage.avif`)                                                                                                                                         | **Not needed.** The hint existed because the hero was a CSS `image-set()` background on `main::before`, invisible to the preload scanner. It is a real `<Picture>` now, first in the markup with `fetchpriority="high"`, so the scanner finds it in the initial HTML                                    |
| **S17** | _(nothing — the concept did not exist)_                                                                                                                                         | ✅ **Done in Phase 2.** `/llms.txt` (index) and `/llms-full.txt` (every page's text), generated from the collections. Cheap and build-time only; be clear-eyed that it is widely published and rarely fetched — the schema.org graph and semantic HTML are what actually make the site machine-readable |
| **S16** | _(none today — no analytics module installed)_                                                                                                                                  | **New:** Cloudflare Web Analytics beacon before `</body>`. Works on Netlify-hosted sites with no DNS/proxy change; cookie-free, so no cookie banner. See §6.1                                                                                                                                           |

### 1.3 Pages & content

| #   | Current feature                                                                                           | New stack                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 8 basic pages (Layout Builder, one-column, body + blocks)                                                 | Purpose-built `.astro` pages, each backed by a Keystatic **singleton** for its editable text                                    |
| C2  | Homepage: full-bleed hero (`image-set` avif/webp/jpg, 0.8 opacity), centred logo + slogan, 3 CTA buttons  | `index.astro` + `<Hero>`; CTAs become structured data (see §2)                                                                  |
| C3  | 3 news articles, sticky+date sort, 10/page pager                                                          | `news` collection + `/news` list                                                                                                |
| C4  | Article: hero image (`wide` style, q40), body, tags, langcode display                                     | `/news/[slug].astro`                                                                                                            |
| C5  | Article teaser card (image right on ≥md, badges, date, "Leggi tutto")                                     | `<ArticleCard>`                                                                                                                 |
| C6  | Article summary (`text_summary_or_trimmed`, 100 chars for sites)                                          | Explicit `summary` field                                                                                                        |
| C7  | Unpublished article (`Volo dei Briganti`)                                                                 | `draft: true`, excluded from build                                                                                              |
| C8  | 14 flight sites, sticky-first then title sort                                                             | `sites` collection + `/siti`                                                                                                    |
| C9  | Site teaser card (`card-big`: title, body summary, stretched link)                                        | `<SiteCard>`                                                                                                                    |
| C10 | Site image gallery (Slick carousel, `wide` style, 16:9, dots)                                             | CSS scroll-snap gallery + dots (no Slick dependency)                                                                            |
| C11 | Taxonomy tag pages `/tags/<slug>` (4 real + 1 stale `asdasd`)                                             | **Dropped** per D13 (§2.5) — thin archives, no inbound links (D9). News keeps a category badge                                  |
| C12 | Tag pills — linked (`tags` SDC) vs unlinked badges (`badges` SDC)                                         | One `<Badge>` component. Per D13 the linked variant goes away with the archive pages; news categories render as unlinked badges |
| C13 | Contact page + Netlify form (name/email/subject/message, honeypot, no captcha)                            | Netlify Forms — see D3 in §6                                                                                                    |
| C14 | Contact thank-you page `/contatti/messaggio-inviato`                                                      | Static page                                                                                                                     |
| C15 | 404 page (`/404`)                                                                                         | `src/pages/404.astro`                                                                                                           |
| C16 | Membership page (`/iscrizioni`) with pricing cards + IBAN                                                 | Structured tiers — see §5                                                                                                       |
| C17 | Contact info blocks (phone / WhatsApp buttons, inline SVG icons) — 3 near-duplicate block_content entries | One `contacts` singleton, one `<ContactButtons>` component. **Consolidates 3 duplicates into 1**                                |
| C18 | Social media block (Facebook only)                                                                        | `social` singleton                                                                                                              |
| C19 | Footer legal line (P.IVA / C.F.)                                                                          | `footer` singleton                                                                                                              |
| C20 | Body HTML uses raw Bootstrap markup + inline SVG (pricing cards, CTA rows, contact buttons)               | **Not portable as-is.** Must be re-authored as structured fields + components — see §2.4                                        |

### 1.4 Maps & geo

| #   | Current feature                                                                                                                                                                    | New stack                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| M1  | `/siti` overview map: MapTiler SDK, custom style `3d203d09-…`, 3D terrain (exaggeration 1.2, pitch 25°, maxPitch 70), fullscreen + terrain controls, cooperative gestures on touch | MapTiler SDK client island — see §4.2                                                                                  |
| M2  | Auto fit-bounds over all features with padding                                                                                                                                     | Same                                                                                                                   |
| M3  | Layer stack: polygon fills → lines → point shadow → other points → landing icons → takeoff icons → labels                                                                          | Ported 1:1 (it's already declarative style JSON)                                                                       |
| M4  | Custom marker PNGs (`takeoff.png`, `landing.png`)                                                                                                                                  | `public/map/*.png`                                                                                                     |
| M5  | Click popups with per-type emoji, site link, coordinates, Google Maps + Meteo-Parapente links                                                                                      | Built client-side from feature properties                                                                              |
| M6  | Basemap style switcher (`#mapstyles` select)                                                                                                                                       | Same control                                                                                                           |
| M7  | Per-site map (Leaflet via Drupal `leaflet` module, `~Paragliding` basemap from `leaflet_more_maps`, 600px, zoom 14, gesture handling, fullscreen, scale control)                   | **Consolidate onto MapTiler SDK** — one map library instead of two                                                     |
| M8  | `/api/sites/all/geo.json` — all features as GeoJSON with `name`, `description` (HTML popup), `field_type`, `stroke`, `fill`                                                        | Astro static endpoint from the `mapFeatures` collection                                                                |
| M9  | `/api/sites/<nid>/geo.json` — per-site GeoJSON (contextual by node)                                                                                                                | ❌ **Dropped** (D5 — confirmed dead, never wired up). Per-site maps inline their GeoJSON instead of fetching it (§4.2) |
| M10 | Type → colour mapping (takeoff `#1F52A6`, landing `limegreen`, obstacle `magenta`, poi `gold`; obstacle fill transparent)                                                          | **Single shared `featureTypes` module** — currently duplicated across 2 view fields, 1 JS file and 1 PHP class         |
| M11 | Site features table per site (emoji + name + DMS coords + Google Maps link + Meteo-Parapente link for takeoffs)                                                                    | `<FeatureTable>` component                                                                                             |
| M12 | DMS coordinate formatting                                                                                                                                                          | Shared `formatDms()` util (also used by the OpenAir export)                                                            |
| M13 | MapTiler API key `43jtWKU1n6PJru2J0ElA` hardcoded in JS                                                                                                                            | Keep client-side (normal for MapTiler) but **restrict it by domain** and move to `PUBLIC_MAPTILER_KEY`                 |

### 1.5 Airspace / flight-computer data

| #   | Current feature                                                                                                                                                                     | New stack                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A1  | `/api/navdata/ventorelativo-airspace.txt` — OpenAir from **Polygon** geometries; landings class `W`, others `Q`; `AL SFC` / `AH 100ft AGL`; DMS coords; header with generation date | Astro static endpoint — see §4.3                                    |
| A2  | `/api/navdata/ventorelativo-waypoints.cup` — SeeYou CUP from **Point** geometries; styles: landing 21, takeoff 20, obstacle 8, poi 19; `DDMM.mmm` coords; country `IT`              | Astro static endpoint                                               |
| A3  | Airspace excludes `obstacle`; waypoints exclude `poi` (configured in the `flight_data` view, not in code)                                                                           | Filter constants in the shared `featureTypes` module                |
| A4  | Download-links block (2 buttons with download icon + editable intro text)                                                                                                           | `<NavdataLinks>` component + Keystatic singleton for the intro copy |
| A5  | WKT `GEOMETRYCOLLECTION` parsing via geoPHP                                                                                                                                         | **Eliminated** — store GeoJSON natively (see §2.2)                  |

### 1.6 Flights (XContest)

| #   | Current feature                                                                                                                         | New stack                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | `/voli` intro text + link to the club XContest search                                                                                   | Static page + Keystatic singleton                                                                                                                    |
| X2  | 5 XContest search buttons: Recenti / Migliori giornata / mese / anno / sempre, all filtered to `point=7.116547 44.903584, radius=20000` | ✅ **Keeping — first-class feature.** `<XContestLinks>`; URLs built from a shared club-centre constant, date-scoped ones computed at build. See §4.4 |
| X3  | Scraped flight tables (rank, date, pilot, launch, route icon, distance, points, glider + EN-rating bars, detail link)                   | ❌ **Dropped** (D6). Already dead code — commented out, login blocked by XContest's Cloudflare bot check                                             |
| X4  | Per-takeoff "Ricerca voli da &lt;name&gt;" XContest links on site pages                                                                 | `<XContestSiteLinks>` — same URL builder, per takeoff coordinate                                                                                     |
| X5  | Tab-deeplinking via URL hash (`js/global.js`)                                                                                           | Only used by the dead tables. **Drop**                                                                                                               |

### 1.7 Editorial / admin

| #   | Current feature                                                                | New stack                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | Drupal admin (Gin) content editing                                             | Keystatic Admin UI at `/keystatic`                                                                                                                                                               |
| E2  | Editor role (`content_editor`)                                                 | GitHub repo write access (Keystatic GitHub mode requirement)                                                                                                                                     |
| E3  | GitHub OAuth-free login (Drupal accounts)                                      | GitHub OAuth via a Keystatic GitHub App — **editors now need GitHub accounts** (see D2)                                                                                                          |
| E4  | CKEditor 5 rich text (`basic_html` / `full_html`), Linkit, media library       | Keystatic `mdx` field + content components                                                                                                                                                       |
| E5  | Image upload to `public://YYYY-MM/`                                            | Keystatic `image` field → `src/assets/…` (Astro-optimised)                                                                                                                                       |
| E6  | Alt text required on site images                                               | Keystatic `object({src, alt})` with validation                                                                                                                                                   |
| E7  | Pathauto slug patterns (`/siti/[title]`, `/news/[title]`, `/tags/[term:name]`) | Keystatic `slug` field with the **existing slugs preserved verbatim** — several are hand-set, not derived from the title (e.g. `volo-dei-briganti-bourcet-2025`), so do not regenerate them (D9) |
| E8  | Revisions + revision log                                                       | Git history (Keystatic commits per save)                                                                                                                                                         |
| E9  | Preview mode                                                                   | Netlify/Cloudflare deploy previews on Keystatic's branch commits                                                                                                                                 |
| E10 | Drupal local dev (`drush rs`, SQLite, `composer install`)                      | `npm run dev`; Keystatic `local` storage for local editing                                                                                                                                       |

---

## 2. Content model mapping

Astro 5 Content Layer. Collections in `src/content.config.ts`, editor schema in
`keystatic.config.ts`. The two schemas must be kept in sync by hand — Keystatic writes the
files, Zod validates them at build.

### 2.1 Collections

```
src/content/
  news/<slug>.mdx           # 3 entries  (was node:article)
  sites/<slug>.mdx          # 14 entries (was node:sito)
  map-features/<slug>.yaml  # 34 entries (was storage:map_feature)
  # tags/  — proposed for removal, see §2.5 / D13
src/content/pages/          # singletons, one YAML/MDX per fixed page
```

**`news`** (Drupal `node:article`)

| Astro/Keystatic field | Type                                        | From                                                                  |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `title`               | text                                        | `title`                                                               |
| `slug`                | slug                                        | `path.alias` — **preserve existing**                                  |
| `date`                | date                                        | `created`                                                             |
| `summary`             | text (multiline)                            | `body.summary` (currently empty on all 3 → author it)                 |
| `image`               | object `{src: image, alt: text}`            | `field_image` (`alt` is required today)                               |
| `category`            | select `Eventi \| Competizioni \| Hike&Fly` | `field_tags` — **pending D13** (§2.5); was `array(relationship→tags)` |
| `draft`               | checkbox                                    | `!status`                                                             |
| `content`             | mdx (contentField)                          | `body.value`                                                          |

**`sites`** (Drupal `node:sito`)

| Field         | Type                                    | From                                                                                                                                                                                                      |
| ------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | text                                    | `title`                                                                                                                                                                                                   |
| `slug`        | slug                                    | `path.alias` — **preserve existing**                                                                                                                                                                      |
| `summary`     | text, **required**                      | `body.summary` (e.g. `"1969m, S-SE, Roure (TO)"`). Per D7 this is the _only_ structured short description — it drives the card, the map popup and the meta description, so it must be populated on all 14 |
| `featured`    | checkbox                                | `sticky` (only Montoso) — drives sort order                                                                                                                                                               |
| `images`      | array(object `{src: image, alt: text}`) | `field_images`                                                                                                                                                                                            |
| ~~`tags`~~    | —                                       | `field_tags` — **dropped pending D13** (§2.5); only Montoso is tagged, and with a news category                                                                                                           |
| `mapFeatures` | array(relationship→`map-features`)      | `field_map_elements` — **order preserved**                                                                                                                                                                |
| `content`     | mdx (contentField)                      | `body.value`                                                                                                                                                                                              |

**`mapFeatures`** (Drupal `storage:map_feature`) — the important one, see §2.2.

| Field   | Type                                                           | From                                             |
| ------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `name`  | text                                                           | `name`                                           |
| `slug`  | slug                                                           | generated from name                              |
| `type`  | select `takeoff \| landing \| obstacle \| poi`                 | `field_type`                                     |
| `point` | object `{lat: number, lon: number}`                            | Point component of `field_location`              |
| `shape` | conditional/text (GeoJSON `Polygon` or `LineString`), optional | Polygon/LineString component of `field_location` |

**`tags`** (Drupal `taxonomy_term:tags`) — **proposed for removal, see §2.5 / D13.**
If D13 is declined and the archive pages stay, this is the shape:

| Field  | Type | From                          |
| ------ | ---- | ----------------------------- |
| `name` | text | `name`                        |
| `slug` | slug | `path.alias` (`/tags/<slug>`) |

### 2.2 The one thing that does _not_ map cleanly: `field_location`

Today a single Drupal **geofield** holds a WKT string that may be a `POINT`, a
`LINESTRING`, or a `GEOMETRYCOLLECTION` containing _both_ a point marker and a polygon
zone. Three separate pieces of code exist purely to unpack that:
`mapper_leaflet_map_view_geofield_value_alter()`, `NavdataController::filterByType()`, and
the Leaflet formatter's centroid fallback.

Keystatic has **no geo field type**, and there is no documented public custom-field API
(only document component blocks and content components). So the geometry has to be
modelled with the primitive fields Keystatic does have. Proposal — split the collection
geometry into two explicit fields:

```ts
point: fields.object({
  // always present; drives markers + CUP waypoints
  lat: fields.number({ validation: { min: -90, max: 90 } }),
  lon: fields.number({ validation: { min: -180, max: 180 } }),
});
shape: fields.conditional(
  // optional; drives fills + OpenAir airspace
  fields.select({ options: ['none', 'polygon', 'line'], defaultValue: 'none' }),
  {
    none: fields.empty(),
    polygon: fields.text({ multiline: true }), // GeoJSON coordinate ring
    line: fields.text({ multiline: true }),
  },
);
```

**Why this is better than porting the WKT blob:** the two geometries currently share one
opaque field but are consumed by completely different code paths (marker/waypoint vs.
fill/airspace). Splitting them removes the parser, removes the geoPHP dependency, and
makes "what is this polygon for" legible in the editor.

**Editor ergonomics — the accepted trade-off (D4 resolved in favour of this):**

- The common editorial action (add a takeoff or a POI) is _two number fields_. Easy, and
  arguably better than today's map-picker-in-a-textarea.
- Adding or reshaping a **landing polygon** (13 today) or the **power line** (1) means
  pasting coordinates from geojson.io or QGIS. That is worse than today's Leaflet drawing
  widget, and it is a genuine regression — accepted because these change rarely and the
  metadata stays in Keystatic.

Two things that soften the polygon trade-off, worth building in Phase 4:

- **A round-trip escape hatch.** A `npm run geo:export` script that dumps all 34 features
  to a single `map-features.geojson`, plus a `geo:import` that reads an edited file back
  into the per-feature YAML. Drawing session in geojson.io → import → commit. ~60 lines,
  and it makes the occasional polygon edit painless without giving up Keystatic.
- **Validation at build time.** Zod can check ring closure (first point == last point),
  coordinate bounds, and that landings actually have a polygon. A malformed paste then
  fails the build rather than silently producing a broken airspace file — which matters,
  because this data ends up in flight computers.

### 2.3 Other things that need explicit handling

| Drupal thing                                                                                                                            | Problem                                                                        | Handling                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Views "Global: custom text" fields with Twig (popup HTML, colour-by-type, Google Maps/Meteo links)                                      | Presentation logic living in config, duplicated 4×                             | One `src/lib/featureTypes.ts`: per type → label, emoji, marker icon, stroke, fill, CUP style, OpenAir class, include-in-airspace, include-in-waypoints |
| `field_map_elements` reverse relationship (`entity_reverse` + `nid` argument) drives the per-site map, feature table and XContest links | No reverse refs in Keystatic                                                   | Forward `array(relationship)` on the site; build a reverse index once at build time in `src/lib/sites.ts`                                              |
| Keystatic `relationship` stores a **slug string** and does not update when the target is renamed                                        | Silent broken refs                                                             | Zod `reference()` in the Astro schema fails the build on a dangling ref — treat that as the safety net. Avoid renaming map-feature slugs               |
| `body.summary` feeds both the teaser and the meta description                                                                           | Implicit, and per D7 it's now the only structured short description on `sites` | Explicit `summary` field, **required** on `sites` and `news`. All 3 articles currently have an empty summary — author them before migrating            |
| `sticky` on Montoso                                                                                                                     | Non-obvious                                                                    | `featured: boolean`, documented in the field description                                                                                               |
| `promote`                                                                                                                               | Unused (false everywhere)                                                      | Drop                                                                                                                                                   |
| `langcode: it` on everything, single configured language                                                                                | No i18n routing in use                                                         | Single locale; set `<html lang="it">`. GTranslate stays client-side                                                                                    |
| Layout Builder per-node sections                                                                                                        | 8 pages × ad-hoc block stacks                                                  | Replaced by fixed page components (§3) — do **not** rebuild Layout Builder                                                                             |
| 3 orphaned files (`unep_login_bg.jpg`, `Screenshot 2023-11-23…png`, plus duplicates)                                                    | Dead weight                                                                    | Don't migrate                                                                                                                                          |
| Stale tag `asdasd` (in the sitemap and build, not in `content/`)                                                                        | Junk URL indexed                                                               | Don't migrate; add a 410/redirect if it has inbound links                                                                                              |

### 2.4 Body HTML will not survive verbatim

Current `full_html` bodies contain hand-written Bootstrap 5 markup and inline SVG:
Iscrizioni's pricing cards, the homepage's three CTA buttons, and the phone/WhatsApp
button rows. Pasting these into MDX would hard-code Bootstrap classes into a site that no
longer ships Bootstrap.

These must be lifted out of prose into structured fields:

| Current raw HTML                                                                | Becomes                                                                                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage 3 CTA buttons                                                          | `ctas: array(object({label, href, style: select(primary\|outline)}))`                                                                                 |
| Iscrizioni pricing cards (€10 Sostenitore, €30 Socio, benefit lists, pay links) | `tiers: array(object({name, price, benefits: array(text), payUrl, highlight: checkbox}))` — this is also exactly the shape the Stripe work needs (§5) |
| Phone / WhatsApp button rows (×3 near-identical blocks)                         | `contacts: array(object({kind: select(phone\|whatsapp\|email), label, href}))`                                                                        |
| Social media block                                                              | `social: array(object({network, url}))`                                                                                                               |
| Bank transfer details (IBAN, association name)                                  | `bankTransfer: object({holder, iban})`                                                                                                                |

Everything else (news bodies, site descriptions) is ordinary prose and converts to MDX
cleanly.

### 2.5 Tags (D13) — the vocabulary is doing two jobs

Actual usage, from `content/`:

| Term                   | Slug                     | Used on                         |
| ---------------------- | ------------------------ | ------------------------------- |
| Eventi                 | `eventi`                 | 2 articles                      |
| Competizioni           | `competizioni`           | 2 articles **+ Montoso (site)** |
| Hike&Fly               | `hikefly`                | 1 article                       |
| Adatto ai principianti | `adatto-ai-principianti` | **Montoso (site) only**         |
| ~~asdasd~~             | `asdasd`                 | nothing — stale, in the sitemap |

That's why it feels wrong: three of the terms are **news categories** and one is a
**flying-site attribute**, sharing one vocabulary because Drupal's standard profile ships a
single `tags` field and it got attached to both content types. Montoso ends up tagged
"Competizioni" _and_ "Adatto ai principianti" — two unrelated kinds of statement.

Only 1 of 14 sites is tagged at all, and 4 terms across 5 pieces of content does not
justify five archive pages.

**Correction (Phase 2, 2026-09-01).** The table above is wrong about the sites. Reading
`field_tags` across all 14 `sito` nodes, **five** are tagged, not one:

| Site                                       | Tags                                 |
| ------------------------------------------ | ------------------------------------ |
| Le Grange                                  | Adatto ai principianti               |
| Monte Cucetto, Monte Freidur, Punta Ceresa | Hike&Fly                             |
| Montoso                                    | Adatto ai principianti, Competizioni |

"Adatto ai principianti" and "Hike&Fly" describe the site, which is exactly the site
attribute point 3 below imagined adding "later". So site tags ship in Phase 2 as a plain
`tags: string[]` on the entry, rendered as non-linking pills on the card and the page.
What stays dropped is the shared vocabulary, the relationship and the archive routes.

**Recommendation:**

1. **Drop the shared `tags` collection and the `/tags/*` archive routes entirely.** Five
   thin URLs, no inbound links (D9), nothing lost.
2. **Keep categories on news only**, as a plain `select` on the `news` collection —
   `Eventi | Competizioni | Hike&Fly`. No relationship, no separate collection, no archive
   page. Rendered as a badge on the card and the article header, which is what they're
   actually for: scanning a news list.
3. **Drop "Adatto ai principianti" for now.** It's genuinely useful information — but it's
   a _site attribute_, and D7 kept site specs as prose, so it belongs in the site body
   until there's a reason to structure it. Noted in §4.1 as the natural first field if you
   ever do add site attributes (beginner-friendly, hike&fly access, school, winch…).

Net effect: one collection, one relationship, one route and two components removed from the
model, with nothing meaningful lost. If categorisation matters later, it comes back
deliberately and in the right shape.

**If you'd rather keep the tag archive pages**, they're cheap to restore — say so and the
`tags` collection stays as originally specced in §2.1.

---

## 3. Page / route structure

Left column is the current live URL (from `html/sitemap.xml` + the Tome export). **All
public URLs are preserved.**

| Current URL                                | New file                                               | Data source                                                                        |
| ------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `/`                                        | `src/pages/index.astro`                                | `pages/home` singleton                                                             |
| `/home`                                    | —                                                      | **301 → `/`** (currently duplicate content)                                        |
| `/siti`                                    | `src/pages/siti/index.astro`                           | `pages/sites-index` singleton + `sites` + `mapFeatures`                            |
| `/siti/<slug>` ×14                         | `src/pages/siti/[slug].astro`                          | `sites`                                                                            |
| `/news`                                    | `src/pages/news/index.astro`                           | `pages/news-index` singleton + `news`                                              |
| `/news/<slug>` ×2 published                | `src/pages/news/[slug].astro`                          | `news`                                                                             |
| `/tags/<slug>` ×4                          | —                                                      | **Dropped** (D13, §2.5). News categories become a `select` badge; no archive pages |
| `/voli`                                    | `src/pages/voli.astro`                                 | `pages/flights` singleton                                                          |
| `/iscrizioni`                              | `src/pages/iscrizioni.astro`                           | `pages/membership` singleton                                                       |
| `/contatti`                                | `src/pages/contatti.astro`                             | `pages/contact` singleton                                                          |
| `/contatti/messaggio-inviato`              | `src/pages/contatti/messaggio-inviato.astro`           | static                                                                             |
| `/404`                                     | `src/pages/404.astro`                                  | static                                                                             |
| `/api/sites/all/geo.json`                  | `src/pages/api/sites/all/geo.json.ts`                  | `mapFeatures`. Kept as a public file; the maps themselves inline the data (§4.2)   |
| `/api/sites/<nid>/geo.json`                | —                                                      | **Dropped** (D5: confirmed dead, never wired up)                                   |
| `/api/navdata/ventorelativo-airspace.txt`  | `src/pages/api/navdata/ventorelativo-airspace.txt.ts`  | `mapFeatures`                                                                      |
| `/api/navdata/ventorelativo-waypoints.cup` | `src/pages/api/navdata/ventorelativo-waypoints.cup.ts` | `mapFeatures`                                                                      |
| `/sitemap.xml`                             | `@astrojs/sitemap`                                     | —                                                                                  |
| _(new)_ `/rss.xml`                         | `src/pages/rss.xml.ts`                                 | `news`                                                                             |
| `/contact/contatti`                        | —                                                      | **301 → `/contatti`** (existing redirect, preserve)                                |
| `/styleguide`                              | —                                                      | Drupal `twbstools` dev page. **Drop**                                              |
| **New:** `/keystatic`, `/api/keystatic/*`  | Keystatic integration                                  | `prerender = false`                                                                |

### Page composition (mirrors today's Layout Builder stacks)

**`/` (homepage)** — hero background (`image-set` avif/webp/jpg, preloaded), centred logo +
site name + slogan, CTA row. No page title, no breadcrumbs. Footer shows the image credit.

**`/siti`** — intro prose → **overview map** (all 34 features) → responsive grid of 14 site
cards (featured first, then title) → navdata download links.

**`/siti/[slug]`** — title → tags → **site map** (this site's features only) → body → image
gallery → feature table (Google Maps / Meteo-Parapente links) → XContest per-takeoff links.

**`/news`** — intro prose → article cards (date desc, 10/page).

**`/news/[slug]`** — title → hero image → body → tags.

**`/voli`** — intro prose → 5 XContest search buttons.

**`/iscrizioni`** — intro → pricing tier cards with pay buttons → bank-transfer fallback.

**`/contatti`** — intro → contact buttons → Netlify contact form.

### Layout structure

```
BaseLayout      html/head (SEO, JSON-LD, favicons, theme no-flash script), Header, main, Footer
  ├─ HomeLayout    full-bleed hero, no title, no breadcrumbs, credits in footer
  ├─ PageLayout    breadcrumbs + h1 + slot          (siti, news, voli, iscrizioni, contatti, 404)
  └─ EntryLayout   breadcrumbs + h1 + article slot  (siti/[slug], news/[slug])
```

Component set (replacing the SDC components 1:1 plus the views): `Header`, `Nav`,
`MobileNav`, `Footer`, `Breadcrumbs`, `ThemeToggle`, `Tags`, `Badges`, `ArticleCard`
(`listing`), `SiteCard` (`card-big`), `Hero`, `Gallery`, `MapTilerMap`, `FeatureTable`,
`NavdataLinks`, `XContestLinks`, `ContactButtons`, `PricingTiers`, `ContactForm`, `SEO`,
`JsonLd`.

---

## 4. Subsystem notes

### 4.1 Flight sites (takeoff / site management)

**Today.** `node:sito` (14) with a body of semi-structured prose (`Località / Altitudine /
Esposizione / Descrizione` as bold labels + `<br>`), an image gallery, tags, and an ordered
reference list to `map_feature` entities. Rendered by a Layout Builder stack that pulls in
three separate views.

**New.** `sites` collection + `/siti` and `/siti/[slug]`. Straightforward.

**Per D7, the `Località / Altitudine / Esposizione` triplet stays as prose** in the MDX
body rather than becoming fields. Straight port, zero conversion cost. Two consequences to
handle deliberately:

1. **`summary` carries more weight.** It's now the only structured short description, and
   it feeds the site card, the map popup and the meta description
   (`Sito di volo: [node:summary]`). It should be **required** in the schema. Existing
   summaries are already in the right shape — Bourcet's is `"1969m, S-SE, Roure (TO)"` —
   so this is mostly a matter of confirming all 14 are populated.
2. **The prose formatting should be consistent.** The bodies currently use
   `<strong>Label:</strong><br>value` — an MDX convention worth settling on during the
   conversion (bold label + line break, or a definition list) so the 14 pages don't drift.
   A small `<Spec>` MDX component would give the same visual result while keeping the
   markup uniform, without turning it into schema.

If you later want to filter or sort sites by altitude or aspect, this is the decision to
revisit — it's an additive change, not a rewrite.

### 4.2 Maps

**Today, two libraries:**

1. **MapTiler SDK** (`mapper` module) on `/siti` — custom style, 3D terrain, fit-bounds,
   6 layers, click popups, style switcher. Fetches `/api/sites/all/geo.json`.
2. **Leaflet** (contrib `leaflet` + `leaflet_more_maps`, `~Paragliding` basemap) on each
   `/siti/<slug>` — 600px, zoom 14, gesture handling, fullscreen, scale.

**New:** consolidate on **MapTiler SDK** for both. Reasons: the overview map's terrain and
custom style are the more distinctive of the two and would be the expensive thing to
rebuild; the per-site Leaflet map is generic and easy to re-express in MapTiler; and one
library means one bundle and one set of styling conventions.

Implementation: a single `<Map>` Astro component with a client-side island, parameterised
by `features`, `zoom`, `terrain`, `height`. Keeps the existing layer stack and paint
expressions verbatim.

The layer filters currently reference `field_type`; the property name should become `type`
in the new GeoJSON, driven by the shared `featureTypes` module.

**Data delivery changes (D5).** Today the overview map does `fetch('/api/sites/all/geo.json')`,
_then_ computes bounds, _then_ constructs the map — a serial round-trip before anything
paints. Since Astro builds the GeoJSON anyway, **inline it into the page** as a
`<script type="application/json">` payload and skip the fetch entirely. Bounds can even be
precomputed at build time.

- `/api/sites/all/geo.json` — **keep emitting it** as a static file. It costs nothing and
  it's an existing public URL.
- `/api/sites/<nid>/geo.json` — **drop** (D5: confirmed dead). Per-site maps get their
  features inlined the same way, which is what that endpoint was originally meant to enable.

#### 4.2.1 MapTiler vs MapLibre (D8) — stay, but stay portable

Worth knowing: **the MapTiler SDK is built on MapLibre GL JS** — MapTiler's own docs say
"the core of MapTiler SDK JS is MapLibre GL JS". So the ~250 lines in `maptiler-map.js`
(sources, layers, paint expressions, filters, popups, event handlers) are _already_
MapLibre API and would port to plain MapLibre unchanged.

Which means the switching cost isn't code — it's **data**: the custom style
`3d203d09-e79b-4c16-a28d-b9564619b3a7` and the terrain DEM.

**Recommendation: stay on MapTiler.** The terrain isn't decoration on a paragliding site —
3D relief is how you actually read a flying site — and it plus the custom style are exactly
the expensive things to replace. Meanwhile the thing MapLibre buys you (no key, no quota)
solves a problem you don't have.

**But keep the exit cheap.** Write the map component against the MapLibre API surface and
isolate the MapTiler-only parts — `maptilersdk.config.apiKey`, `MapStyle.*` presets for the
style switcher, `terrain: true` / `terrainControl` / `terrainExaggeration`, the
`loadWithTerrain` event, the geocoding control — behind a thin adapter module. Then a future
switch is "swap the adapter, source a style and a DEM", not "rewrite the map".

Two things that could force the question later, worth being aware of rather than acting on:

- MapTiler's free tier is documented as **non-commercial use only**, and requires on-screen
  MapTiler attribution. The club is an ASD with a P.IVA — probably fine, but worth reading
  the actual [MapTiler Cloud terms](https://www.maptiler.com/terms/cloud/) once rather than
  assuming. Third-party summaries put the free tier around 100k tile requests / 5k sessions
  per month; verify against MapTiler's own [pricing page](https://www.maptiler.com/cloud/pricing/).
- The SDK is a meaningfully larger bundle than bare MapLibre, since it carries the extras.

Neither is urgent. Restrict the API key by domain and move it to `PUBLIC_MAPTILER_KEY`
regardless — it's currently hardcoded and unrestricted in `maptiler-base.js`.

### 4.3 Airspace generation

**Today.** `NavdataController` fetches `map_feature` entities through two `flight_data`
view displays and writes two plain-text files:

- **OpenAir** (`.txt`) from Polygon geometries. Class `W` for landings, `Q` otherwise;
  `AL SFC` / `AH 100ft AGL`; coordinates as `DD:MM:SS.SS N` / `DDD:MM:SS.SS E`; obstacles
  excluded by the view filter.
- **SeeYou CUP** (`.cup`) from Point geometries. Styles landing 21 / takeoff 20 /
  obstacle 8 / poi 19; coordinates as `DDMM.mmmN` / `DDDMM.mmmE`; country `IT`; POIs
  excluded by the view filter.

**New.** Two Astro static endpoints. This is the cleanest subsystem to port — it is pure
data→text with no runtime dependency, and the WKT parsing disappears entirely once
geometry is stored as GeoJSON (§2.2).

```
src/pages/api/navdata/ventorelativo-airspace.txt.ts   → GET, returns text/plain
src/pages/api/navdata/ventorelativo-waypoints.cup.ts  → GET, returns text/plain
src/lib/navdata/openair.ts    formatOpenAir(features)
src/lib/navdata/cup.ts        formatCup(features)
src/lib/coords.ts             toDms(), toCupCoordinate()
```

Filters and the type→class/style mappings move from view config + PHP constants into
`featureTypes.ts`, so the "which types go in which file" decision stays in one legible
place rather than split between a Views UI and a PHP file.

**Verification:** the current export is committed at
`html/api/navdata/ventorelativo-airspace.txt` and `…-waypoints.cup`. Diff the new output
against it byte-for-byte (modulo the generation-date header line) before cutover. This is
safety-critical data — it goes into people's flight computers.

### 4.4 XContest flights

**Today, in practice:** the `/voli` page renders an intro paragraph and **five outbound
link buttons** to XContest searches (Recenti / Migliori giornata / mese / anno / sempre),
all scoped to `point=7.116547 44.903584&radius=20000`. The scraper that used to render
sortable flight tables is entirely commented out in `xct-tables.html.twig`, and the
XContest login step in `ScraperBlock::scrape()` is disabled with the note _"Disabled since
Cloudflare changes"_.

**New (confirmed):** an `<XContestLinks>` component with the same five links — recent,
best of the day, best of the month, best of the year, best overall. These are a
first-class feature of `/voli` and are being kept as-is.

One real improvement to make while porting. The date-scoped URLs are built with PHP's
`date()` **at build time**, so `filter[date]=…` freezes to whenever the site was last
deployed. That used to be fine: a scheduled Netlify rebuild ran daily (originally more
often, to feed the scraper), so "Migliori giornata" really did mean today. That function is
now commented out in `netlify/functions/scheduled-deploy.js`, so the current live build has
a stale date baked in and the daily link has been quietly wrong since.

**Fix: build the date-scoped URLs client-side** from `new Date()` in a small inline script,
so they're correct at the moment of the visit rather than the moment of the build. ~10
lines, no dependencies.

This is strictly better than reinstating the cron: it's always correct rather than up to
24h stale, and — now that the scraper is gone (D6) — it removes the _only_ remaining reason
to rebuild the site on a schedule. The new site rebuilds when content changes, and that's
it.

Site pages additionally get the per-takeoff "Ricerca voli da &lt;name&gt;" links
(`xcontest_flights` view), built from each takeoff's coordinates. These have no date
component, so they're plain static links.

**The scraped tables are dropped** (D6). If XContest ever exposes an API or a club data
agreement, that's a new feature to scope then — not a migration task.

**On the credentials in `ScraperBlock.php`:** the login was only ever used by the scraper,
which is gone, so nothing in the new site needs it — no action taken. Noted here only
because the plaintext password for a real XContest account remains in this repo's git
history independently of whether the site uses it; if that repo is public, or if the
password is reused anywhere, that's the reason to change it, not the migration.

### 4.5 Link collections

Four distinct "collections of links" exist, and they are all trivially portable:

| Collection                                   | Where                                                                    | New                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| Navdata downloads (2 links + editable intro) | `/siti`, `navdata_links` block                                           | `<NavdataLinks>` + singleton                             |
| XContest searches (5 links)                  | `/voli`, `scraper` block                                                 | `<XContestLinks>`                                        |
| Per-takeoff XContest searches                | `/siti/<slug>`, `xcontest_flights` view                                  | `<XContestSiteLinks>`                                    |
| Per-feature Google Maps + Meteo-Parapente    | `/siti/<slug>` table and map popups, `site_features` + `sites_map` views | `<FeatureTable>` + popup builder, from `featureTypes.ts` |

Plus the navigational ones: main menu (5 links, → `navigation` singleton), footer menu
(empty), social (1 link, → `social` singleton), contact buttons (phone + WhatsApp, →
`contacts` singleton).

### 4.6 Theme toggle

`helper` module + a `block_content` holding the Bootstrap docs' colour-mode dropdown markup
and `theme-toggle.js` (localStorage `theme`, `data-bs-theme` on `<html>`, auto/light/dark).

Ports to a small inline head script (no-flash) + a `<ThemeToggle>` component + CSS custom
properties with `[data-theme]` and `prefers-color-scheme`. The markup currently living in a
`block_content` body should become a real component — it has no business being editable
content.

---

## 5. Membership / payments

> **⚠️ Provisional — pending Ventorelativo committee approval.** The Stripe fee question
> below is not settled. Nothing in this section should be built until the committee has
> ruled on it. The Astro site can ship fully without it (§7, Phase 5).

### Current state

`/iscrizioni` is a static page with two Bootstrap pricing cards linking to **Satispay
consumer pay links** on shop `1746ccbc-eae4-4ad8-90d8-96712d59e356`:

- Sostenitore — €10 — `?amount=1000&currency=EUR&external_code=Sostenitore`
- Socio — €30 — `?amount=3000&currency=EUR&external_code=Socio`

plus a bank-transfer fallback (Associazione Sportiva Vento Relativo, IBAN
`IT67W0326830750052117945240`). There is **no automation today** — every payment is
reconciled by hand.

### Planned flow

```
Member → Stripe Payment Link (card + Satispay) → Stripe webhook
       → Make.com scenario → Google Sheet row updated
Wire transfer → (manual) → Google Sheet
```

**Why a Google Sheet and not Airtable** _(revised — the plan previously said Airtable):_

- **No seat limit.** Airtable's free tier caps at 5 editors; a committee changes and
  outgrows that. A Sheet can be shared with as many members as the club has.
- **Nothing to host or learn.** Every committee member already knows a spreadsheet, and
  hand-reconciling a wire transfer is editing a cell.

What the club gives up is worth naming: a Sheet has no field types, no validation and no
per-record permissions, so nothing stops someone typing a date into the amount column.
Mitigations that cost nothing: keep the header row fixed, let Make.com write rather than
humans wherever possible, and use the Sheet's built-in version history when something looks
wrong.

**Privacy.** The Sheet holds member names and emails. Share it with named committee
accounts only — never "anyone with the link" — and keep it out of this repository, which is
public. See the note at the end of §5.

### The pending decision

| Option                                           | Cost to the club                                | Automation                                                                |
| ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------- |
| **Stripe Payment Link** (card + native Satispay) | 1.5% + €0.25 per transaction, both rails, Italy | Full: one webhook → Make.com → Google Sheet                               |
| **Satispay Business direct**                     | 0% under €10, flat €0.20 above €10              | Separate integration + reconciliation, outside the Stripe→Make→Sheet flow |

Concretely, at the current tiers: a €10 Sostenitore costs €0.40 via Stripe vs €0.00 via
Satispay Business; a €30 Socio costs €0.70 vs €0.20. **The committee decides whether that
surcharge is acceptable.** Until then, treat Stripe as unconfirmed.

### Design implication for the site (do this either way)

The site's only job is to render pay buttons. Model the tiers as structured data now
(§2.4) so the payment rail is a URL swap, not a content rewrite:

```yaml
# src/content/pages/membership.yaml
tiers:
  - name: Sostenitore
    price: 10
    benefits: ['Supporto al club e alle sue iniziative']
    payUrl: https://… # Satispay today, Stripe Payment Link later
  - name: Socio
    price: 30
    highlight: true
    benefits:
      [
        'Partecipazione alle decisioni',
        'Diritto di voto alle assemblee',
        'Priorità per i posti agli eventi',
      ]
    payUrl: https://…
bankTransfer:
  holder: Associazione Sportiva Vento Relativo
  iban: IT67W0326830750052117945240
```

This means Phase 5 becomes "edit two URLs in Keystatic", whichever way the committee votes.

### Notes if Stripe is approved

- Stripe Payment Links need no code on the Astro site — they are just URLs.
- The Make.com scenario should key on Stripe's `client_reference_id` or metadata to match
  the payer to a row; the current `external_code=Sostenitore|Socio` carries the tier but
  not the member. Decide how a member identifies themselves at checkout (Stripe Payment
  Links support custom fields). In Make.com the shape is _Search Rows_ on that key, then
  _Update a Row_ if found or _Add a Row_ if not — a Sheet has no upsert, so the scenario
  has to branch, and without it a renewing member silently gets a duplicate row.
- Keep the bank-transfer block visible — it stays the zero-fee route for larger amounts.
- The Sheet, Make and Stripe all live entirely outside this repo. **No member PII should
  ever land in the Astro repo**, which is public and committed to by Keystatic.

---

## 6. Open questions / decisions needed before implementation

| #           | Decision                                                                | Why it matters              | My recommendation                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**D1**~~  | ~~Netlify or Cloudflare Pages?~~                                        | —                           | ✅ **RESOLVED: Netlify.** See §6.1 for the reasoning and the Cloudflare Web Analytics note.                                                                                                                                                                                                                                                                                                                    |
| ~~**D2**~~  | ~~Do all editors have GitHub accounts?~~                                | —                           | ✅ **RESOLVED.** One real editor today; future editors will be asked to create GitHub accounts. Keystatic GitHub mode is a clean fit — this is no longer a risk.                                                                                                                                                                                                                                               |
| ~~**D3**~~  | ~~Contact form backend~~                                                | —                           | ✅ **RESOLVED: Netlify Forms** (follows D1). `data-netlify="true"` + honeypot, no captcha — matching today's `tome_netlify_contact` config. Recipient stays `segreteria@ventorelativo.it`. Free tier is 100 submissions/month.                                                                                                                                                                                 |
| ~~**D4**~~  | ~~How should landing polygons and the obstacle line be edited?~~        | —                           | ✅ **RESOLVED: split fields in Keystatic** (§2.2). Point as lat/lon numbers, polygon/line as pasted GeoJSON. All 34 features stay in Keystatic with their metadata. Accepted trade-off: reshaping the 13 landing polygons means a trip to geojson.io.                                                                                                                                                          |
| ~~**D5**~~  | ~~`/api/sites/<nid>/geo.json` — preserve or change?~~                   | —                           | ✅ **RESOLVED: drop it.** Confirmed dead — it was built to reuse the overview MapTiler setup on site pages, but the site pages ended up on Leaflet and the endpoint never got wired up. Nothing consumes it. See §4.2 for what replaces it. The two `/api/navdata/*` files keep their exact URLs.                                                                                                              |
| ~~**D6**~~  | ~~XContest flight tables — restore or drop?~~                           | —                           | ✅ **RESOLVED: quicklinks only.** The five search links (recent / daily / best month / best year / best overall) are a first-class feature and stay. The scraped tables are dropped — XContest put a Cloudflare bot check in front of the data, and defeating it at build time is not something worth building. See §4.4.                                                                                      |
| ~~**D7**~~  | ~~Promote `Località / Altitudine / Esposizione` from prose to fields?~~ | —                           | ✅ **RESOLVED: no — keep as prose.** Straight port; the triplet stays as bold labels in the MDX body. Consequence: `summary` becomes the only structured short description, so it carries the cards _and_ the meta description — see §2.3.                                                                                                                                                                     |
| ~~**D8**~~  | ~~Keep MapTiler or move to MapLibre + free tiles?~~                     | —                           | ✅ **RESOLVED: stay on MapTiler**, free tier, comfortable quota. But build the map component against the **MapLibre API surface** with MapTiler-specific bits isolated in a thin adapter, so switching later stays cheap. See §4.2.1. Restrict the key by domain, move it to `PUBLIC_MAPTILER_KEY`.                                                                                                            |
| ~~**D9**~~  | ~~Which URLs must be preserved exactly?~~                               | —                           | ✅ **RESOLVED.** No inbound links worth protecting. `/home` → 301 to `/`; `/styleguide`, `/tags/asdasd` and the nid-based geo.json all simply dropped, no redirects needed. All content URLs (`/siti/*`, `/news/*`, `/contatti*`, `/voli`, `/iscrizioni`, `/404`, `/api/navdata/*`) still preserved exactly. Raised **D13** on the tag URLs.                                                                   |
| **D10**     | **Stripe vs Satispay Business**                                         | §5. Fee vs full automation. | **Committee decision, parked.** Not being worked on. The site ships complete without it — `/iscrizioni` keeps the existing Satispay links until the committee rules.                                                                                                                                                                                                                                           |
| ~~**D11**~~ | ~~Design direction~~                                                    | —                           | ✅ **RESOLVED: refined minimal**, _amended in Phase 2 — see the note under §6.2._ Original: **refined minimal.** Information architecture and page composition unchanged. Bootstrap replaced by a small hand-rolled CSS layer (custom properties, `light-dark()`, container queries). Brand blue `#1F52A6` and the Metropolis display face retained. Generous whitespace, restrained type scale, subtle cards. |
| ~~**D12**~~ | ~~Content freeze / dual-run~~                                           | —                           | ✅ **RESOLVED: freeze early.** Little editing is happening, so the content export can be treated as final from Phase 2 onward, with occasional double-entry as the fallback if something does need publishing mid-migration. This removes the need for a re-sync step before cutover.                                                                                                                          |
| ~~**D13**~~ | ~~Tags: keep, reshape, or drop?~~                                       | —                           | ✅ **RESOLVED: reshape**, _amended in Phase 2._ `tags` collection and `/tags/*` archives dropped; news gets a `category` select rendered as a badge. **Site tagging is kept after all** — §2.5 said only Montoso was tagged, but the export has five sites tagged (see the correction under §2.5). They are a `tags: string[]` on the entry, shown as plain pills, not links.                                  |

### 6.1 Hosting: why Netlify, and where Cloudflare still fits

**Decision: stay on Netlify.** There is no feature this site needs that Cloudflare provides
and Netlify doesn't, and there are two concrete reasons not to move:

1. **Keystatic wants a Node runtime.** Its docs say the admin "needs to run serverside code
   and use Node.js APIs". Netlify Functions _is_ Node. Cloudflare Workers is `workerd`, not
   Node — `nodejs_compat` covers most built-ins but is a compatibility shim, and if
   Keystatic hits a gap you get a 500 with no useful error. That's a debugging session you
   don't need on the one part of the stack a non-developer has to log into.
2. **Netlify Forms would have to be replaced.** The contact form currently works precisely
   because Netlify's build-time form detection exists. On Cloudflare it becomes a Pages
   Function plus a third-party email sender.

Against that, Cloudflare's genuine advantages — unlimited bandwidth, Workers/KV/R2/D1,
Durable Objects — are all things this site will never touch. A 14-site, 3-article club
site sits far inside Netlify's free tier (100 GB bandwidth, 300 build minutes/month; an
Astro build here will be well under a minute).

So: familiarity is a real reason, and there's no counterweight. Stay.

**The Cloudflare thing you actually want is available anyway.** [Cloudflare Web
Analytics](https://developers.cloudflare.com/web-analytics/) explicitly supports sites
"not proxied through Cloudflare" — you add the hostname in the Cloudflare dashboard, copy
the JS beacon snippet, and drop it before `</body>`. No DNS change, no proxy, no migration.
Cloudflare markets it as privacy-first and cookie-free, so it should also mean **no cookie
banner**, which is worth having.

Note that the site has **no analytics at all today** — there's no `google_analytics` or
`matomo` module in `core.extension.yml`. So this is a genuinely new capability, not a
migration item. Added to the checklist as **S16**.

### 6.2 Design direction spec (D11 — refined minimal)

Enough to start Phase 1 from; not a finished design.

**Carried over from today:** brand blue `#1F52A6` (already the takeoff marker colour, so
map and UI stay coherent), accent yellow `#FABD14`, the **Outfit** variable typeface
(Google Fonts, currently loaded in `_common.scss` at weight 300 / 1.1rem), the contour-line
SVG pattern behind the footer, the inline SVG logo, the full-bleed homepage hero, and the
light/dark/auto toggle.

_Correction to an earlier draft of this plan:_ Metropolis Bold is **not** the web typeface.
It is only used server-side by `image_effects` to render text onto the OG social cards
(`image.style.social_card.yml`). The site face is Outfit. Metropolis stays in the repo for
OG card generation (S3) and nothing else.

**Dropped:** Bootstrap 5.3 and its utility classes, Slick carousel, the `bg-*`/`text-bg-*`
scheme settings from `vr.settings.yml`, and the two unused sidebar regions.

**Approach:** one small hand-rolled CSS layer — no framework. Design tokens as custom
properties on `:root`, dark mode via `light-dark()` with a `[data-theme]` override so the
toggle still wins in both directions. A fluid type scale with `clamp()`. Cards get spacing
and a hairline border rather than the current `shadow-sm` + `shadow-hover`. Layout via
CSS grid and container queries — which is what actually replaces the `col-12 col-lg-3`
grid, and handles the site cards and feature table better than breakpoints did.

**Restraint rules**, since "not flashy" is the brief: no scroll-triggered animation, no
parallax, transitions only on interactive state (hover, focus, theme switch), and one
accent colour. The photography and the maps are the visual interest; the chrome shouldn't
compete with them.

**Accessibility to fix while rebuilding** — the current theme has some avoidable problems:
the mobile nav toggle relies on Bootstrap's offcanvas JS with no `<dialog>` fallback; the
`.stretched-link` card pattern makes the whole card one big link, which is awkward with a
screen reader when the card also contains tag links; and several inline SVGs have no
accessible name. Worth doing properly rather than porting as-is.

**Amendment (Phase 2, 2026-09-01).** "Refined minimal" was taken too far in the
chrome: pill buttons, a 6/10/16 radius scale, 500-weight nav links on the body
text ramp. On review the club asked for the old rendering back, so the menu
(desktop and drawer), the buttons, the badges and the radius scale are now ported
from the **computed styles of the archived `html/` build** rather than
reinterpreted — Bootstrap's 4/6/8 radii, `.btn` at 1rem/400 with 6px×12px padding
and a 6px radius, nav links at 1.1rem/600 uppercase on their own near-black ramp
with a 3px rule, `--header-height` back to 5.25rem. `npm run shot --computed`
reads those values out of either site, so this is checkable rather than eyeballed.

What "refined minimal" still governs: the token system itself, the `light-dark()`
colour strategy, container queries, generous whitespace, and the absence of
Bootstrap. Two deliberate divergences remain, both contrast-driven: body text is
darker than the old `rgb(105,117,134)`, and the badge and outline-button blues
follow `--color-accent` so they lighten in dark mode instead of staying pinned to
`#1f52a6` at roughly 2:1 against a near-black background.

### Not decisions, but do them anyway

- **Delete the stale `asdasd` taxonomy term** before exporting content.
- **Author the missing summaries** — all 3 articles have an empty `body.summary`, which is what feeds the meta description (`News: [node:summary]`) and the teaser.
- **Fix the unpublished article** (`Volo dei Briganti`) — decide whether it ships as a draft or gets published/deleted.

---

## 7. Suggested phased migration order

Each phase ends in something deployable and reviewable. Nothing is thrown away between
phases.

### Phase 0 — Freeze & setup _(no code)_

Only **D13** (tags) is still open, and it only affects Phase 2. Housekeeping:

- **Freeze Drupal editing now** (D12). Little is in flight, and double-entry is the
  fallback if something must go out mid-migration. Doing this first means the content
  export is taken once and never re-synced — it removes a whole class of drift.
- Author the missing `summary` on all 3 articles; confirm it on all 14 sites (load-bearing
  per D7).
- Delete the stale `asdasd` tag.
- Register the hostname in Cloudflare Web Analytics; keep the beacon snippet (S16).
- Archive the current `html/` build as the byte-level reference for Phase 4 diffing.

No XContest credential rotation — the login was scraper-only (§4.4).
**Exit:** content frozen and exported; reference build archived.

### Phase 1 — Skeleton & design system ✅ DONE

Astro 7.2.10 (not 5 — the plan was written before checking; the config API used here is
unchanged), `output: 'static'`. Base layout, header, nav, footer, breadcrumbs, theme
toggle. Design tokens, fluid type scale, dark mode, container queries (§6.2). Homepage
hero built with real content; `/styleguide` added as a temporary design reference.

**Two deviations from this plan, both discovered by building it:**

1. **The Netlify adapter is deferred to Phase 3.** Adding it flips the build to
   `mode:"server"` and emits a ~3.6 MB SSR function even when every route is prerendered
   — dead weight on every deploy. Nothing needs on-demand rendering until Keystatic, so
   it goes in there, with the two admin routes that carry `prerender = false`.
2. **Redirects moved from `astro.config.mjs` to `netlify.toml`.** Astro's `redirects`
   option only produces real 301s when an adapter is present to translate them.
   Adapter-less it emits _meta-refresh HTML pages_ — a client-side hop that passes no
   ranking signal, which defeats the entire point of the `/home` → `/` redirect (S11).
   `netlify.toml` gives a true edge 301 with no adapter and no function.

**Also corrected:** the web typeface is **Outfit** (self-hosted via
`@fontsource-variable/outfit` rather than fetched from fonts.googleapis.com, removing a
third-party origin and a render-blocking stylesheet). Metropolis Bold is OG-cards-only.

**Visual review done** (headless Chrome, 1440x900 and 390x844, both colour schemes).

The hero is treated **differently per scheme, by decision**:

- **Light** keeps the Drupal look — a pale, hazy wash with dark text. The photo is a dusk
  shot, so the white scrim that makes dark text legible also bleaches the mountains; that
  softness is wanted, and it reads as more legible.
- **Dark** uses a much lighter scrim so the photograph stays intact behind light text.

Implemented as two `light-dark()` pairs (`--hero-scrim-top` / `--hero-scrim-bottom`) with
**no** `color-scheme` override, so each mode keeps its own text colours naturally and there
is still one place to tune each stop. The light values fold in what the old theme did with
`opacity: .8` on the image plus a 55%→80% white gradient, so the image itself stays at full
opacity in both modes and only the scrim differs.

_(An earlier attempt forced `color-scheme: dark` on the hero to make it a dark photographic
panel in both modes. Rejected on review — light mode was less readable that way.)_

**Exit met:** `astro check` clean (0 errors/warnings/hints), build clean, 532 KB output,
homepage and interior page verified in light and dark at desktop and mobile widths.
The Astro dev toolbar is disabled (`devToolbar: false`) — it floated over the hero CTAs,
which made phone review awkward.
**Covers:** G1–G13, S6, S10, S11, S12, C2 (partial).

### Phase 2 — Static pages & editorial content ✅ DONE

`news`, `sites` and `pages` collections; 3 articles and 14 sites migrated, bodies converted
from `full_html`; the raw-HTML blocks lifted into structured fields (§2.4); `/voli`,
`/iscrizioni`, `/contatti` + form + thank-you, `/404`; SEO, generated social cards,
schema.org, sitemap, redirects, analytics; Keystatic in local storage.

**Exit met, and exceeded:** every URL the old site had is built — `/siti` included — and
diffed against the `path_alias` entities. The only absences are deliberate: `/home` (301),
`/tags/*` (D13) and the one unpublished article, which the old build did not contain either.

**Deviations, each with its own commit:**

1. **`/siti` shipped here, not in Phase 4.** Its overview map is the risky part and stays
   deferred; the card grid needs none of it, and "Siti" is the most prominent link in the
   nav. The map drops in above the grid later — the page carries a `TODO(Phase 4)`.
2. **A URL in this plan was wrong.** `/siti/il-podio` came from the node's own `path` field,
   which is stale. `path_alias`, `sitemap.xml` and the archived build all say `/siti/podio`.
   On a migration about preserving URLs, `path_alias` is the authority.
3. **Site tags are kept** — see the correction under §2.5. Five sites are tagged, not one.
4. **Five sites are `sticky`**, not "only Montoso": also Monte Cucetto, Roletto, Sarsenà and
   Sea di Torre.
5. **RSS (S9) dropped** at the club's request. Nothing subscribes to it and it never worked
   on the old site. Revisit if an automation (Make.com → Facebook) ever wants a feed.
6. **The stale-date bug §4.4 predicted was real.** The archived build's "Migliori giornata"
   points at `filter[date]=2026-07-10`, seven weeks stale. Now corrected client-side.
7. **Content bodies carry no `import` statements**, and body components are handed to
   `<Content components={…}>`. Keystatic refuses to open an entry containing an import.
8. **`b, strong` needs an explicit weight.** With a 300 body, the UA's relative `bolder`
   resolves to 400 — the old theme set 600 for exactly this reason.

**Covers:** C1–C20, S1–S8, S10–S16, E4–E8, X1–X2, D13. (S9 dropped; S3 done with satori;
X4 needs takeoff coordinates and moves to Phase 4.)

### Phase 3 — Keystatic GitHub mode ✅ DONE

GitHub App, OAuth env vars, `/keystatic` + `/api/keystatic/*` with `prerender = false`,
auto-deploy on push. Low risk now that D2 is settled — you're the only editor, and adding
someone later is "create a GitHub account, get repo write access".
**Exit:** a news post created and published end-to-end through `/keystatic` on the deployed
site, without touching a terminal. **Passed 2026-09-02** — `/news/a-test-news/`,
written from the deployed CMS, image upload and event fields included.
**Covers:** E1–E3, E9–E10.

**Built (2026-09-02):** the `@astrojs/netlify` adapter with `output: 'static'` kept, so the
two admin routes are the only things in the serverless function and all 25 pages stay on
the CDN; Keystatic in GitHub mode against `ventorelativo/ventorelativo-astro`; the
`modifiche-` branch workflow with a `previewUrl` on every collection and singleton.
Runbook: [`docs/deploying.md`](docs/deploying.md).

**Two things found while doing it:**

1. **The Astro build gets its own Netlify project.** `ventorelativo` already exists and
   serves the live `ventorelativo.it`; this build deploys to `ventorelativo-astro` and the
   domain moves at cutover (Phase 5). Meanwhile `robots.txt` disallows crawling on any host
   that is not the apex, so the staging copy cannot compete with the site it replaces — and
   it re-opens by itself when the domain arrives.
2. **D9's open question is settled:** the canonical origin is the apex, `ventorelativo.it`.
   The live Netlify project's primary URL says so; nothing in the Drupal repo did.

**Editing workflow to set up with it:**

- **Netlify builds `main` only.** Keystatic can work on a branch, so an editor makes a
  batch of changes and merges once — one production build per session rather than one per
  save, and half-finished edits never reach the public site.
- **Branch deploys on**, so the author can see their work: Netlify gives each branch a URL,
  and Keystatic's `previewUrl` puts a Preview button on every entry, e.g.
  `https://{branch}--<site>.netlify.app/news/{slug}/` — it substitutes `{branch}` and
  `{slug}` from wherever the editor currently is. Note that Netlify sanitises branch names
  in subdomains, so keep branch names free of slashes or the templated URL will not match.
- **`/admin` → `/keystatic`** (already in `netlify.toml`) starts working here.

**Netlify form detection** was off on the new project and is now enabled (2026-09-02);
without it `/contatti` would have accepted submissions and stored nothing (D3). Still to
verify by actually submitting the deployed form.

### Phase 4 — Map & flight-data subsystems _(the risky part, deliberately last)_

**Flight data is done and gated (2026-09-02).** `/api/navdata/*.cup` and `*.txt` are
prerendered again and `npm run verify` fails unless they match the archive: the CUP is
byte-for-byte identical (same md5 as the Drupal build), the OpenAir identical but for its
`* Generated:` date. Both corrections below proved necessary — the counts are 29 and 13.

Three details worth keeping, all read off `NavdataController.php` rather than inferred:

- **PHP rounds in `sprintf` and truncates in `(int)`.** Reproduced with `toFixed` and
  `Math.trunc`. It is visible in the data: Bagnolo's longitude looks like exactly 18.1395
  minutes, but the double is 18.139499999999984, so it renders `18.139`.
- **The OpenAir file's last block ends with a blank element**, which supplies the final
  newline through the join. Nothing is appended after it.
- **Sort is `name ASC`** from the view's default display. Codepoint order, `localeCompare`
  and `localeCompare('it')` all agree on the current 29 names, so the choice is not
  load-bearing today — `it` was taken as the one that stays right if a name changes.

**Remaining:** the maps (M-series), `geo:export`/`geo:import`, `/api/sites/all/geo.json`,
per-site maps and feature tables, XContest links.

#### Phase 4b — the map, and how it stays off the critical path

_Proposed 2026-09-02. Needs sign-off on the dependency (rule 6)._

**MapTiler and MapLibre are not alternatives — the map needs both.** MapTiler is the
service: tiles, the club's style, the elevation data. MapLibre is the renderer that draws
them in the browser. The old site used `maptiler-sdk`, which is MapLibre with MapTiler's
conveniences wrapped around it, loaded from `cdn.maptiler.com` on every page carrying a
map.

**What the old site already had, recovered 2026-09-02 and verified live:**

| Thing   | Value                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| API key | hardcoded in `mapper/js/maptiler-base.js`; now `PUBLIC_MAPTILER_KEY` in `.env`                                    |
| Style   | `3d203d09-e79b-4c16-a28d-b9564619b3a7` — the club's own "TopoPG", 132 layers, contours + hillshade + openmaptiles |
| Camera  | `center [7.18, 44.88]`, `zoom 10.5`, fitted to bounds, `easeTo({ pitch: 25 })`                                    |
| Terrain | on, `terrainExaggeration: 1.2`, with the terrain control                                                          |

The key, the custom style and `terrain-rgb-v2` all still answer 200. So the look is not a
design question — it exists, and the job is to reproduce it.

**Use MapLibre directly rather than the SDK.** Measured brotli: `maptiler-sdk` 264 kB
against `maplibre-gl` 225 kB. The SDK's `terrain: true` is a few lines of `setTerrain`
plus a terrain-RGB source in raw MapLibre; the same style URL and key produce the same
map. That is **40 kB saved for a handful of lines**, and one less layer between us and the
renderer.

**Nothing lighter than MapLibre does this.** Measured, brotli, not quoted from a blog:

| Library        | Transfer          | Vector tiles | 3D terrain |
| -------------- | ----------------- | ------------ | ---------- |
| MapLibre GL v5 | 225 kB + 8 kB CSS | yes          | **yes**    |
| OpenLayers 10  | 213 kB            | yes          | no         |
| Leaflet 1.9    | 37 kB             | raster only  | no         |
| Protomaps.js   | ~15 kB            | yes (canvas) | no         |

OpenLayers costs the same and cannot do it; Leaflet and Protomaps are six to fifteen times
lighter and cannot either. CesiumJS is the only other 3D option and is far bigger. So the
cost is the requirement, not the library — which makes the question "when is it paid",
not "which library".

**Nobody pays it on load.** The facade pattern, which is Google's own recommendation for
heavy embeds: the page ships a static poster, and the real map replaces it on interaction.
Lighthouse measures page load, so a module fetched on click never enters the audit — the
100/100 target survives intact, and a visitor who never opens the map never downloads a
byte of it.

1. **Poster: an inline SVG, zero JS, zero third-party.** Drawn at build from the geometry
   already in `map-features` — the takeoff point and the landing polygon, in theme tokens.
   About 1 kB, correct offline, and it cannot 404. MapTiler's Static Maps API was the
   obvious alternative and is **paid-plan only** (checked); a real basemap poster is still
   possible later by rendering one in headless Chrome at build with the existing
   `scripts/shot.mjs` harness and caching it by content hash the way `src/lib/og.ts`
   already caches social cards.
2. **Load on intent.** `pointerenter`/`focus` on the poster injects `preconnect` to the
   tile host and `modulepreload` for the MapLibre chunk, so the fetch is underway before
   the click lands.
3. **Protect INP, which is the only vital genuinely at risk.** LCP and TBT are already
   settled by the time anyone clicks; INP is not. The click handler must paint a loading
   state and nothing else, then `await import()` — no synchronous work before the frame.
4. **The CSS needs the third route.** Importing it dynamically hits the documented trap
   (Astro inlines the small stylesheet, Vite preloads the file it never wrote, the
   rejected import takes the feature down). Importing it in frontmatter puts 8 kB on all
   fourteen site pages for a map most visitors never open. So: copy `maplibre-gl.css` into
   `public/` — verbatim, unprocessed, no Vite involvement — and inject a `<link>` at click
   time.
5. **Tiles outweigh the library.** A pitched terrain view pulls vector tiles _and_
   terrain-RGB DEM tiles: several MB on mountain data, and the thing that will actually
   hurt. Bound it — `maxBounds` to the club's valleys, a sane `maxZoom`, modest terrain
   exaggeration, `cooperativeGestures` so a scroll does not hijack the page.
6. **The MapTiler key is public by necessity.** Restrict it by domain in MapTiler's
   settings, and remember `PUBLIC_MAPTILER_KEY` must join `SECRETS_SCAN_OMIT_KEYS` in
   netlify.toml or the build fails the way it already did once.
7. **No map on `/siti`.** Fourteen cards is the heaviest grid on the site; a fifteenth
   facade earns nothing. The overview map, if wanted, is its own page.
8. **No WebGL2 → keep the poster** and show the feature table. The data is readable
   without a renderer, which is the point of having it in a collection.

**Order:** (a) feature tables + poster SVG — useful on their own, zero JS; (b) the facade
and MapLibre on click; (c) 3D terrain and the overview map; (d) `geo:export`/`geo:import`
and the XContest links.

**(a) is done (2026-09-02).** Every site page carries a schematic of its geometry and a
table of its points; `/siti` links the two navdata downloads. Measured: a site page ships
**1.5 kB of JavaScript**, the theme toggle and nothing else, and `/siti` is 62.0 kB against
its 61 kB budget. Three things worth keeping:

- **A migration bug surfaced.** Montoso's seven `field_map_elements` had been dropped — it
  would have rendered an empty diagram. Every site was then cross-checked against the
  Drupal nodes: 14/14 match, 43/43 links, which the archived `geo.json` independently
  confirms at 43 entries.
- **Labels are most of the work.** Names collide (Montoso has a landing and a meeting point
  400 m apart) and clip at the frame edge. Both needed solving before the drawing was worth
  looking at. They are hidden below 40rem, where the viewBox scales them to about eight
  pixels; the table carries the names there.
- **The obstacle anchors its label to the middle of its line.** It has no point, and the
  one genuine hazard on the drawing being the only unnamed thing was worse than the
  special case.

**Exit:** a site page gains **no** JavaScript on load, measured with `npm run weight`;
the map's cost is measured separately, as the price of opening it.

**Two corrections found while migrating the geometry (2026-09-02):**

1. **§2.2's "point is always present" is wrong.** The obstacle is a bare `LINESTRING`, so
   it has no point — which is precisely why it does not appear in the archived waypoint
   file. `point` is optional; the rules that matter are per type.
2. **What goes into each navdata file is decided by the `flight_data` view, not by the
   controller's constants.** Reading the constants alone would produce 34 waypoints and 14
   airspace blocks, and fail the byte-diff gate. The archived output and
   `views.view.flight_data.yml` together give the real rule:

   | File                          | View filter       | Also requires | Result                                                         |
   | ----------------------------- | ----------------- | ------------- | -------------------------------------------------------------- |
   | `ventorelativo-waypoints.cup` | type ≠ `poi`      | a point       | **29** — 16 takeoffs + 13 landings (the obstacle has no point) |
   | `ventorelativo-airspace.txt`  | type ≠ `obstacle` | a polygon     | **13** — the landings only                                     |

   Formats to reproduce exactly: CUP is `DDMM.mmm` / `DDDMM.mmm` with styles landing 21,
   takeoff 20; OpenAir is `AC W`, `AL SFC`, `AH 100ft AGL` and
   `DP dd:mm:ss.ss N ddd:mm:ss.ss E` per vertex, ring closed.

One-off migration script: 34 features from WKT (`content/storage.*.json`) to point + shape.
Zod geometry validation. `geo:export` / `geo:import` round-trip scripts. `featureTypes.ts`
as the single source for type → colour / icon / CUP style / OpenAir class. The `<Map>`
component against the MapLibre API with the MapTiler adapter isolated (§4.2.1). `/siti`
overview map + site grid; per-site maps with inlined GeoJSON; feature tables;
`/api/sites/all/geo.json`; the OpenAir and CUP endpoints.
**Exit:** the new `.txt` and `.cup` outputs diff clean against the Phase 0 reference build
(modulo the date header) — this is the gate, it's flight-computer data. Maps verified on
desktop and mobile.
**Covers:** M1–M13, A1–A5.

### Phase 5 — Cutover

Verify the preserved URLs and the two redirects (`/contact/contatti` → `/contatti`,
`/home` → `/`). Point DNS / swap the Netlify site. Confirm the navdata files resolve at
their exact old URLs. Archive the Drupal repo read-only — do not delete it; it stays the
reference for anything found missing later.

### Phase 6 — Membership & payments _(gated on the committee, decoupled)_

`/iscrizioni` already shipped in Phase 2 with the **existing Satispay links and bank
transfer**, so the site is complete and live without this. When **D10** is resolved: swap
the `payUrl` values to Stripe Payment Links, build the Make.com → Google Sheets scenario
(search-then-update-or-add, so renewals do not duplicate), decide how members identify
themselves at checkout, test with a real €10 payment, keep the bank-transfer fallback.
**Exit:** a test payment appears correctly as a row in the Sheet, and a second payment from
the same member updates that row rather than adding another.
**Covers:** §5, D10.

### Phase 7 — Beyond parity _(decided, not scheduled)_

Everything above restores what the Drupal site did. These are things it never did, prompted
by a look at what Astro themes ship (Stardrive's feature list in particular). Recorded here
with the decision already taken, so none of it gets rediscovered as a "good idea" later.

**1. Events on news posts, with `.ics`.** ✅ _Wanted._ Not a separate collection: a news
post _is_ the announcement, so it gains optional `event` fields — start date, optional end
date, location — and is an event when they are filled in. That buys three things from one
change: a "Aggiungi al calendario" `.ics` download, the **`Event` node in the schema.org
graph that §S7 deliberately left out** because the dates only existed in prose
(`src/lib/schema.ts` records exactly this), and a "prossimi eventi" block if one is ever
wanted. Touches the `news` schema in §2.1, `keystatic.config.ts` and the JSON-LD.
Half a day. The biggest genuine capability gain on this list.

**2. ESLint + Prettier.** ✅ _Wanted._ The project has neither; `astro check` catches types
and nothing catches style. Development-only, so no cost to a visitor, and it matters more
now that club members may point AI agents at this repository. An hour.

**3. WebMCP — the site exposing callable tools to a visitor's AI assistant.** ✅ _Wanted,
deliberately not yet._ The idea fits this site unusually well: fourteen flight sites with
altitude, exposure and attributes is exactly the shape of "find me a beginner-friendly
south-east site under 1500m", and Phase 4 adds coordinates to make it better still. Two
reasons to wait rather than drop it: it ships JavaScript to **every** visitor for something
almost no visitor's browser can yet use, which is precisely the trade the performance
budget exists to refuse (`docs/performance.md`); and the proposal is young enough that
building against it now risks building against a version that changes.

**Revisit when** browser or assistant support is real, and **after Phase 4**, so the tools
can answer with coordinates and airspace rather than prose. Note that `/llms-full.txt`
(S17) and the schema.org graph already give an assistant most of these answers today,
without shipping a byte to anyone.

**4. View transitions.** ⏸️ _Deferred to the end, performance first._ Astro's
`<ClientRouter />` gives cross-page animation, and the site is half-prepared already — the
theme toggle, nav drawer and gallery scripts all re-bind on `astro:after-swap`. But it
ships client JavaScript to every page, so it goes in only if it is measured against the
budget and still looks worth it. Last, if at all.

**5. Table of contents on articles.** ❌ _Not wanted._ Posts are a few hundred words.

**Not on this list, and deliberately:** Tailwind (the CSS layer is 3.6 kB hand-rolled),
i18n routing (single locale — GTranslate covers the rest, G11), and anything requiring edge
compute. Every page here is prerendered HTML on a CDN; there is no per-request work for a
Worker to do, and the only server-rendered routes the site will ever have are Keystatic's
admin, used by one or two people.

---

## Appendix: inventory sources

| Claim                                | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content types, fields, view displays | `config/node.type.*.yml`, `config/field.*.yml`, `config/core.entity_view_display.*.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Layout Builder page composition      | `layout_builder__layout` in `content/node.*.json`; `config/core.entity_view_display.node.sito.default.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Item counts                          | `content/*.json` (34 storage, 29 path_alias, 25 node, 18 file, 7 block_content, 5 menu_link_content, 4 taxonomy_term)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Views                                | `config/views.view.*.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Airspace / waypoint logic            | `web/modules/custom/navdata/src/Controller/NavdataController.php`, `README.md`, `navdata.routing.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Map rendering                        | `web/modules/custom/mapper/js/maptiler-map.js`, `mapper.module`, `config/core.entity_view_display.storage.map_feature.default.yml`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| XContest                             | `web/modules/custom/scraper/src/Plugin/Block/ScraperBlock.php`, `templates/xct-tables.html.twig`                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Theme structure                      | `web/themes/custom/vr/` (`vr.info.yml`, `templates/`, `components/`, `scss/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Live URL inventory                   | `html/sitemap.xml`, `html/` directory tree                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| SEO / social cards                   | `config/metatag.metatag_defaults.*.yml`, `config/image.style.social_card*.yml`, `web/modules/custom/helper/helper.module`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Hosting / build                      | `netlify.toml`, `config/tome_add_paths.config.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Astro / Keystatic APIs               | [Astro content collections](https://docs.astro.build/en/guides/content-collections/), [Astro on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/), [Keystatic + Astro](https://keystatic.com/docs/installation-astro), [Keystatic GitHub mode](https://keystatic.com/docs/github-mode), [relationship](https://keystatic.com/docs/fields/relationship) / [array](https://keystatic.com/docs/fields/array) / [object](https://keystatic.com/docs/fields/object) / [blocks](https://keystatic.com/docs/fields/blocks) fields |
