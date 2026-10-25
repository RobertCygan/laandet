# Laandet — Privacy by Design (internal)

**Status:**
- Designed (Phase 00). This is the internal record. The public notice is
  [`../legal/nb/personvernerklaering.md`](../legal/nb/personvernerklaering.md).
- All legal bases and retention periods are **proposals for legal review**.

**Data controller:** G-PSI.ai. The exact legal entity name, organisation number, address and contact email are **MÅ FYLLES UT FØR LANSERING**.

## 1. Principles applied

1. **Minimisation.**
   - No fødselsnummer, no date of birth, no phone number required, no exact address, no real-name requirement.
   - The display name can be a first name plus an initial.
2. **Location.** Only a locality (for example "Nordfold") plus an optional 80-character area note in public. Exact meeting places are shared only inside a confirmed booking.
3. **No tracking.** No analytics, advertising or fingerprinting, and only strictly necessary cookies (§7).
4. **Private by default.**
   - Messages, condition reports and disputes are visible only to the parties.
   - Staff access needs a reason, is time-boxed and is audited.
5. **Retention.** Each data category has an end date, enforced by the worker (§5).
6. **Image metadata.** Photos are stripped of EXIF/GPS on upload.

## 2. Record of processing activities (GDPR art. 30 — draft)

| # | Activity | Data | Data subjects | Purpose | Legal basis (proposed) | Recipients |
|---|---|---|---|---|---|---|
| P1 | Account and sign-in | email, password hash, display name, email-verified flag, sessions (IP, user agent), 2FA secret (staff), sign-up self-declarations (18+, private use) | users | provide account, security | Art. 6(1)(b) contract; security logging 6(1)(f) | hosting, email provider |
| P2 | Profile | display name, locality, bio, join date, real statistics, verification level | users, visitors | trust between users | 6(1)(b) | public (limited fields) |
| P3 | Listings and photos | listing content, photos (may show people or houses), locality, area note | users | marketplace | 6(1)(b) | public when published |
| P4 | Messaging | message text, timestamps | users | contact between parties | 6(1)(b) | other participant; staff only via report/dispute |
| P5 | Rentals and giveaways | booking terms, agreement text and acceptances, condition reports and photos, meeting place, booking history | owners, renters, givers, recipients | conclude and document agreements | 6(1)(b); retention for legal claims 6(1)(f) + art. 17(3)(e) | the two parties; staff in disputes |
| P6 | Disputes and support | statements, evidence photos, proposals, support notes | parties | facilitate resolution, platform safety | 6(1)(f) (and 6(1)(b) as a service described in the terms) | parties, assigned staff |
| P7 | Reviews | ratings, comment, booking reference | parties | trust | 6(1)(b) / 6(1)(f) | public after publication |
| P8 | Reporting and moderation | reports, attached messages, moderation decisions, statements of reasons, appeals | reporters, reported users | safe platform, notice-and-action | 6(1)(f); 6(1)(c) where a legal duty applies | staff; affected user receives the statement of reasons |
| P9 | Notifications and email | email address, notification type and link | users | service communication | 6(1)(b) | email provider |
| P10 | Security and audit logs | user id, action, HMAC-hashed IP, request id | users, staff | security, accountability | 6(1)(f), art. 32 | admin only |
| P11 | Error monitoring (optional) | pseudonymous user id, technical error data, no request bodies | users | stability | 6(1)(f) | Sentry (EU region) |
| P12 | Backups | copies of the above | all | durability | same as source | backup storage provider (EU), client-side encrypted |
| P13 | Contact and complaints by email | email, message | anyone | answer inquiries | 6(1)(f) | email host |

**Special categories (art. 9):** not intended. Users are told not to share health or other
sensitive data. Injury-related dispute statements may contain health data. Staff are told to keep only
what is necessary, and the topic is flagged for legal review (L-12).

**Children:** the service is for persons 18+. There are no child-directed features.

## 3. Processors and transfers (to be confirmed by contracts)

