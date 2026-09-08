# Soci, quote e tessere

How the club keeps its member register, collects the year's quotas and issues
the membership card, with as little of it done by hand as the tools allow.

Written for a committee member, not a developer. The payment rails themselves
are in [payments.md](payments.md); this is what happens around them.

## Dove siamo, 2026-09-08

**Nothing here has ever run**, and no spreadsheet exists yet.

The script and these documents are on `main` and inert: nothing on the site
calls them and no build sees them. **The site's half is on the `soci-e-quote`
branch, unmerged on purpose**, because a form that writes to a spreadsheet
nobody has made yet is worse than no form. It merges when the setup below is
done.

Done:

- the form on `/iscrizioni` and the payment step on `/iscrizioni/grazie`, on
  the branch;
- `tools/soci/Codice.js`, the whole automation, unrun and untested against a
  live Sheet or the Satispay API;
- the 2026 workbook converted (`tools/soci/importa-excel.py`): **97 paying
  members** (64 Soci, 33 Sostenitori) and 52 lapsed, imported as `inattivo`;
- membership numbers assigned, Luca Odetto VR-0001, active before lapsed.

Waiting on:

1. **A club-owned Google account.** Deliberately not a personal one: it will own
   the Sheet, the Drive folder and the script, and the club should not lose them
   when a volunteer leaves the committee. Everything else is blocked on this.
2. Three members whose surname is missing from the workbook: `Ariel`, `Ervin`,
   `Roberto`, all from the donations sheet where the surname cell was empty.
3. The committee ratifying the move to Satispay only (D10, reversed).

Two facts settled on the way, so they are not rediscovered:

- **The register has no email addresses.** None, in either sheet. The form fills
  them in as members renew: see "Le email" below.
- **A free `gmail.com` account is enough.** Google for Nonprofits in Italy
  validates ONLUS, APS, ETS in RUNTS and foundations; an ASD registered only in
  the sports register is not eligible unless it also joined RUNTS. It does not
  matter: the alias in step 2 fixes the address members see, and the 100 emails
  a day a consumer account allows only means January takes two afternoons
  instead of one. `ventorelativo.it` publishes `p=none`, so nothing is rejected
  for failing DMARC alignment.

## The shape of it

**The spreadsheet is not a record of the work. It is the thing that does the
work.**

```
Excel esistente ──una volta──▶ Google Sheet
                                 Soci    ID | Nome | Email | Stato | Iscritto dal | Note
                                 Quote   ID | Anno | Quota | Importo | Rail | Data | Stato | Invito | Pagamento | Tessera
                                 Incassi ID pagamento | Data | Importo | Nome | Stato | Abbinato a

Apps Script legato al foglio. Ogni ora, da solo:

  API Satispay ──▶ Incassi ──▶ abbina al socio ──▶ Quote: pagato ──▶ tessera PDF

E un menu "Ventorelativo" per le cose che richiedono una decisione:
  ▸ Sincronizza adesso            lo stesso giro, subito
  ▸ Apri il nuovo anno            crea le righe e manda le email di rinnovo
  ▸ Genera e invia le tessere
  ▸ Prepara i fogli / Attiva Satispay / Installa il controllo automatico

E, senza menu, il modulo del sito che scrive da solo un socio nuovo.
```

The source is `tools/soci/Codice.js` in this repository. It lives here rather
than only in the club's Google account because a script nobody can read is a
script nobody can fix when the person who wrote it has moved on.

**There is no Make.com, no Zapier and no server.** Apps Script already receives
webhooks, sends email, writes files to Drive and can be run on a schedule, so a
second service would only move data between two Google products while adding an
account, a bill and somewhere else to look when it breaks.

## Perché non Airtable

Asked and answered on 2026-09-08, because "one shared login for the committee"
is a fair thing to want and Google's account model is not obviously that.

It does not survive contact with the three jobs here:

- **Automations: 100 runs a month on the free plan.** Checking Satispay hourly
  is about 720. That alone means the Team plan, 20 dollars per user per month,
  against a whole argument about 30 euro a year of fees.
- **No RSA signing.** Airtable's scripting takes no external libraries and
  offers no signing primitives, and a Satispay request has to be signed. The
  automatic matching, the thing the treasurer actually wanted, would need a
  fourth service to do it somewhere else.
- **No PDF.** Airtable does not make one. The card would need a paid add-on;
  here it is a Slides file a committee member can restyle.

And it does not fix what prompted the question: Airtable's own emails come from
Airtable, not from the club. The address members see is solved by a Gmail alias
(step 2), which costs five minutes and nothing a month.

A shared login is still available if the committee wants one: the Google account
that owns all this can be the club's, with its password wherever the club keeps
its passwords, exactly like one Airtable login.

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
`cartellaTessere`, once step 4 exists.

### 2. The address members see

The script sends as the Google account that authorised it, which would put a
volunteer's personal mailbox in front of a hundred members and make the club
look like one person.

