# P02-03 — Giveaway claims and transfer confirmation

## GOAL
People can say «Jeg vil gjerne ha den» on a «Gis bort» listing. The giver picks one person. After the handover,
both confirm a short transfer confirmation, and the listing becomes «Gitt bort».

## CONTEXT
- DATA_MODEL §6. RENTAL_AGREEMENTS §7. Template `legal/nb/gis-bort-overleveringsbekreftelse.md`.

## INPUT
- «Gis bort» listings (P01-08), conversations (P02-01), the contracts module (P02-04).

## OUTPUT
1. **Claim:**
   - on the listing page, with an optional message and a choice of handover method from the listing's options;
   - one claim per person per listing;
   - limits are shared with rental requests.
2. **The giver's view** (`/annonse/[id]` for the owner, and the thread): all claims, with **«Velg»** and **«Avslå»**.
3. **Select:**
   - claim `selected`, listing `reserved`;
   - the others are told «ikke valgt nå», and their claims stay open;
   - selecting renders the transfer confirmation (a contract of kind `giveaway_transfer`, revision 1).
4. **Confirm:**
   - each party confirms the rendered text (hash-bound) after the handover;
   - when both have confirmed: claim `transferred`, listing `given_away`, other open claims `expired`.
5. **Cancel:** a selected claim can be cancelled by either party, and the listing goes back to `published`.
6. **Expiry:** claims not answered within 14 days expire (worker).

## CONSTRAINTS
- At most one selected or transferred claim per listing (unique index).
- The giver cannot claim their own listing. Blocked users cannot claim.
- No deposit and no price, ever.

## TESTS
1. Integration:
   - selecting a second claim while one is selected fails;
   - a non-party cannot confirm (trigger + service);
   - both confirmations → `given_away`, and the other claims expire.
2. e2e: claim → select → both confirm → the listing shows «Gitt bort».
