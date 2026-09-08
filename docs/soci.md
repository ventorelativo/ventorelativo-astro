# Soci, quote e tessere

How the club keeps its member register, collects the year's quotas and issues
the membership card, with as little of it done by hand as the tools allow.

Written for a committee member, not a developer. The payment rails themselves
are in [payments.md](payments.md); this is what happens around them.

## The shape of it

**The spreadsheet is not a record of the work. It is the thing that does the
work.**

```
Excel esistente ──una volta──▶ Google Sheet
                                 Soci    ID | Nome | Email | Stato | Iscritto dal | Note
                                 Quote   ID | Anno | Quota | Importo | Rail | Data | Stato | Invito | Tessera
                                 Incassi  (il report Satispay, incollato)

Apps Script legato al foglio, un menu "Ventorelativo":
  ▸ Prepara i fogli
  ▸ Apri il nuovo anno            crea le righe e manda le email di rinnovo
  ▸ Importa incassi Satispay      segna pagato quello che è arrivato
  ▸ Genera e invia le tessere     PDF a chi ha pagato

E, senza menu, il modulo del sito che scrive da solo un socio nuovo.
```

The source is `tools/soci/Codice.js` in this repository. It lives here rather
than only in the club's Google account because a script nobody can read is a
script nobody can fix when the person who wrote it has moved on.

**There is no Make.com, no Zapier and no server.** Apps Script already receives
webhooks, sends email, writes files to Drive and can be run on a schedule, so a
second service would only move data between two Google products while adding an
account, a bill and somewhere else to look when it breaks.

## The one design rule

**A person is a row in `Soci`, forever. A year is a row in `Quote`.**

The year is never a column. A renewal adds a row and rewrites nothing, which is
what keeps "who was a member in 2026" answerable in 2029, and what lets a member
change tier, lapse for a year and come back without any of it being destructive.

## Setting it up, once

### 1. The spreadsheet

Import the club's existing Excel into Google Sheets (File → Import). Then
**Extensions → Apps Script**, paste `tools/soci/Codice.js` into `Codice.gs`, and
save.

Reload the spreadsheet: a **Ventorelativo** menu appears. Run **Prepara i
fogli**. It creates the three tabs with their headers and touches no existing
data; moving the old columns under the new headings is a hand job, done once.

Fill in the two ids at the top of the script, `templateTessera` and
`cartellaTessere`, once step 3 exists.

### 2. Share it properly

**Named committee accounts only. Never "anyone with the link".** It holds names
and email addresses, and a link that leaks is a link that stays leaked.

### 3. The card template

A **Google Slides** file, one slide, sized like a card. Put the four
placeholders in it exactly as written: `{{nome}}`, `{{quota}}`, `{{anno}}`,
`{{tessera}}`. The script copies the file, replaces them, exports a PDF and
throws the copy away.

Anyone on the committee can redesign the card by editing that one file. Nothing
in the code knows what it looks like.

Make a Drive folder for the generated cards and put both ids into `CONFIG`.

### 4. The website's form

In Apps Script: **Deploy → New deployment → Web app**, execute as yourself,
access **Anyone**. Copy the URL it gives you.

"Anyone" is not a slip: Netlify cannot log in to Google. The protection is a
token. In Apps Script, **Project Settings → Script Properties**, add
`WEBHOOK_TOKEN` with a long random value, and give Netlify the URL with
`?token=<that value>` on the end.

Then in Netlify: **Project configuration → Notifications → Emails and webhooks
→ Form submission notifications**, add an **outgoing webhook** on the
`iscrizioni` form pointing at that URL. Add an **email notification** to the
committee address as well: it costs nothing and it is how you find out that the
webhook has been broken for a fortnight.

**The token is a secret and does not belong in this repository.** It lives in
Script Properties and in Netlify, nowhere else.

## The year, end to end

### Gennaio: apri l'anno

**Ventorelativo → Apri il nuovo anno.** For every active member it creates a
`Quote` row for the new year, carrying last year's tier forward, and emails each
of them a renewal request with their own payment link.

That link has the member's id in `external_code`. Which matters more than it
looks: see below.

### Durante l'anno: segna gli incassi

Download the Satispay report (dashboard → Transactions → Request report), paste
it into the **Incassi** tab, headers and all, then **Importa incassi Satispay**.

It matches on the member id where the report has one, on the amount where it
does not, refuses to guess when two people owe the same amount and neither has
paid, and tells you exactly which payments it left alone. Those are settled by
hand in seconds.

**Wire transfers are not imported and should not be.** The treasurer sees them
in the bank, types `pagato` in the row, and any import would be more work than
that.

### Poi: manda le tessere

**Genera e invia le tessere.** Every quota marked `pagato` without a card gets a
PDF, emailed to the member and filed in Drive, and the file's link goes in the
`Tessera` column.

That column is also the guard: the command can be run twice without emailing
anybody twice. Run it whenever, or set a weekly trigger and forget it.

`Invito` does the same job for the renewal email. Between them, every command
in the menu can be run again without anyone receiving anything twice, which is
what makes it safe to give the menu to somebody who is not sure whether they
already clicked it.

### Un socio nuovo, in qualsiasi momento

Either they fill the form on `/iscrizioni`, and the row appears by itself, or a
committee member types them into `Soci` and adds a `Quote` row. Both end in the
same two tables.

## The thing worth checking first

**Does the Satispay report include the `external_code` column?**

If it does, every renewal payment matches its member exactly and the import is
one click with nothing to arbitrate. If it does not, matching falls back to the
amount, and two €30 payments in the same week have to be told apart by a person.

Everything above works either way. It is the difference between the January job
taking ten minutes and taking an afternoon, so it is worth five minutes in the
dashboard before promising the committee anything.

## Why a PDF and not a wallet pass

Decided 2026-09-08.

- **PDF**: free, no accounts, opens on every phone, restyled by editing a Slides
  file. What is built.
- **Google Wallet**: also free, and Apps Script can sign the pass itself, but it
  needs a Google Cloud project, a service account key the club then holds, an
  Issuer account with a business profile and a review before real members can
  save anything. A sensible second step, once the rest is running. It would not
  change any of the above.
- **Apple Wallet**: 99 dollars a year per team, plus a signing certificate that
  must be renewed annually. When it lapses, new cards silently stop being
  issued. Not worth it for a club this size unless the committee asks.

## Things that will bite

- **Apps Script can send 100 emails a day from a consumer Gmail account**, and
  1500 from a Google Workspace one. Not the same as the limits you see in
  Gmail itself, and much lower. Eighty renewals from a `gmail.com` account is
  within it but has no room: run **Apri il nuovo anno** twice in a day, or
  send the cards the same afternoon, and the second batch fails silently
  partway through. Two ways out, both cheap: put the club on Workspace, or
  open the year on one day and send cards on another. **Check the `Quote` tab
  after a big run**: rows still saying `da rinnovare` that should have been
  emailed are what a hit quota looks like.
- **A form submission is not a payment.** It is somebody saying they intend to
  pay. The `Stato` column is the whole difference, and it is the one thing a
  person has to keep honest.
- **Apps Script asks for permissions the first time**, including sending mail as
  you. The renewal emails will come from whoever authorised the script, so
  authorise it from the club's account and not from a personal one.
- **No member PII in the website's repository.** It is public and Keystatic
  writes to it. Names and emails belong in the Sheet, in Drive and in Netlify's
  form panel, nowhere else.
- **When the card flow goes live, `/privacy` needs a line about it**: the club
  will then be storing a PDF with a member's name in Drive and sending it by
  email. The notice, what the site says and what actually happens have to stay
  in step.
