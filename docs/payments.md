# Membership payments

Phase 6. What a member pays, how it reaches the club's bank account, and how it
stops being reconciled by guesswork.

**Almost none of this is code.** The site's part is built: a form on
`/iscrizioni` and the payment step at `/iscrizioni/grazie`. What is left is
account work, which is why it is written down rather than built.

This document is the money: the rails, the fees, and what the site does.
[soci.md](soci.md) is everything around it, the register, the renewals and the
membership card, which is where a committee member spends their January.

## What was decided, and what it costs

**Satispay only.** No Stripe, no cards. Bank transfer stays. Decided
2026-09-08, reversing D10 of 2026-09-03 (MIGRATION-PLAN.md §5, which carries
the full reasoning on both sides).

| Rail                      | Fee                            |   €10 |   €30 |
| ------------------------- | ------------------------------ | ----: | ----: |
| Satispay Business, direct | free under €10, 0.95% from €10 | €0.10 | €0.29 |
| Bank transfer             | n/a                            | €0.00 | €0.00 |
| _(rejected)_ Stripe       | 1.8% + €0.25 on Satispay       | €0.43 | €0.79 |

Satispay's tariff changed in September 2026: it was a flat 1%, it is now free
under €10 and 0.95% from €10 up. On eighty members that is about **€30 a year**
against Stripe, which is not the reason for the decision but is not nothing
either.

**What the club gives up by dropping Stripe**, stated plainly because it is
real:

- **Cards.** Someone without Satispay pays by bank transfer or does not pay
  online. Keep the IBAN visible everywhere it is visible today.
- **The automatic "paid" tick.** Stripe's webhook would have written it.
  Nothing else in this design can, and the reason is in the next section.

## Why the site asks before it pays

A Satispay consumer payment link takes money and reports nothing back. No
redirect, no metadata, no callback: the server-to-server callback fires **only
for payments created through the API**, which needs RSA-signed requests and
therefore a backend this site deliberately does not have. So the link cannot
tell the club who paid, and once the Satispay app opens, the member does not
come back to a page that could ask.

Hence the order: **ask first, pay second.**

```
member → form on /iscrizioni  (name, email, tier)
       → Netlify Forms → outgoing webhook → the club's spreadsheet, "in attesa"
       → /iscrizioni/grazie → Satispay link → money lands in the club account

treasurer → Satispay report → the rows flip to "pagato" → the card goes out
bonifico  → (by hand)      → same spreadsheet
```

The form is a **payment declaration, not a membership application**. The libro
soci lives elsewhere and this does not duplicate it: three fields, because
three is what the treasurer cannot reconstruct from a bank line. See
`src/components/MembershipForm.astro`.

**The money is the truth, the form is the label.** A member can fill the form
and never pay, or tick Socio and send €10. Whatever Satispay reports is what
the club banked; the form only says whose name to put beside it.

## Steps only a human can do

### 1. Check what the Satispay report actually contains

**Do this first: it decides how much work step 5 saves.** In
[dashboard.satispay.com](https://dashboard.satispay.com) → Transactions →
Request report (.csv/.xls), pull a month that has real payments in it and look
at the columns.

The question is whether a row carries the **payer's name** and the
**`external_code`** already on the club's links (`Sostenitore`, `Socio`, see
`payUrl` in `src/content/pages/iscrizioni.mdx`). If it does, matching a
payment to a form submission is reading two columns. If it carries only
amounts and timestamps, the match is by amount and date, and duplicate €30
payments on the same day have to be told apart by hand.

Nothing else in this runbook changes either way. It is worth knowing before
promising the committee how automatic this is.

### 2. The two payment links already exist

Shop `1746ccbc-eae4-4ad8-90d8-96712d59e356`, with `?amount=1000` and
`?amount=3000` in cents plus `external_code`. They are live on the site today
and there is nothing to create.

If they ever need rebuilding: the Satispay Business app, **Remote payment**,
copy the link. The documented format is
`https://www.satispay.com/app/pay/shops/{id}?amount={cents}`. They are edited
in Keystatic → **Pagine → Iscrizioni** → each tier's **Link di pagamento**, two
fields, no deploy beyond the one Keystatic triggers itself.

### 3. The register, the renewals and the card

All of that is [soci.md](soci.md): the club's spreadsheet, the Apps Script
bound to it, the webhook that carries the website's form into it, and the PDF
card. It is a separate document because it is a separate job, done once, by
somebody who will then run it every January.

**There is no Make.com in it.** The earlier version of this plan had one;
Apps Script receives the webhook, sends the mail and makes the PDF by itself,
so a second service would only have moved data between two Google products.

### 4. Test it, with real money

1. Fill the form on `/iscrizioni` with your own name and the Sostenitore tier.
2. Check the Sheet grew one row, `Stato` = `in attesa`.
3. Pay the €10 link from the page it sent you to.
4. Find that payment in the Satispay report and tick the row to `pagato`.
5. Fill the form **again**. Check the Sheet still has one row for you, updated,
   not two.
6. Refund yourself from the Satispay app. Refunds are asynchronous and take a
   few minutes.

Step 5 is the exit condition for Phase 6.

## The one legal thing

**Do not render the fee as a surcharge.** Article 62 of the Codice del Consumo,
implementing PSD2, forbids charging a consumer a supplement for using a given
payment instrument, and the AGCM has fined companies for exactly that.

Whether a membership quota between an ASD and its socio counts as a consumer
contract is arguable, and nobody here needs to find out. If the committee wants
the payer to carry the fee, the quota is simply set at a figure that already
contains it: **one price, inclusive, on the page and at checkout.** No "+ €0.29
di commissione" anywhere.

## Things that will bite

- **A form submission is not a payment.** It is someone saying they intend to
  pay. The `Stato` column is the difference, and it is the one thing a person
  has to keep honest.
- **A member who submits the form twice gets one row, not two.** The script
  in [soci.md](soci.md) is what makes that true, because a Google Sheet has no
  upsert of its own. If that ever gets rewritten, this is the trap.
- **Netlify Forms only work on a real deploy.** Submitting locally 404s. That
  is expected, not a bug to chase.
- **No member PII in this repository.** It is public, and Keystatic writes to
  it. Names and emails belong in the Sheet and in Netlify's form panel, nowhere
  else.
- **Keep the bank transfer visible.** It is the zero-fee route, the only route
  for a member without Satispay, and the one that still works when a provider
  is between contracts.
- **Satispay disputes** are handled in the Satispay dashboard, not by the club's
  bank.
