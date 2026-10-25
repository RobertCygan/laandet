# Laandet — Voluntary Support ("Støtt Laandet") and Transparency Page

**Status:** Designed (Phase 00). Page copy (nb, authoritative): [`../legal/nb/stott-laandet.md`](../legal/nb/stott-laandet.md). Implementation: P01-11 (static page) and P03-07 (transparency figures).

## 1. Policy (from master spec §16, confirmed here)

- Registration, listings and *Gis bort* are free. Platform commission is 0 %. There is no subscription.
- Support is **voluntary** and **never required** for any feature.
  - Negative e2e test: register, publish, request, claim and review without any donation.
- There is **no payment code** in Laandet. Donations happen only on an external fundraising service.
- Fundraising is fully separate from rentals and deposits. No text or UI may mix them.

## 2. Page behaviour

| State | What the page shows |
|---|---|
| `SUPPORT_CAMPAIGN_URL` **not set** (default) | The explanation text, the running-cost overview and the sentence «Vi har ikke startet noen innsamling ennå. Når en innsamling er klar, finner du lenken her.» **No button, no link.** |
| `SUPPORT_CAMPAIGN_URL` set by the owner **after** a real campaign exists | The same text, plus the facts in §3, plus a normal outbound link button «Gå til innsamlingen hos [leverandør]» (opens in a new tab with `rel="noopener noreferrer"`). |

These elements are never shown:
- pop-ups
- nag banners
- countdowns
- progress bars with made-up numbers
- "X people supported" lists
- guilt wording such as "Laandet dør uten deg"

The only entry points are a footer link «Støtt Laandet» and a short line on «Om Laandet».

## 3. Facts the owner must provide before the link is turned on

| Fact | Example / source | Required wording on page |
|---|---|---|
| Who receives the money | the legal entity or person registered as recipient at the fundraising service | «Pengene går til: [navn], org.nr. [nr]» |
| What it covers | server, domain, email service, backups, development | list from §4 |
| Provider and fees | e.g. Spleis (SpareBank 1). Published fee for organisations and businesses: 6.5 % of the amount (4.5 % platform + 2 % transaction) as researched on 25.10.2026. **Verify on spleis.no before publishing.** | «[Leverandør] trekker [x] % i gebyr. Resten utbetales til [mottaker].» |
| Tax status | Laandet/G-PSI.ai is **not** an approved organisation for tax-deductible gifts unless proven | «Gaver til Laandet gir ikke skattefradrag.» (unless verified otherwise) |
| Charitable status | not a registered charity unless proven | do not use words like «veldedig» or «ideell organisasjon» unless verified |
| Can an AS be the Spleis recipient? | unclear (research, `LEGAL_REVIEW_CHECKLIST.md` L-14) | confirm with Spleis before creating the campaign |

The admin panel shows a checklist of these facts. `SUPPORT_CAMPAIGN_URL` is an environment variable, so turning
the link on is a deliberate deploy by the owner.

## 4. Transparency page («Åpenhet», `/apenhet`)

- **Content:** a simple table per month, using **real, verified figures only**.

  | Month | Running costs (kr, incl. VAT) | Of which: server / backup / email / domain / other | Voluntary support received (kr, after fees) | Note |
  |---|---|---|---|---|

- **Where the figures come from:**
  - Cost figures come from invoices.
  - Support figures come from the fundraising service's payout statement.
  - The owner enters them (admin form in Phase 03, or a Markdown table in the repository before that).
- **Empty state:** «Vi publiserer tall når de første fakturaene og eventuelle bidrag er registrert.» No estimates are shown as actual costs.
- **Estimates:** they may appear only in a separate, clearly labelled section «Forventede kostnader (estimat)», with numbers taken from `OPERATING_COSTS.md`.

## 5. Future business options (designed only; NOT active)

From master spec §16. None of these are built or shown in the MVP:
- professional accounts
- sponsored local business listings
- labelled promoted listings
- commissions
- premium tools

Each one needs:
- an owner decision;
- an update to the terms;
- a decision on trader rules (business users bring consumer-law duties; see `LEGAL_REVIEW_CHECKLIST.md`);
- for anything involving money flows, an authorised payment provider (D-012).
