# P01-08 — Listings for all three types

## GOAL
Every verified member can create, edit, pause, archive and delete their own listings of the three types: Leies ut,
Ønskes leid and Gis bort. All business rules are enforced on the server. A listing can be published within a few
minutes on a phone.

## CONTEXT
- Master spec §5, §6, §9, §10.
- Decisions: D-011 (value threshold, category B block), D-016, D-020, D-024, D-028.
- Prototype wizard: 5 steps (`CURRENT_STATE_ASSESSMENT.md` §2).
- Database rules: `DATA_MODEL.md` §3–4.

## INPUT
- Tables `listings`, `listing_images`, `listing_unavailability`, `categories`, `localities`, `reports`.
- Upload pipeline P01-09. Authorisation P01-06.

## OUTPUT
1. **Wizard `/ny-annonse`.** The draft is saved on the server after each step («Lagre kladd»). There is no localStorage.

   | Step | Name | Contents |
   |---|---|---|
   | 1 | Hva vil du gjøre? | Leies ut / Ønskes leid / Gis bort; category. Restricted categories show their safety notice. Prohibited categories are not offered. |
   | 2 | Fortell litt mer | title, description, condition; known defects (required for Gis bort); photos (P01-09); accessories (Leies ut) |
   | 3 | Pris og praktisk | See per-type fields below. |
   | 4 | Sted og overlevering | locality, optional area note (with the hint «Ikke skriv adressen din»), handover options: Hentes av leietaker / Kan leveres av eier (fee, radius) / Møtes på avtalt sted (meeting area) |
   | 5 | Forhåndsvisning | preview, plus the restricted-category acknowledgement checkbox where applicable, then Publiser |

   Step 3 fields by type:
   - **Leies ut:** price and unit (time / dag / helg / uke) or «Lån ut gratis» (price 0); declared value with help text «omtrent hva det koster å kjøpe tilsvarende»; deposit (none or an amount ≤ value); usage restrictions; operating instructions.
     - If the category has `allow_paid_rental = false`, only «Lån ut gratis» is offered, with an explanation.
   - **Ønskes leid:** dates from/to, budget (optional), wishes.
   - **Gis bort:** no price field. The text «Gratis – Laandet tar ingen gebyr» is shown.

2. **Value category B** (declared value > 5 000 kr):
   - the wizard explains that rental above 5 000 kr is not open yet;
   - the listing can only be saved as a draft, unless `high_value_preview` is on, in which case it is published as a preview without a request button (labelled «Utleie åpner senere»).
3. **Keyword screening.** An admin-editable list (seeded with the examples in `PROHIBITED_ITEMS.md` §4) checks title and description. A match shows a warning. If the user publishes anyway, an automatic `reports` row is created (`reason = prohibited_item`, reporter null).
4. **`/mine-annonser`.** Lists the user's listings by status, with actions: rediger, sett på pause, gjenoppta, arkiver, slett. Delete is a soft delete and is refused while a booking is active (Phase 02 adds that check; the hook is ready).
5. **Labels.** Every listing shows the «Privatperson» label (L-03). Demo listings carry the «Eksempel» badge and cannot be edited by users.
6. **Rate limits.** New accounts can publish 3 listings per day, established accounts 10 (SEC §2).
7. **Audit.** Publish, pause and delete are written to the audit log.

## CONSTRAINTS
- Zod schemas are shared between client and server. Strict mode; no extra fields accepted.
- The server re-validates everything. The database `CHECK`s are the final guard.
- Money is entered in kr in the UI, converted to øre once at the boundary, and stored as `bigint`. Decimals are rejected.
- No links, emails or phone numbers in titles. In descriptions they show a warning ("del kontaktinfo i meldinger etter avtale").
- Accessible on a 360 px wide screen. Every field has a label and inline error messages in plain Norwegian or English.

## TESTS (acceptance criteria)
1. **Unit:**
   - Zod schemas per type (valid and invalid cases).
   - `classifyValue`: 499 999 / 500 000 / 500 001 øre → A / A / B.
   - Deposit ≤ value.
   - `allow_paid_rental=false` with a price > 0 → error.
   - Restricted category without acknowledgement → error.
2. **Integration (N1):**
   - User A cannot load, edit, pause or delete user B's listing; the response is 404 and the database is unchanged.
   - A forged `ownerId` in the payload is ignored.
3. **Integration (N5 part):**
   - A prohibited category → rejected.
   - A paid listing in `tilhengere` → rejected.
   - A give-away without known defects → rejected.
4. **Integration:** a category B listing cannot reach `published` with the flag off. With the flag on it is published, and its detail page has no request action.
5. **Integration:** a keyword match ("snøscooter") creates an automatic report row.
6. **e2e (mobile):** create one listing of each type, including two photos, in under 15 interactions per listing; it then appears in «Mine annonser» and on the public page.
7. **e2e:** pause → not visible in explore; resume → visible again.
