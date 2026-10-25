# Laandet — Dispute Resolution Workflow (system design)

**Status:** Designed (Phase 00). Implementation in Phase 03 (task P03-01).

**User-facing text:** [`../legal/nb/retningslinjer-for-tvister.md`](../legal/nb/retningslinjer-for-tvister.md) (authoritative), [`../legal/en/dispute-guidelines.md`](../legal/en/dispute-guidelines.md).

**Data:** `disputes`, `dispute_events`, `dispute_proposals`, `support_access_grants` ([`DATA_MODEL.md`](DATA_MODEL.md)).

## 1. Principles

1. **Facilitate, never adjudicate.** Laandet helps the parties document and agree. It has no legal
   authority to issue binding decisions and never claims it.
2. **No money moves on a complaint.** Laandet holds no funds (D-012), so nothing is "transferred" or "awarded".
   The deposit stays with the party who holds it until the parties agree, or until an external body decides.
3. **Both sides are heard.** The respondent sees the allegation and the evidence that concerns them,
   and can answer and add evidence.
4. **Absence of evidence is not proof of guilt.** Staff recommendations must say which facts are documented
   and which are disputed.
5. **Disputes are private.** They never appear on public profiles, listings or reviews. A pending case is
   called «sak under behandling», never "svindel" or "tyveri".
6. **Proportionate account measures.** Restrictions are a safety tool (for example a non-returned item,
   threats or repeated fraud signals), not a penalty for losing an argument. Every restriction gets a
   statement of reasons and can be appealed.

## 2. Workflow

### Step 1 — Report («Meld fra om et problem»)
- **Available:** on any booking in `handed_over`, `return_pending`, `not_returned`, `completed` (within the deadlines) or `disputed`.
- **Category** (`disputes.category`):

  | Key | nb label |
  |---|---|
  | `damaged` | Gjenstanden ble levert tilbake med skade |
  | `not_returned` | Gjenstanden er ikke levert tilbake |
  | `not_as_described` | Gjenstanden var ikke som beskrevet |
  | `missing_accessories` | Tilbehør mangler |
  | `late_return` | Forsinket tilbakelevering |
  | `payment_disagreement` | Uenighet om betaling |
  | `deposit_disagreement` | Uenighet om depositum |
  | `unsafe_equipment` | Utstyret var utrygt |
  | `other` | Annet |

- **The reporter writes** a short description. The relevant condition report and booking history are attached automatically.
- **The system records** reporter, respondent, booking, category and timestamp, and sets `response_due_at = now + 7 days`.
- **The respondent gets** a neutral notification: «Det er meldt fra om et problem i leieforholdet [nr]. Se saken og svar innen [dato].»
- **Safety first.** For `unsafe_equipment` or an injury, the first screen tells the user to stop using the item and, in emergencies, to call 113 / 112 / 110. It also says that the owner of the item and the platform should be told. Laandet does not provide emergency services.

### Step 2 — Documentation
- **Both parties can add:**
  - statements (text)
  - photos (same pipeline as condition photos)
  - references to the handover/return report
  - references to specific messages in the booking conversation (the reference makes those messages visible in the case to support staff if the case is escalated)
- **No document uploads** (PDF etc.) in the MVP. Receipts or repair quotes are photographed.
- **Entries are append-only** (`dispute_events`), and each has a `visibility`:
  - `parties`: default;
  - `staff_only`: for safety-sensitive information, used only by staff and shown to the parties as «intern merknad».

### Step 3 — Direct resolution (`in_negotiation`)
- **Status change:** the case moves to `in_negotiation` once the respondent answers.
- **Proposals** either party can make (`dispute_proposals.type`):
  - `no_compensation`: Ingen erstatning kreves
  - `repair`: Gjenstanden repareres (who pays and how is described in the text)
  - `replace_accessory`: Manglende tilbehør erstattes
  - `partial_compensation`: Delvis erstatning (amount in kr)
  - `full_compensation`: Full erstatning (amount in kr)
  - `extra_return_time`: Ekstra tid til tilbakelevering (new time)
  - `other`: Annen skriftlig løsning
- **Response:** the other party chooses **Godta** / **Avslå**, or makes a counter-proposal (the old proposal becomes `superseded`). Nobody can accept their own proposal (database `CHECK`).
- **Accepted proposal:**
  - the case becomes `resolved_by_agreement`;
  - the settlement text is stored as an event and shown to both parties as «Avtalt løsning»;
  - payment of any agreed amount happens directly between the parties.
- **Guidance shown in this step:** «Vær saklig og konkret. Beskriv hva som skjedde, legg ved bilder, og foreslå en løsning du synes er rimelig.»

### Step 4 — Platform facilitation (`support_review`)
- **When it is available:**
  - after the respondent has answered and no agreement is reached, or
  - when the 7-day response deadline passes with no answer, or
  - immediately for `not_returned` and `unsafe_equipment`.
