# Laandet — Condition Report System (handover and return)

**Status:** Designed (Phase 00). Implementation in Phase 02 (task P02-05).

**Data model:** `condition_reports`, `condition_entries`, `condition_photos`, `condition_confirmations`
(see [`DATA_MODEL.md`](DATA_MODEL.md)).

**User-facing names:**
- *Tilstand ved utlevering* (handover)
- *Tilstand ved tilbakelevering* (return)

## 1. Goals

1. Both parties have the same written and photographic record of the item's condition at
   handover and at return.
2. Each party can record **their own** observations. No one can change the other party's observations,
   or delete their own once saved.
3. The record shows honestly whether the parties **agree**, **disagree**, or whether **one party did not respond**.
4. Recording takes about 2 minutes on a phone at the handover place.
5. The central rule is shown at the moment it matters:
   > «Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av normal slitasje som følge av avtalt og forsvarlig bruk.»

## 2. Structure

```
condition_report (one per booking per phase: handover | return)
 ├─ entries (append-only, ordered by seq)
 │    ├─ #1 owner   – condition, functional status, existing damage, accessories, photos …
 │    ├─ #2 renter  – remarks ("ripe på venstre side som ikke er nevnt")
 │    └─ #3 owner   – supersedes #1 (adds the scratch) ← correction, #1 stays visible in history
 └─ confirmations (append-only)
      ├─ renter: confirm, checklist {...}, latest_entry_seq = 3
      └─ owner:  confirm, checklist {...}, latest_entry_seq = 3
```

- **A confirmation counts only if `latest_entry_seq` equals the current highest entry.** A new entry
  automatically invalidates earlier confirmations. Both parties then confirm again; the UI says so plainly.
- **Corrections** are new entries with `supersedes_entry_id`, pointing only to the author's **own** earlier entry.
  The UI shows the current view and a "Vis historikk" link with every version and timestamp.
- **Photos** are linked to the entry that uploaded them, re-encoded and stripped of metadata, with their hash stored.
  Photos can never be removed from a submitted entry.

## 3. Fields

| Field | Handover | Return | Category A | Category B (Phase 05) |
|---|---|---|---|---|
| Item name + identifier (serial number / distinctive marks) | ✓ | — | optional | **required** |
| Overall condition (`new`…`defective`) | ✓ | ✓ | required | required |
| Functional status (`works`, `works_with_remarks`, `not_working`, `not_tested`) | ✓ | ✓ | required | required + functional test description |
| Existing damage (text) | ✓ | — | optional ("Ingen kjente skader" default) | required |
| New damage since handover (text) | — | ✓ | required if any | required |
| Accessories checklist (from agreement) | ✓ | ✓ | required | required |
| Fuel / battery level | ✓ | ✓ | optional | optional |
| Cleanliness | ✓ | ✓ | optional | required |
| Photos | ✓ | ✓ | optional (strongly encouraged) | **min. 3 required** at handover and at return, unless an exception is documented |
| Notes | ✓ | ✓ | optional | optional |
| Actual return time | — | ✓ | auto (time of first return entry), editable once by the author | same |

## 4. Handover flow (`booking.status = confirmed`)

1. **Before the meeting:** the owner may prepare the handover entry from 48 h before the start:
   condition, defects, photos, accessories, instructions given. It is prefilled from the listing.
2. **At the meeting:** the renter opens *Tilstand ved utlevering*, inspects the item and either:
   - **adds remarks** (new entry), or
   - **contests** ("Jeg er ikke enig i beskrivelsen"), with a comment, or
   - **confirms** with the handover checklist:
     - ☐ Riktig gjenstand er overlevert
     - ☐ Tilstanden er beskrevet riktig
     - ☐ Avtalt tilbehør er med
     - ☐ Jeg har fått nødvendig bruksanvisning
     - ☐ Overleveringen skjedde slik vi avtalte (henting / levering / møtested)
3. The owner confirms the same checklist (it can be done before the renter).
4. **When both have confirmed on the latest entry:**
   - report status becomes `agreed`;
   - booking becomes `handed_over`;
   - both receive a copy (in-app; the email has a link only).
5. **If the renter contests:**
   - the booking stays `confirmed`;
   - the owner can add a correcting entry, or either party can cancel (no fee in the MVP).
   - The renter is told: «Ikke ta med deg gjenstanden før dere er enige om beskrivelsen, eller skriv tydelig hva du er uenig i.»
6. **If one party does not react:**
   - **Category A:** 24 h after the agreed start, the worker moves the booking to `handed_over` and sets
     the report status to `lapsed`. The report is marked in the UI as **«Bekreftet av én part — [navn] har ikke bekreftet»**.
     It is never shown as joint agreement.
   - **Category B:** no lapse. Both parties must confirm.

## 5. Return flow (`booking.status = handed_over` or `not_returned`)

1. **Recording the return.** Either party records the return entry:
   - actual return time
   - condition
   - functional status
   - new damage
   - accessories present or missing
   - photos

   Booking → `return_pending`.
