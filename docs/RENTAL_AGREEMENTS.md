# Laandet — Rental Agreements and Transfer Confirmations (system design)

**Status:**
- Designed (Phase 00).
- The templates are **drafts that have not been legally reviewed** (`0.1.0-utkast`).
- Implementation: Phase 02 (task P02-04).

**Templates (authoritative Norwegian):**
- [`../legal/nb/forenklet-leieavtale.md`](../legal/nb/forenklet-leieavtale.md): Agreement A, declared value ≤ 5 000 kr
- [`../legal/nb/utvidet-leieavtale.md`](../legal/nb/utvidet-leieavtale.md): Agreement B, declared value > 5 000 kr (**blocked in the MVP**)
- [`../legal/nb/gis-bort-overleveringsbekreftelse.md`](../legal/nb/gis-bort-overleveringsbekreftelse.md): giveaway transfer confirmation

English informational translations are in [`../legal/en/`](../legal/en/).

> These templates are first drafts produced with AI assistance. They are **not** legally approved and
> do not guarantee compliance. A qualified Norwegian lawyer must review them before any public
> contractual use. See [`LEGAL_REVIEW_CHECKLIST.md`](LEGAL_REVIEW_CHECKLIST.md).

## 1. Which document applies

```ts
// modules/contracts/select.ts (pure, unit-tested)
function selectContractKind(listing): 'rental_simple' | 'rental_extended' | 'giveaway_transfer' {
  if (listing.type === 'give_away') return 'giveaway_transfer';
  if (listing.type !== 'rent_out') throw new Error('no contract for wanted listings');
  return listing.declaredValueOre <= 500_000n ? 'rental_simple' : 'rental_extended';
}
```

| Declared item value | Agreement | MVP |
|---|---|---|
| ≤ 5 000 kr (≤ 500 000 øre) | **A — Forenklet leieavtale** (deposit optional) | ✅ |
| > 5 000 kr | **B — Utvidet leieavtale** (deposit mandatory, strong ID, detailed reports) | ⛔ blocked until BankID, the reviewed deposit procedure and the flag `extended_agreements` are all in place (D-011) |
| Gis bort | **Overleveringsbekreftelse** (no rental agreement) | ✅ |

- **The threshold** is Laandet's internal policy, not a statutory limit. The declared value is the owner's own statement of the item's approximate replacement value.
- **Free lending:** "Leies ut" with price 0 kr ("Lånes ut gratis") uses the same agreement. The price line reads «0 kr (gratis utlån)».

## 2. Contract terms object (snapshot)

The template is filled **only** from this typed object. It is built on the server from the booking
and listing snapshot. Free text fields are escaped and inserted as plain text.

```ts
type ContractTerms = {
  agreementNumber: string;              // LA-2026-000123 (rental) / GB-2026-000045 (giveaway)
  templateKey: 'rental_simple' | 'rental_extended' | 'giveaway_transfer';
  templateVersion: string;              // e.g. '0.1.0-utkast'
  revision: number;                     // 1, 2, … (new revision after a material change)
  owner:  { userId: string; displayName: string; platformId: string };   // platformId = short public id
  renter: { userId: string; displayName: string; platformId: string };
  item: { title: string; description: string; categoryLabel: string;
          identifier?: string; condition: string; knownDefects?: string };
  declaredValueOre: bigint;
  price: { amountOre: bigint; unit: 'hour'|'day'|'weekend'|'week'; units: number; totalOre: bigint };
  period: { start: string; end: string };          // ISO, shown as 14.12.2026 kl. 10:00
  handover: { method: 'pickup'|'owner_delivery'|'meet'; deliveryFeeOre?: bigint; placeNote?: string };
  return:   { method: 'pickup'|'owner_delivery'|'meet'; placeNote?: string };
  accessories: string[];
  deposit: { required: boolean; amountOre: bigint; paymentNote: string };  // agreed off-platform
  permittedUse: string;                 // from listing.usage_restrictions + category safety notice
  operatingInstructions?: string;
  safetyNotice?: string;                // restricted categories
  paymentNote: string;                  // always includes the off-platform warning
  deadlines: { visibleDamageHours: number; hiddenDefectDays: number; returnConfirmHours: number;
               depositClaimHours: number };
};
```

**Template view model.** Templates do not receive `ContractTerms` directly. They receive a `ContractView`:
- It is derived by a pure function `toContractView(terms, locale)`.
- Every value is already formatted: `price.total = "1 500 kr"`, `period.start = "14.12.2026 kl. 10:00"`, `handover.summary = "Hentes av leietaker"`, `deposit.summary`, `price.isFree`, `price.unitLabel`.
- The field names are exactly those used in `legal/nb/*.md` and `legal/en/*.md`.

**Rendering.**
- A logic-less Mustache renderer is used.
- HTML escaping is replaced by Markdown escaping of every value, so user text cannot inject Markdown or HTML.
- The extended agreement includes the simplified agreement's clauses 1–17 through a partial. The partial is per locale: `forenklet-leieavtale-kjerne` (nb) and `simplified-rental-agreement-core` (en).
- A unit test asserts that every tag in every template exists in `ContractView`.

Exact meeting addresses (`meeting_place_private`) are **not** part of the agreement text. The agreement
says "avtalt sted, se meldinger i Laandet". This keeps addresses out of documents that may be shared
during a dispute.