- **Escalation:** either party presses **«Be Laandet om hjelp»**. Both parties are told that support will read the case, including the referenced condition reports and messages.
- **Grant:** the assigned moderator gets a `support_access_grant` (reason = dispute id, maximum 30 days, renewable), and every view is audited.
- **The moderator can:**
  - read the case
  - ask either party for more information (case → `awaiting_documentation`, deadline 7 days)
  - write neutral support notes
  - point out inconsistencies
  - write a **non-binding recommendation** (`support_recommendation`) that each party may accept or reject
  - restrict an account when platform safety rules justify it (separate moderation action with a statement of reasons)
- **The moderator cannot:** change evidence, accept on behalf of a party, move money, or publish anything about the case.
- **Target response:** first staff response within 5 working days during the pilot. This is a goal, not a guarantee. The pilot has limited staff, and the texts say so.

### Step 5 — External escalation
- **When the parties do not agree,** support closes the case as `closed_without_agreement` and gives neutral information about relevant options, based on the type of case:

  | Situation | Information given (to be confirmed by legal review, see `LEGAL_REVIEW_CHECKLIST.md`) |
  |---|---|
  | Ordinary contractual disagreement between two private persons (damage, late return, payment) | The parties can bring the claim to **forliksrådet** (conciliation board) in the respondent's municipality. The fee is set by law (1.54 × rettsgebyr, ≈ 2 071 kr in 2026 — **verify the current amount before publishing**). They can also seek legal advice (e.g. free legal aid schemes, legal insurance through home insurance). |
  | Possible theft, fraud or embezzlement (item not returned and no contact, fake identity) | Report to the **police** (politiet.no / 02800). Laandet can, on lawful request from the police, provide the records it holds. |
  | Safety incident / injury | Emergency: 113 / 112 / 110. Product safety concerns can be reported to the relevant authority (to be specified after legal review). |
  | Insurance | The parties' own insurance (home contents or liability insurance) may cover some losses. Laandet has no insurance for users. |

- **Not used: Forbrukertilsynet.** Laandet does **not** refer private-to-private rental disputes to Forbrukertilsynet's mediation or to Forbrukerklageutvalget. According to the research in `LEGAL_REVIEW_CHECKLIST.md` L-09, their private-to-private jurisdiction covers sale of goods, not rental or lending. To be confirmed by legal review.

### Step 6 — Closure

| Status | When |
|---|---|
| `resolved_by_agreement` | a proposal or recommendation was accepted by both |
| `withdrawn` | the reporting party withdraws |
| `closed_without_agreement` | no agreement; external options given |
| `referred_to_insurer` | the parties say the matter goes to an insurer |
| `referred_to_authority` | police report made or safety authority involved (as stated by a party) |
| `awaiting_documentation` | (non-final) waiting for requested information |

- **After closure:** the booking returns to `completed`. The case record stays visible to both parties.
- **Reopening** is possible within 30 days if new information appears (staff decision, audited).

## 3. Deadlines (configurable, `config/deadlines.ts`)

| Key | Default | Meaning |
|---|---|---|
| `problem.visibleDamageHours` | 48 h after return | Recommended time for reporting visible damage or missing accessories |
| `problem.hiddenDefectDays` | 14 days after return | Laandet case deadline for faults not visible at return |
| `deposit.claimNoticeHours` | 48 h after return | Owner must report a concrete claim to keep back part of a deposit (agreement term) |
| `dispute.responseDays` | 7 days | Respondent's time to answer before escalation becomes available |
| `dispute.documentationDays` | 7 days | Time to answer a staff request |
| `dispute.reopenDays` | 30 days | Reopen window after closure |

Every deadline text includes:

> «Fristene gjelder saksbehandlingen i Laandet. De begrenser ikke rettighetene dere har etter norsk lov.»

A case opened after a Laandet deadline is still accepted. It is marked «meldt etter anbefalt frist», which may
weaken the documentation, but the case is not refused for that reason. Only the platform's facilitation
(step 4) may decline late cases older than 3 months.

## 4. Fairness safeguards (implementation checklist)

- [ ] Respondent sees the allegation, all `parties`-visible evidence and every proposal.
- [ ] Each party can respond to every statement; there is no "last word" lock.
- [ ] Staff recommendations use a template that separates «Dette er dokumentert», «Dette er partene uenige om» and «Vår anbefaling (ikke bindende)».
- [ ] Moderation actions linked to a dispute have a statement of reasons and an appeal button.
- [ ] Repeated or retaliatory reports by the same user against the same counterparty are flagged for staff (rate limit plus a pattern check).
- [ ] The dispute is never shown on profiles. Reviews about the booking stay sealed until the dispute closes or the review window ends, whichever comes later.
- [ ] Negative test: a pending case does not appear on any public page, and no profile text says "svindel" or "tyveri".

## 5. Retention

- **How long:** dispute records, evidence and support notes are kept for **3 years after closure** (limitation period), then deleted.
- **When longer:** if a party tells Laandet that legal proceedings are ongoing, the record is kept until they finish, with a documented reason.
- **Grants:** support access grants expire. Expired grants and audit entries follow the audit retention in `PRIVACY.md`.
