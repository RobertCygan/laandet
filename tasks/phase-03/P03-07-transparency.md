# P03-07 — Transparency figures («Åpenhet»)

## GOAL
Anyone can see what Laandet costs to run and what voluntary support it receives — only real figures, entered by the owner.

## CONTEXT
- Master spec §16 item 10. `docs/SUPPORT_AND_FUNDING.md` §4. `docs/OPERATING_COSTS.md` (estimates).

## INPUT
- The table `transparency_months` (migration `0005_trust`). The current `/apenhet` page (empty state).

## OUTPUT
1. **Admin form** (`/admin/apenhet`, admin only): month, total running costs incl. VAT, optional split (server / backup / email / domain / other), voluntary support received after fees (or none), a public note, an internal source note (invoice and payout references). Audited with a reason.
2. **Public page** `/apenhet`: a table per month, newest first, in Norwegian formats (`1 500 kr`), only rows the owner entered. Empty state «Vi publiserer tall når de første fakturaene og eventuelle bidrag er registrert.»
3. A separate, clearly labelled section «Forventede kostnader (estimat)» with the figures from `OPERATING_COSTS.md`, never mixed with actual figures.

## CONSTRAINTS
- No invented or estimated numbers in the actual table. No supporter names. No fundraising link unless a real campaign is configured (unchanged from P01-11).

## TESTS
1. Integration: only admins can enter figures; parts cannot exceed the total (database `CHECK`); the public query never returns the internal source note.
2. E2E: the page shows the empty state, then an entered month.
