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

### 5. Check the club is happy with what is there: after go-live, deliberately

The site is the club's, not the migration's, so someone who is not a developer
has to look at it on a phone. That happens **after** the domain moves, decided
2026-09-05: asking the club to review `ventorelativo-astro.netlify.app` means
explaining why the address is wrong before anyone gets to the site itself, and
the answers would be about the URL rather than about the pages.

The rollback is what makes that safe: the old project keeps its own deploy, so
anything the club hates is a domain move away from being the old site again.

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
  says _Anteprima_, `Astro.site` is not what you think it is: check the
  `CONTEXT` and `URL` variables Netlify sets.
- The two navdata files are the ones that matter most. Pilots have them loaded
  in their instruments and the URLs are load-bearing (AGENTS.md rule 9).
- Open a flight site page and open the map, on a phone. That exercises the
  MapTiler key, the referrer allowlist and WebGL in one go.

Then:

- **Google Search Console**, submit `https://ventorelativo.it/sitemap-index.xml`.
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

- **Rotate the Tracestrack key.** Deliberately not a blocker (decided
  2026-09-03): rotating before the move would 403 the topographic base layer on
  the live site until the new key's referrer list caught up, and there is no
  money on the account. But the old value was hard-coded in
  `src/lib/mapConfig.ts` and committed, so it is in this repository's history
  and in every public bundle built from it: moving it to an environment
  variable stopped the next build leaking it, not the ones already published.
  After the move: issue a new key at tracestrack.com with `ventorelativo.it` and
  `https://*--ventorelativo-astro.netlify.app` on its referrer list, put it in
  `.env` and in Netlify, redeploy, open a map, then revoke the old key.

- Phase 6 (payments) is documented in [payments.md](payments.md) and not
  executed. Nothing about it blocks the cutover: `/iscrizioni` works today with
  the existing Satispay links and the bank transfer.
- If payments do go live first, the Stripe Payment Links' redirect URL has to be
  changed from the `*.netlify.app` address to `https://ventorelativo.it/iscrizioni/grazie`.