## 3. Lifecycle

1. **Owner accepts the request.** The server:
   1. creates `contracts` revision 1 with `status = pending_acceptance`;
   2. renders the Markdown template with the terms;
   3. stores `rendered_text` and its SHA-256 hash;
   4. sets `agreement_due_at = min(now + 48 h, period start)`.
2. **Each party opens the agreement.** The page shows:
   - **«Kort fortalt»:** a plain-language summary box with price, dates, deposit, handover, the return-condition rule and the payment warning;
   - the full text, expandable;
   - the button **«Jeg godtar avtalen»**.

   The client sends the hash it displayed. The server checks it is the current contract's hash, the actor's party role, and the deadline, then inserts `contract_acceptances`. A database trigger re-checks hash and party.
3. **Both accepted.** The contract becomes `accepted` and the booking `confirmed`. Both get a notification. The agreement stays readable in *Mine leieforhold* (both parties can save a PDF copy using the browser's print function).
4. **Material change** before handover (dates, price, deposit, handover/return method, accessories, permitted use):
   1. The current contract becomes `superseded`.
   2. Revision n+1 is created.
   3. All acceptances must be given again, and the booking goes back to `accepted`.
   4. The diff is shown to both parties.

   Non-material changes (meeting time within the same day, a message about the meeting point) happen in messages and do not change the agreement.
5. **No changes after handover.** Extending the rental after handover is a new mini-agreement. In the MVP: either a dispute proposal `extra_return_time`, or the parties agree in messages and the return entry notes it. Phase 03 may add «Forleng leieperioden» as a contract revision.

## 4. Deposit handling (MVP: recorded, never held)

- **Who sets it.** The owner sets `deposit_ore` (0 = no deposit) in the listing. It is shown on the listing and in the request, so the renter knows it **before** sending the request and before accepting.
- **Limits.** Deposit ≤ declared value (database `CHECK`). Agreement B (later) requires a deposit > 0.
- **How it is paid.** The parties settle the deposit directly (cash, Vipps, bank transfer). The agreement records the amount and the note «Depositumet betales direkte mellom partene. Laandet tar ikke imot, oppbevarer eller betaler ut penger.»
- **Return rule written in the agreement:**
  - The deposit is returned when the item is returned, unless the owner, before or at the latest **48 hours after the return**, reports a concrete claim through «Meld fra om et problem».
  - The owner may then keep back **at most the amount of the documented claim** until the case is resolved. Everything else must be returned without undue delay.
  - Disagreement over the kept amount is handled through the dispute process. Laandet only facilitates; it does not decide.
- **No platform action on money.** There is no button or endpoint that "releases" or "deducts" a deposit. Users record facts: «Depositum tilbakebetalt» is a confirmation by the owner, and the renter can contest it.
- **Required wording.** The UI and the agreements say: «Depositum er ikke en forsikring og dekker ikke nødvendigvis alt et eventuelt tap.»

## 5. Payment warning (shown before acceptance)

> **Betaling skjer direkte mellom dere.** Laandet håndterer ikke penger og sender aldri betalingslenker.
> Betalinger og depositum utenfor Laandet har ingen beskyttelse fra Laandet. Betal aldri via lenker du
> får i meldinger, og del aldri BankID-koder.

## 6. Versioning and storage

| Item | Stored where |
|---|---|
| Template text and version | `legal_document_versions` (`doc_key = rental_simple` / `rental_extended` / `giveaway_transfer`, `nb`; loaded from `legal/nb/*.md` at deploy) |
| Exact accepted text | `contracts.rendered_text` + `rendered_sha256` |
| Parties | `contracts.terms.owner/renter` + `contract_acceptances.user_id` |
| Acceptance time | `contract_acceptances.accepted_at` |
| Item and reservation ids | `contracts.booking_id` → `bookings.listing_id` |
| Handover and return records | `condition_reports` linked by `booking_id` |

- **Template changes.** A change to a template creates a new version. Contracts created earlier keep their own rendered text, and existing agreements are **never** changed silently.
- **Language.** The rendered agreement is always Norwegian, because it is the authoritative text. English-language users also see an English informational rendering with the banner «Den norske teksten gjelder».

## 7. Giveaway transfer confirmation

1. The giver selects a claim.
2. Both parties see the **Overleveringsbekreftelse**, rendered from: item, condition, known defects, handover method, the free-of-charge statement, and "as is".
3. Each party confirms after the physical handover, binding to the hash (same mechanism as above).
4. Claim → `transferred`, listing → `given_away`.

There is no rental agreement and no deposit, and the recipient is not forced to sign anything else.

## 8. Unit tests required (P02-04)

| # | Test |
|---|---|
| 1 | Contract kind selection at the boundary: 499 999 / 500 000 / 500 001 øre, give_away, wanted |
| 2 | Rendering is deterministic: same terms produce the same hash |
| 3 | Free text containing `<script>` or Markdown injection is escaped, and the rendered output contains no HTML |
| 4 | Material-change detection: each material field triggers a new revision, non-material fields do not |
| 5 | Acceptance with a stale hash, by a non-party, or after the deadline is rejected |
| 6 | Deposit > declared value is rejected. Category B is rejected while the flag is off. |
| 7 | Money formatting: `150000n` øre → `1 500 kr` |
