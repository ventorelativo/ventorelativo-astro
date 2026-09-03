# Cutover

Phase 5. The day `ventorelativo.it` stops serving the Drupal export and starts
serving this build.

Almost none of it is code. What code could do has been done: `npm run verify`
now fails if any URL the old site served stops resolving
(`scripts/check-urls.mjs`), `robots.txt` opens itself the moment the hostname is
right, and the flight data is byte-gated against the archive. What is left is a
handful of things only a person with the accounts can do, in an order that does
not strand anyone mid-way.

## Before the domain moves

### 1. Set `PUBLIC_MAPTILER_KEY` in Netlify

**The deployed map does not work today.** The bundle on
`ventorelativo-astro.netlify.app` contains a style URL ending in a bare `?key=`,
and that request returns 403 — the map opens, draws nothing and reports no
error. The variable is set in `.env` locally, which is why nobody noticed.

Netlify → **Site configuration → Environment variables** → add
`PUBLIC_MAPTILER_KEY` with the value from `.env`, then redeploy. `netlify.toml`
already lists it in `SECRETS_SCAN_OMIT_KEYS`, so the build will not fail on it;
without that line it would.

A build without the key now says so in the deploy log.

### 2. Set `PUBLIC_CF_BEACON_TOKEN`, or decide not to

Also absent, so there are no analytics on the deployed site. That is a decision
either way — the beacon is the site's only third-party request. If the numbers
are never going to be read, leaving it unset is the cheaper answer and
`Analytics.astro` renders nothing.

### 3. Add the branch previews to the Tracestrack referrer list

`https://*--ventorelativo-astro.netlify.app`. Without it the topographic base
layer 403s on every preview deploy, which looks like a broken map to an editor
checking their own branch.

### 4. Take the test content out

- **`/news/a-test-news/`** — written from the CMS to prove Phase 3 worked. It is
  lorem ipsum, and it is currently the newest post, so it is the first card on
  `/news/` and would be the first thing a visitor sees. Delete it in Keystatic.
- **`/styleguide`** — a development reference. Delete `src/pages/styleguide.astro`.
  It is already out of the sitemap and out of search, but after the move it would
  be a real page on the club's domain. `scripts/check-urls.mjs` already knows it
  is meant to go.

### 5. Check the club is happy with what is there

The site is the club's, not the migration's. Worth one pass by someone who is not
a developer, on a phone, before the address changes.

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
  says _Anteprima_, `Astro.site` is not what you think it is — check the
  `CONTEXT` and `URL` variables Netlify sets.
- The two navdata files are the ones that matter most. Pilots have them loaded
  in their instruments and the URLs are load-bearing (AGENTS.md rule 9).
- Open a flight site page and open the map, on a phone. That exercises the
  MapTiler key, the referrer allowlist and WebGL in one go.

Then:

- **Google Search Console** — submit `https://ventorelativo.it/sitemap-index.xml`.
  Until now the site has been asking not to be crawled at all.
- **Archive the Drupal repository read-only.** Do not delete it: it is the
  evidence the navdata and URL gates compare against, and both fail without it.
  `../ventorelativo-drupal` is referenced by path from `npm run verify`.

## What does not need doing

- **`robots.txt`** switches itself on the hostname. There is nothing to edit.
- **The canonical URLs, sitemap and social cards** all derive from `Astro.site`,
  which Netlify sets per context. Deploy previews already describe themselves.
- **Keystatic's preview links** stay on `*.netlify.app` on purpose: a branch
  preview has no other address.

## Still open at the time of writing

- Phase 6 (payments) is documented in [payments.md](payments.md) and not
  executed. Nothing about it blocks the cutover — `/iscrizioni` works today with
  the existing Satispay links and the bank transfer.
- If payments do go live first, the Stripe Payment Links' redirect URL has to be
  changed from the `*.netlify.app` address to `https://ventorelativo.it/iscrizioni/grazie`.