| Service | Candidate (not purchased) | Location | Agreement needed | Transfer outside EEA |
|---|---|---|---|---|
| Server, database, media | Hetzner Online GmbH or another EU VPS provider | Finland / Germany | DPA (provider's standard) | no |
| Off-site backup | Hetzner Storage Box / Object Storage, or other EU storage | EU | DPA | no (data encrypted before upload) |
| Transactional email | Scaleway SAS (TEM) or Brevo (Sendinblue SAS) | France / EU | DPA | verify sub-processors |
| Error monitoring (optional) | Sentry (Functional Software Inc.), EU data region | Germany (data); US company | DPA + SCCs / EU-US DPF | possible support access → assess |
| Uptime monitor (optional) | UptimeRobot | — | none (no personal data) | — |
| CAPTCHA (only if enabled) | Cloudflare Turnstile | global; US company | DPA + SCCs/DPF | yes → assess before enabling |
| Code hosting | GitHub | US | no production personal data in the repository | — |

## 4. DPIA screening (EDPB criteria)

| Criterion | Applies? | Note |
|---|---|---|
| Evaluation or scoring | partly | user reviews (ratings by other users, not automated profiling) |
| Automated decisions with legal or similar effect | no | all moderation decisions by humans |
| Systematic monitoring | no | |
| Sensitive or highly personal data | partly | private messages; dispute evidence; possible incidental health data |
| Large scale | no | local pilot |
| Matching or combining datasets | no | |
| Vulnerable data subjects | no | adults only (self-declared) |
| Innovative technology | no | |
| Prevents exercising a right or using a service | partly | account restrictions (with appeal) |

**Result:** 1–3 criteria apply, each only partly. A DPIA is **not clearly mandatory**, but given messaging and dispute
evidence, a short DPIA document is recommended before the pilot (task P04-03). To be confirmed by
legal review (L-12).

## 5. Retention schedule (enforced by the worker; values configurable)

| Data | Retention | Basis for the period |
|---|---|---|
| Active account (email, profile) | while the account exists | contract |
| Inactive account (no sign-in) | 24 months, then a warning email, then deleted after a further 60 days | minimisation |
| Sessions incl. IP/user agent | until expiry (max 30 days), then purged | security |
| Verification / reset tokens | until expiry + 7 days | security |
| Deleted or archived listings and their images | 30 days after deletion (soft delete for undo and abuse investigation) | minimisation |
| Conversations without a booking | 12 months after the last message | minimisation |
| Conversations with a booking | 12 months after the last booking in the conversation ends; messages referenced in a dispute are kept with the dispute | minimisation / legal claims |
| Bookings, agreements, acceptances, condition reports and photos, booking events | **3 years after the booking ends** | general limitation period (foreldelsesloven § 2), art. 17(3)(e) |
| Giveaway claims and transfer confirmations | 3 years after transfer | as above |
| Disputes, evidence, proposals, support notes | 3 years after closure, longer only if a party documents ongoing proceedings | legal claims |
| Reviews | while the subject's account exists, max 3 years after the booking; author shown as «Tidligere medlem» after the author's account deletion | trust / legal claims |
| Reports, moderation actions, appeals | 2 years after closure | accountability, appeals |
| Audit events (incl. staff access) | 24 months | security |
| Notifications | 12 months | minimisation |
| Email outbox rows | 30 days after sending | troubleshooting |
| Server logs | 30 days (Docker log rotation) | security |
| Error monitoring events | 30 days (provider setting) | stability |
| Backups | rolling, max 6 months | durability. Deleted data disappears from backups within 6 months. |
| Category suggestions | 12 months | minimisation |
| Legal acceptances | while the account exists + 3 years | proof of acceptance |

## 6. Account deletion procedure

1. User clicks «Slett konto» and re-authenticates. Status becomes `deletion_pending`: sessions revoked and listings hidden.
2. If a booking (`accepted` … `return_pending`, `not_returned`), a selected giveaway claim or an open dispute exists, erasure waits until it ends. The user is told why and can still sign in to finish it.
3. **Erasure job** (within 30 days of the request, or of the blocking item ending):
   - **Deleted:** password and credentials, sessions, 2FA, profile bio and locality, saved listings, blocks, notifications, outbox rows, listings without bookings and their images, identity verification rows.
   - **Replaced:** `users.email` → `deleted+<uuid>@invalid`; `users.name` → «Slettet bruker»; status `deleted`.
   - **Kept until their own retention end (pseudonymised by UUID):** agreements, condition reports, booking events, disputes, reviews. These contain the display name at the time of the agreement. That is necessary evidence for the other party, and the privacy notice says so.
   - The user's messages stay visible to the other participant as «Slettet bruker» until message retention ends.
4. The user receives a confirmation email before the address is removed.
5. Backups age out within 6 months.

## 7. Cookies and device storage inventory (ekomloven § 3-15)

| Name | Purpose | Type | Lifetime | Consent needed? |
|---|---|---|---|---|
| `__Host-laandet.session` | keeps you signed in (session token) | first-party, HttpOnly | 30 days (8 h staff) | No: strictly necessary for a service the user requested |
| `__Host-laandet.session_data` | short-lived signed cache of session (if enabled) | first-party, HttpOnly | 5 min | No: strictly necessary |
| `__Host-laandet.two_factor` | carries the 2FA step during sign-in (staff) | first-party, HttpOnly | 10 min | No: strictly necessary |
| `NEXT_LOCALE` | remembers the language the user chose | first-party | 1 year | No: user-interface preference explicitly chosen (verify wording, L-05) |
| Turnstile (only if `captcha_turnstile` on) | bot protection at sign-up | third-party (Cloudflare) | session | Assess before enabling (L-05) |

There is no `localStorage` for personal data. Listing drafts are saved on the server, not in the browser.

No consent banner is needed while only the items above are used. The cookie page lists them.
**Any new cookie or similar storage requires updating this table, the public cookie page and a legal check.**

## 8. Data subject rights — how they are served

| Right | Implementation |
|---|---|
| Access and portability | «Last ned mine data» in account settings → JSON file: profile, listings, own messages, bookings, agreements, condition entries, reviews written and received, reports filed (Phase 03, task P03-06). Manual fallback by email before that. |
| Rectification | edit profile and listings. Agreements are not edited; corrections are made by a new revision or a condition entry. |
| Erasure | §6 |
| Restriction / objection | by email to the controller contact. Staff process within 1 month and log it in the admin panel. |
| Withdraw consent | not applicable in the MVP (no consent-based processing) |
| Complaint | Datatilsynet (www.datatilsynet.no) |

## 9. Personal data breach procedure (summary)

1. **Detect and contain.** Revoke sessions, rotate secrets, block the vector.
2. **Assess** risk to users within 24 hours, using the audit log, server logs and database.
3. **Notify Datatilsynet within 72 hours** if the breach is likely to result in a risk to rights and freedoms (GDPR art. 33).
4. **Inform affected users** without undue delay if the risk is high (art. 34). Use plain Norwegian and English.
5. **Record** every breach, including ones not notified, in `docs/runbooks/BREACH_LOG.md` (created in P01-13).
