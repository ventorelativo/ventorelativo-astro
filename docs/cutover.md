# Cutover

Phase 5, **done on 2026-09-05**: the day `ventorelativo.it` stopped serving the
Drupal export and started serving this build. Kept as the record of what was
done, in the order it was done, and of what each step was guarding against.

Almost none of it is code. What code could do has been done: `npm run verify`
now fails if any URL the old site served stops resolving
(`scripts/check-urls.mjs`), `robots.txt` opens itself the moment the hostname is
right, and the flight data is byte-gated against the archive. What is left is a
handful of things only a person with the accounts can do, in an order that does
not strand anyone mid-way.

## Before the domain moves

### 1. Set the two map keys in Netlify: done 2026-09-03

`PUBLIC_MAPTILER_KEY` and `PUBLIC_TRACESTRACK_KEY` are set in Netlify → **Site
configuration → Environment variables**. Before that the deployed bundle carried
a style URL ending in a bare `?key=`, which returns 403: the map opened, drew
nothing and reported no error.

`netlify.toml` lists both in `SECRETS_SCAN_OMIT_KEYS`, so the build does not
fail on finding them in the output, where Astro deliberately put them. A build
without the MapTiler key says so in the deploy log.

### 2. Set `PUBLIC_CF_BEACON_TOKEN`: done, production only

Decided 2026-09-03: analytics is on. Netlify → **Site configuration →
Environment variables** → `PUBLIC_CF_BEACON_TOKEN`, from the Cloudflare Web
Analytics dashboard. Set 2026-09-04, scoped to the **production** context alone,
so previews and branch deploys count nothing: an editor checking their own
branch is not a visitor. Without it `Analytics.astro` renders nothing, which is
what happens locally and on every preview.

**This one is coupled to a legal page.** `/privacy` now states as fact that the
beacon runs, names Cloudflare as a US recipient, and gives legitimate interest
as the basis. Leaving the token unset in production makes that notice describe
something the site does not do. If the club changes its mind, the "Statistiche
di visita" section and the sentence about it in "In breve" come out together,
and so does the entry in `check-third-party.mjs`'s allowlist.

No cookie banner is needed and none should be added: nothing is stored on the
visitor's device, so there is nothing to consent to.

### 3. Add the branch previews to the Tracestrack referrer list: done 2026-09-04

`https://*--ventorelativo-astro.netlify.app`. Without it the topographic base
layer 403s on every preview deploy, which looks like a broken map to an editor
checking their own branch.

### 4. Take the test content out: done 2026-09-04

- **`/news/a-test-news/`**: written from the CMS to prove Phase 3 worked. Lorem
  ipsum, and the newest post, so it was the first card on `/news/` and would
  have been the first thing a visitor saw on the club's own domain. Deleted from
  Keystatic; `scripts/check-urls.mjs` already knew it was meant to go.

### 5. Check the club is happy with what is there: done 2026-09-08

The site is the club's, not the migration's, so someone who is not a developer
had to look at it on a phone. That happened **after** the domain moved, decided
2026-09-05: asking the club to review `ventorelativo-astro.netlify.app` means
explaining why the address is wrong before anyone gets to the site itself, and
the answers would have been about the URL rather than about the pages.

**The committee reviewed it and approved it.** The rollback was what made
waiting safe: the old project kept its own deploy, so anything the club hated
was a domain move away from being the old site again. It was not needed.

## Moving the domain

Both projects are on Netlify, which makes this a two-minute operation and a
reversible one.

1. **`ventorelativo` project** (the Drupal export) → Domain management → remove
   `ventorelativo.it` and `www.ventorelativo.it`.
2. **`ventorelativo-astro` project** → Domain management → add both, with the
   apex as the primary and `www` redirecting to it. That is the arrangement the
   old project had, and `astro.config.mjs` assumes the apex.
3. Wait for the certificate. Netlify provisions a new one for the domain on its
   new project; until it does, HTTPS will fail.

**Do not delete the old project.** It keeps serving from its own deploy at its
`*.netlify.app` address, which is the rollback: move the domain back and the old
site is live again in the time it takes DNS to notice.

**Done on 2026-09-05.** The old project is now named `ventorelativo-drupal` and
answers at <https://ventorelativo-drupal.netlify.app>, which is the address to
check the rollback with: `ventorelativo.netlify.app` is not it and returns 404.

## After

Check, in this order, because each one catches a different failure:

```
curl -sI https://ventorelativo.it/ | head -1
curl -s  https://ventorelativo.it/robots.txt | head -3
curl -sI https://ventorelativo.it/api/navdata/ventorelativo-waypoints.cup | head -1
curl -sI https://ventorelativo.it/home | head -1        # expect 301 → /
curl -sI https://ventorelativo.it/contact | head -1     # expect 301 → /contatti
```

- `robots.txt` should now read `Allow: /` with a `Sitemap:` line. If it still
  says _Anteprima_, `Astro.site` is not what you think it is: check the
  `CONTEXT` and `URL` variables Netlify sets.
- The two navdata files are the ones that matter most. Pilots have them loaded
  in their instruments and the URLs are load-bearing (AGENTS.md rule 9).
- Open a flight site page and open the map, on a phone. That exercises the
  MapTiler key, the referrer allowlist and WebGL in one go.

