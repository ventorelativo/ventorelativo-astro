# Membership payments

Phase 6. What a member pays, how it reaches the club's bank account, and how it
stops being reconciled by hand.

**None of this is code.** The Astro site's whole part in it is two URLs in
Keystatic. Everything else is account setup in Stripe, Make.com and a Google
Sheet, which is why it is written down here rather than built, and why the
steps are in the order that avoids doing any of them twice.

## What was decided, and what it costs

**Stripe Payment Links, with Satispay enabled as a payment method inside them.**
Bank transfer stays. Decided 2026-09-03 (MIGRATION-PLAN.md §5, D10); the
committee accepted the fee and the payer carries it.

| Rail                      | Fee                            |   €10 |   €30 |
| ------------------------- | ------------------------------ | ----: | ----: |
| Satispay Business, direct | free under €10, 0.95% from €10 | €0.10 | €0.29 |
| Stripe: EEA consumer card | 1.5% + €0.25                   | €0.40 | €0.70 |
| Stripe: Satispay          | 1.8% + €0.25                   | €0.43 | €0.79 |
| Bank transfer             | n/a                            | €0.00 | €0.00 |

Satispay direct is three to four times cheaper and was rejected anyway, because
on a club this size the difference is about **€30 a year** and it cannot be
automated without a backend: Satispay's callback fires only for payments created
through its API, never for the consumer link the club uses today. This site has
almost no server on purpose. A Payment Link is a URL and its webhook is a
checkbox.

Members who want to pay with Satispay still do: inside Stripe's checkout.

## The shape of it

```
member → Stripe Payment Link (card or Satispay) → checkout.session.completed
       → Make.com → Google Sheet row (updated if the member already has one)
       → back to /iscrizioni/grazie

bonifico → (by hand) → same Sheet
```

## Steps only a human can do

### 1. A Stripe account for the association

Register as the ASD, not as a person: legal name **Associazione Sportiva Vento
Relativo**, its codice fiscale / P.IVA, and the club's IBAN for payouts. Stripe
asks for a representative: that is a named person, and it is not the same thing
as the account holder.

Set the **public details** (Settings → Public details) before creating any link:
they become the business name on the checkout page, the receipt and the bank
statement. A member who sees an unfamiliar name on their statement asks the
committee about it.

### 2. Turn on Satispay

Dashboard → **Settings → Payment methods** → enable **Satispay**. Nothing else is
needed: Payment Links show whichever methods the account has enabled and the
payer's country supports.

Cards are on by default. Leave them on: Satispay is the common case here, but
not everyone has it.

### 3. Create two Payment Links

Dashboard → **Payment links → Create**. One per tier, matching the tiers in
`src/content/pages/iscrizioni.mdx`:

| Tier        | Amount | Product name               |
| ----------- | -----: | -------------------------- |
| Sostenitore |    €10 | `Quota Sostenitore <year>` |
| Socio       |    €30 | `Quota Socio <year>`       |

Put the year in the product name. The Sheet will hold rows for several years and
"Quota Socio" alone will not tell them apart.

For each link, under **Options**:

- **Collect customers' names** → individual name, required. Use this, not a
  custom field: Stripe's own guidance is not to collect personal data through
  custom fields, and the name has a proper home in the session object.
- Leave the email alone: Stripe always collects it, and it is the key the Sheet
  is matched on.
- **After payment** → **Redirect customers to your website** →
  `https://ventorelativo.it/iscrizioni/grazie` (that page exists and is
  `noindex`). Before the domain moves, use the `*.netlify.app` address and
  remember to change it at cutover.
- Do **not** enable "let customers adjust quantity". A membership is one.

Do **not** add a fee line, a surcharge, or a second amount. See "The one legal
thing" below.

### 4. A Google Sheet with a fixed header row

One sheet, one row per member per year. Suggested columns, in this order:

```
Data | Nome | Email | Tier | Importo | Rail | Stripe ID | Note
```

`Rail` is `stripe` or `bonifico`, so a hand-entered transfer looks the same as an
automated row. `Stripe ID` is the checkout session id: it is what lets anyone
find the payment again in the dashboard.

Share it with **named committee accounts only**. Never "anyone with the link":
it holds names and email addresses.

### 5. The Make.com scenario

Three modules, and a router:

1. **Stripe → Watch Events**, event `checkout.session.completed`. Not
   `payment_intent.succeeded`: that one fires per attempt and carries none of the
   checkout's collected fields.
2. **Google Sheets → Search Rows**, filtering `Email` equals the session's
   `customer_details.email`.
3. **Router**, with two routes:
   - rows found → **Update a Row** on the one that came back;
   - nothing found → **Add a Row**.

**A Google Sheet has no upsert.** Without that branch, a member who renews gets a
second row, quietly, and the club discovers it at the next assembly. This is the
one part of the scenario worth testing twice.

### 6. Point the site at the links

In Keystatic → **Pagine → Iscrizioni**, replace each tier's **Link di pagamento**
with its Stripe URL. Two fields, no deploy needed beyond the usual one Keystatic
triggers itself.

While you are there, the page's body still says the payment goes through
Satispay. It still can, but it is no longer the only way, and the copy should
say so.

### 7. Test it, with real money

Stripe's test mode has its own links, and a test link is not the live one. So the
real test is a real payment:

1. Pay the €10 Sostenitore link yourself.
2. Check the Sheet grew exactly one row, with your name, email and the session id.
3. Pay it **again**. Check the Sheet still has one row for you, updated, not two.
4. Refund both from the Stripe dashboard. Satispay refunds are asynchronous and
   take up to five minutes; the window is 180 days.

That third step is the exit condition for Phase 6.

## The one legal thing

**Do not render the fee as a surcharge.** Article 62 of the Codice del Consumo,
implementing PSD2, forbids charging a consumer a supplement for using a given
payment instrument, and the AGCM has fined companies for exactly that. Stripe's
own automatic-surcharge feature is US-only and warns about jurisdiction.

Whether a membership quota between an ASD and its socio counts as a consumer
contract is arguable, and nobody here needs to find out. If the committee wants
the payer to carry the fee, the quota is simply set at a figure that already
contains it: **one price, inclusive, on the page and at checkout.** No "+ €0.70
di commissione" anywhere.

## Things that will bite

- **A test link is not a live link.** They are different URLs and a test one
  takes no money while looking like it worked.
- **The Sheet has no upsert.** See step 5.
- **The redirect URL is written into each Payment Link**, not read from the site.
  When the domain moves at cutover, both links need editing.
- **No member PII in this repository.** It is public, and Keystatic writes to it.
  Names and emails belong in the Sheet and nowhere else.
- **Disputes exist on Satispay too**: 120 days, handled through Stripe like a
  card dispute.
- **Keep the bank transfer visible.** It is the zero-fee route and the one that
  still works when a provider is between contracts.