Fix it once, in Gmail: **Impostazioni → Account → Invia messaggi come → Aggiungi
un altro indirizzo email**, `segreteria@ventorelativo.it`, and confirm the
verification mail. From then on every renewal, card and alert goes out as the
club. The script checks for the alias and uses it if it is there, so nothing
breaks while you are setting it up.

**This is why the account matters less than it looks.** It still owns the Sheet,
the Drive folder and the script, so it should be a club account rather than a
personal one, but members never see it.

### 3. Share it properly

**Named committee accounts only. Never "anyone with the link".** It holds names
and email addresses, and a link that leaks is a link that stays leaked.

### 4. The card template

A **Google Slides** file, one slide, sized like a card. Put the four
placeholders in it exactly as written: `{{nome}}`, `{{quota}}`, `{{anno}}`,
`{{tessera}}`. The script copies the file, replaces them, exports a PDF and
throws the copy away.

Anyone on the committee can redesign the card by editing that one file. Nothing
in the code knows what it looks like.

Make a Drive folder for the generated cards and put both ids into `CONFIG`.

### 5. Satispay, so the matching can be automatic

Generate a key pair on your own machine, not in the browser:

```
openssl genrsa -out satispay.key 4096
openssl rsa -in satispay.key -pubout -out satispay.pub
```

Paste both into Apps Script under **Project Settings → Script Properties**, as
`SATISPAY_PRIVATE_KEY` and `SATISPAY_PUBLIC_KEY`. Then get a one-time
activation code from the Satispay Business account and run **Ventorelativo →
Attiva Satispay**. It exchanges the code for a KeyId and stores it.

The activation code is burned on use: a failed attempt needs a fresh one.

Then **Installa il controllo automatico**, which sets the hourly trigger.

**The private key never goes in this repository**, or in the spreadsheet, or in
an email. Script Properties, and a copy wherever the club keeps its passwords.

### 6. The website's form

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

### Durante l'anno: niente

This is the part that used to be the job. Every hour the script asks Satispay
what has been paid, writes it into **Incassi**, works out whose payment each
one was, marks the quota `pagato` and sends the card. Nobody clicks anything.

**Why it can do that, when the payout report never could.** The report the
treasurer was reading gives a payment id, a timestamp and an amount, and no
way to tell whose payment it was: working that out, one payment at a time, was
the whole tedious business. The API returns **`sender.name`** on every payment,
so the question answers itself.

It matches by name against the register, falling back to an amount only one
member still owes. **It marks nothing it had to guess at**: two members owing
€30 and neither having paid is a question, not a match, and it goes in an
email to the committee instead of being settled by coin flip. That email only
ever arrives when something genuinely needs a person.

**Wire transfers stay manual**, and should. The treasurer sees them in the
bank and types `pagato` in the row; the renewal email asks members to put
their member id in the causale, which makes finding the row a search rather
than a hunt. The card goes out on the next hourly run, exactly as it does for
a Satispay payment.

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

## I numeri di tessera

**Ventorelativo → Rinumera i soci** hands the numbers out again: `CONFIG.primi`
first, in that order, then the active members by surname, then everybody who
has not renewed. `Quote` follows automatically and the rows are reordered to
match, so the sheet reads the way the numbers run.

**It refuses once the numbers are out.** A membership number is private until
it is printed on a card, put in the `external_code` of a renewal link, or typed
into a bank transfer's causale. After that, renumbering does not rename
anybody: it makes the card, the email and the bank disagree, and there is no
recalling what is already in an inbox. So the command checks `Tessera`,
`Pagamento` and `Invito`, and tells you which row stopped it.

Before then, change `CONFIG.primi` and run it as often as you like.

## Le email, che nel foglio non ci sono

The register imported from the club's spreadsheet has **no email addresses**:
that column never existed. Everything works without them except the two things
that need one, sending a renewal request and sending a card, and both count
what they had to skip rather than skipping it quietly.

**The form collects them, without anybody transcribing anything.** A submission
whose email matches nobody is checked against the members who have no email
yet, and when exactly one name fits, that row gets the address. So an existing
member filling the form is recognised as themselves and their record is
completed, rather than being greeted as a stranger and given a second row.

Which makes the first renewal round the collection round: put the link to
`/iscrizioni` wherever the club already talks to its members, and the register
fills itself in as people renew.

Two members with the same name is the one case it will not resolve. It refuses
to guess, makes a new row, and the committee merges the two: a nuisance, where
guessing would mean somebody receiving another member's card.

Import the workbook with `tools/soci/importa-excel.py`, which writes `Soci.csv`
and `Quote.csv` ready to paste in. Keep its output outside this repository.

## Cosa può ancora andare storto

**The payer's Satispay name is not always the name on the register.** Somebody
pays from a spouse's account, or their account says "Mimmo" where the register
says "Domenico". The script will not guess: the payment lands in the committee
email as unmatched, and a person spends fifteen seconds on it. Fixing the
member's `Nome` to match makes it automatic for every year after.

**The API returns `sender.name` once the payment is matched to a consumer**, so
a very fresh payment can arrive with an empty name. The next hourly run picks
it up: nothing is lost, because `Incassi` keeps the payment id and only unmatched
rows are ever reconsidered.

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