2. **The other party responds within 72 h** by adding their own entry, confirming, or contesting.
3. **Outcome.** The *first author* proposes the outcome; the confirmation by the other party makes it joint.

   | Outcome (`return_outcome`) | UI label (nb) | Meaning |
   |---|---|---|
   | `returned_ok` | Tilbakelevert uten merknader | No remarks |
   | `returned_normal_wear` | Tilbakelevert med normal slitasje | Changes that follow from agreed, proper use |
   | `returned_with_deviation` | Tilbakelevert med registrert avvik | New damage, missing accessory, needs cleaning, late return, … |
   | `return_disputed` | Tilbakelevering bestridt | The parties disagree about the condition or about what caused it |
   | `not_returned` | Ikke tilbakelevert | The owner has marked the item not returned (from 24 h after the end) |

4. **Rules:**
   - Both confirm `returned_ok` or `returned_normal_wear` → booking `completed`. The deposit should be returned now; the UI reminds the owner.
   - `returned_with_deviation`:
     - Both confirm the *description*. This is not an admission of liability, and the UI says so: «Å bekrefte beskrivelsen betyr ikke at du godtar å betale noe.»
     - The booking becomes `completed`, and either party can open a case («Meld fra om et problem») within the deadlines below.
   - A party **contests** → outcome `return_disputed`, booking `disputed`, and a dispute case is opened automatically with the report attached.
   - **No response within 72 h** → booking `completed`. The report is `lapsed`, shown as **«Bekreftet av én part»**, and the silent party's right to raise a problem is unchanged.
5. **The owner cannot record "normal wear" for the renter, or the other way round.** Each party's
   classification is their own entry. Agreement exists only when both confirmed the same latest entry.

## 6. Explaining damage categories (shown as help text in the return form)

| Term (nb) | Explanation shown to users |
|---|---|
| Eksisterende skade | Damage recorded at handover, or shown in the listing photos. The renter is not responsible for it. |
| Normal slitasje | Small, expected changes from agreed and proper use: some dirt on wheels, light marks on a blade, normal battery wear. The renter is not responsible for normal wear. |
| Uforsvarlig eller ikke avtalt bruk | Use against the agreement, the instructions or common sense (for example overloading a trailer). The renter can be responsible for the damage this causes. |
| Uhell | Accidental damage. Responsibility depends on the circumstances and on Norwegian law. It is not automatic. |
| Alvorlig skade | The item no longer works or is unsafe. Stop using it, tell the owner right away, and document it. |
| Manglende tilbehør | Accessories listed in the agreement that were not returned. |
| Forsinket tilbakelevering | Returned after the agreed time without an agreed extension. |
| Ikke tilbakelevert | Not returned and no contact. See *Retningslinjer for tvister* and contact the police in case of theft. |

The platform **never decides** which category applies. It records what each party says.

## 7. Deadlines (configurable in `config/deadlines.ts`)

| Key | Default | Purpose |
|---|---|---|
| `handover.prepareFromHours` | 48 h before start | When the owner can start the handover entry |
| `handover.lapseAfterStartHours` | 24 h (category A only) | One-party confirmation is recorded as `lapsed` |
| `return.confirmWithinHours` | 72 h | Time for the other party to respond to the return entry |
| `return.notReturnedAfterHours` | 24 h after the end of the period | Owner may mark "Ikke tilbakelevert" (after an automatic reminder to the renter) |
| `problem.visibleDamageHours` | 48 h after return | Recommended deadline for reporting **visible** damage or missing accessories via Laandet |
| `problem.hiddenDefectDays` | 14 days after return | Laandet case deadline for faults that could not be seen at return |

These deadlines only control **when a case can be opened on Laandet**. They do not remove rights under Norwegian
law. The texts say so:

> «Fristene gjelder saksbehandlingen i Laandet. De begrenser ikke rettighetene dere har etter norsk lov.»

## 8. Privacy and retention

- **Who can see condition reports and photos:** only the two booking parties, plus staff with an active
  dispute grant (audited).
- **Retention:** 3 years after the booking ends (the general Norwegian limitation period), then deleted by
  the retention job. Longer only if a dispute or legal claim is still open. See `PRIVACY.md`.

## 9. Acceptance criteria (Phase 02)

1. Owner and renter can each add entries and photos. Neither can change or delete an entry once saved. Corrections create a new entry and history shows all versions.
2. A new entry invalidates earlier confirmations, and the UI shows who still needs to confirm.
3. Handover requires both confirmations, or a category A lapse that is labelled «Bekreftet av én part».
4. A contested return opens a dispute with the report attached.
5. User C cannot read the report or photos (404). Staff can only with a dispute grant, and the view is audited.
6. EXIF and GPS are absent from stored photos.
7. The flow works one-handed on a 360 px wide phone: large buttons and the camera opens directly (`capture="environment"`).