Then:

- **Google Search Console.** Its own section below: it is the one step with
  more than a click in it.
- **Archive the Drupal repository read-only: done 2026-09-08.**
  `ventorelativo/ventorelativo-drupal` is archived, not deleted, and must stay
  that way: it is the evidence the navdata and URL gates compare against, and
  both fail without it. `../ventorelativo-drupal` is referenced by path from
  `npm run verify`, and an archived repository still reads and clones.

## Search Console

The domain is not new to Google. It has been indexed for years, the old site's
URLs are all still served or redirected (`scripts/check-urls.mjs` is the gate),
and the canonical host has not changed. So this is not a launch, it is a
recrawl of pages Google already has: nothing here needs to hurry, and nothing
below buys a ranking. What it buys is the ability to **see** what Google thinks,
which the club has never had.

### 1. Verification: the meta tag, in every page's head

Done on 2026-09-08 with the **HTML tag** method rather than the DNS record.
`src/layouts/BaseLayout.astro` carries it, so it is in the `<head>` of all
thirty built pages, and the comment there says what it is and why it is
hardcoded rather than read from an environment variable.

**Do not remove it.** Google re-checks the tag periodically and unverifies the
property when it disappears, which takes the club's access to the reports with
it. It costs 96 bytes a page and it is not a credential: it grants nothing to
whoever reads it.

What this method verifies is a **URL-prefix property**: exactly
`https://ventorelativo.it`, one scheme and one host. `https://www.ventorelativo.it`
is a separate property in Google's eyes, which costs nothing here because `www`
301s to the apex and nothing links to it, so there is no traffic to lose sight
of. If the club ever wants both halves under one roof, or a report that follows
the domain rather than the URL, the Domain property is the shape to switch to
and it needs a `TXT` record at Aruba, where the DNS lives. The meta tag can stay
alongside it.

### 2. Submit the sitemap

`https://ventorelativo.it/sitemap.xml`, which is the file this site writes and
the one `robots.txt` points at. There is **no `sitemap-index.xml`**: that is
@astrojs/sitemap's name for it and it 404s here, which will be reported as a
sitemap that could not be read.

`src/pages/sitemap.xml.ts` lists 25 URLs and carries a `lastmod` on the news
posts alone, deliberately: the file explains why the alternatives are worse
than an absent one.

### 3. Ask for the home page, and only the home page

URL Inspection → `https://ventorelativo.it/` → **Request indexing**. One page
is enough to bring a crawler in; it will find the other twenty-four from the
sitemap and the navigation. Requesting all of them by hand is a way to hit the
daily quota and learn nothing.

### 4. What to watch, and for how long

Give it two weeks, then read three things:

- **Pages**, for anything under _Crawled, currently not indexed_. On a site
  this small that usually means a page with nothing much on it: the five
  thinner flight sites are the honest candidates, and the fix is the
  committee's aerology text, not markup.
- **Sitemaps**, for _Discovered URLs: 25_. A lower number means the file was
  read before a deploy finished, a higher one is impossible and means the wrong
  property.
- **`/keystatic` must never appear.** `robots.txt` disallows it and it is
  behind a login, but a CMS in a search result is worth checking for once.

Two things that will look like problems and are not: the four `noindex` pages
(`/styleguide`, `/redazione`, and the two post-action pages) reported as
_Excluded by noindex_, which is exactly what they ask for; and every
`*.netlify.app` preview reported as _Blocked by robots.txt_, which is
`src/pages/robots.txt.ts` doing its job.

### 5. Bing, if it is wanted

Bing Webmaster Tools imports a verified Search Console property whole, sitemap
included, in one step. It costs a few minutes and covers Bing, DuckDuckGo and
Ecosia at once. Nobody has asked for it; it is here so the option is known.

## What does not need doing

- **`robots.txt`** switches itself on the hostname. There is nothing to edit.
- **The canonical URLs, sitemap and social cards** all derive from `Astro.site`,
  which Netlify sets per context. Deploy previews already describe themselves.
- **Keystatic's preview links** stay on `*.netlify.app` on purpose: a branch
  preview has no other address.

## Still open

- Phase 6 (payments) is documented in [payments.md](payments.md) and not
  executed. Nothing about it blocks the cutover: `/iscrizioni` works today with
  the existing Satispay links and the bank transfer.
- Payments (Phase 6) no longer have a redirect URL to change: D10 was reversed on
  2026-09-08 and Satispay's link cannot redirect anywhere, which is why the site asks
  who is paying first. See [payments.md](payments.md).

## Closed since

- ~~**Rotate the Tracestrack key.**~~ **Closed 2026-09-08: it stays as it
  is.** The old value was hard-coded in `src/lib/mapConfig.ts` and committed,
  so it is in this repository's history and in every public bundle built from
  it; moving it to an environment variable stopped the next build leaking it,
  not the ones already published. It is not worth rotating anyway: the key is
  **filtered by referrer**, so it only works for requests that say they come
  from `ventorelativo.it`, and there is no money on the account. Someone
  lifting it out of the bundle gets a key that will not draw them a tile.
  If the referrer list ever gains a wildcard, this becomes a real exposure
  again.
