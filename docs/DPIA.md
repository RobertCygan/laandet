# Laandet — Data protection impact assessment (short DPIA, P04-03)

> **Draft by the development team (AI-assisted). Not legally reviewed. To be confirmed by the lawyer and signed
> by the controller.**

**Version:** 0.1, 25.10.2026. **Covers:** the pilot in Steigen from 14.12.2026 (Phases 01–03 as implemented).
**Controller:** G-PSI.ai — legal entity, organisation number, address and contact email: `MÅ FYLLES UT FØR LANSERING`.
**Why this document exists:** the screening in [`PRIVACY.md`](PRIVACY.md) §4 found that a DPIA is not clearly
mandatory (one to three EDPB criteria apply, each only partly). Private messages and case evidence still justify a
short assessment before real people use the service (GDPR art. 35, to be confirmed under L-12 in
[`LEGAL_REVIEW_CHECKLIST.md`](LEGAL_REVIEW_CHECKLIST.md)).

## 1. Description of the processing

**What Laandet is:** a local peer-to-peer marketplace for adults (18+) in Steigen.
- People rent out, ask to rent, lend and give away physical items.
- They talk through private messages, accept a simple agreement, and record the item's condition at handover and return with photos.
- If something goes wrong, they can open a case and ask Laandet staff for help.
- Laandet holds no money and processes no payments (D-012).

**Data, people and purposes:** the record of processing activities P1–P13 in [`PRIVACY.md`](PRIVACY.md) §2:
- accounts;
- profiles;
- listings and photos;
- messages;
- bookings, agreements and condition reports;
- cases;
- reviews;
- reports and moderation;
- notifications;
- security and audit logs;
- backups;
- email contact.

**Not processed:**
- fødselsnummer or date of birth;
- phone numbers or exact addresses in public;
- payment or card data;
- tracking, analytics or advertising;
- special categories on purpose. Health data can appear by accident in a statement about an injury.

**Where the data lives:**
- one server in the EU/EEA (not bought yet);
- encrypted off-site backups in the EU;
- an email provider (not chosen yet);
- optional uptime and error monitoring;
- processors and transfers are in [`PRIVACY.md`](PRIVACY.md) §3. No contract is signed yet.

**Who sees what:**
- **Public:** published listings, profiles (display name, locality, bio, real statistics) and published reviews.
- **The two parties only:** messages, agreements, condition reports and cases.
- **Staff:** reports, the single reported message, and a case only after taking it with a reason (a 30-day grant). Every view is audited.

## 2. Necessity and proportionality

| Question | Answer |
|---|---|
| Legal basis | Mainly contract (art. 6(1)(b)); legitimate interests (art. 6(1)(f)) for security, moderation and keeping evidence. Proposed bases per activity: [`PRIVACY.md`](PRIVACY.md) §2. To be confirmed by the lawyer. |
| Is each data item needed? | Only an email address, a display name and an optional locality are needed to take part. No real-name or ID check in the pilot. |
| Retention | Each category has an end date ([`PRIVACY.md`](PRIVACY.md) §5), enforced by worker jobs and fixed-period database functions. |
| Information to people | Privacy notice ([`../legal/nb/personvernerklaering.md`](../legal/nb/personvernerklaering.md)), **still a draft with `MÅ FYLLES UT` markers.** |
| Rights | Export («Last ned mine data»), correction (profile and listings), erasure (account deletion with the erasure job), objection by email ([`PRIVACY.md`](PRIVACY.md) §8). |
| Processors | EU hosting and storage. Data processing agreements must be signed before launch (planned, §4). |

## 3. Risks to the people involved and the measures in place

Likelihood and severity: low / medium / high. "In place" means implemented, with a test or file to show for it.
Measures that only exist on paper are in §4.

| # | Risk to the people involved | Likelihood | Severity | Measures in place (evidence) | Residual risk |
|---|---|---|---|---|---|
| R1 | Another user reads private messages, condition photos or cases | low | high | One central policy; another person's object gives 404 (`authz/policy.test.ts`, 79 cases). Negative tests N1, N2, N12 and N13 (`messaging.int`, `condition.int`, `disputes.int`). Private photos only through the authorised media route (SEC-33). | low |
| R2 | Staff read more private data than they need | medium | high | Case content only with a reasoned, 30-day grant, checked at read time. Every staff view is audited (`disputes.int`). Moderators see only the single reported message (N15, `moderation.int`). Staff never handle their own case. No bulk export and no impersonation. | low–medium (small team; depends on the weekly audit review, §4) |
| R3 | Account takeover, giving access to messages and agreements | medium | medium | Breached-password check. Sign-in limits per address and per IP (`auth.int`). Mandatory TOTP and 8-hour sessions for staff. Every session revoked on password reset. `__Host-` HttpOnly session cookie (e2e `security.spec.ts`). **Minimum password length 6** (owner decision D-056, below ASVS). | medium (accepted by the owner, D-056) |
| R4 | A breach of the server or database exposes messages and email addresses | low | high | Least-privilege database role; append-only tables (`privileges.int`). Secrets kept out of the repository (gitleaks in CI). Passwords hashed with scrypt; IP addresses only as HMAC hashes (`server/request-meta.ts`). Logs redacted (SEC-43). Non-root, read-only container. The backup script encrypts with restic before upload (rehearsed locally only, [`runbooks/RESTORE.md`](runbooks/RESTORE.md)). | medium until the server hardening and TLS are verified on the real server (§4) |
| R5 | A home address or location is exposed | low | high | Only a locality and an optional area note in public. The exact meeting place is shared only inside a booking. EXIF/GPS removed from every photo (`media.int`, SEC-32). | low |
| R6 | Reputational harm: unfair reviews, public accusations, a dispute visible to others | medium | medium | Double-blind reviews (`reviews.int`). Cases never appear on profiles (N12). Reviews can be reported and removed with a statement of reasons and an appeal. Neutral wording rules in [`DISPUTE_POLICY.md`](DISPUTE_POLICY.md). | low |
| R7 | Wrongful moderation shuts someone out | low | medium | Human decisions only, each with a statement of reasons and an email. An appeal is decided once, by another staff member when one exists (`moderation-measures.int`). A restricted account can still finish its rentals and add evidence. | low |
| R8 | Data kept too long, or evidence deleted too early when a party needs it | low | medium | Retention jobs and erasure tested against back-dated rows (`privacy.int`). The application cannot pull a purge forward: database-stamped `last_changed_at`, migration `0010`. Erasure waits for bookings and cases under way. | low |
| R9 | Health data appears in a case about an injury | low | medium | Users are told not to share sensitive data. Staff keep only what is necessary. Case content is private to the parties and to granted staff. | medium (L-12, open for the lawyer) |
| R10 | A user is defrauded by another user (fake listing, payment link) | medium | medium | No money through Laandet (D-012), with a payment-link warning in messages. The booking's money terms are frozen in the database (N6). Category A only (≤ 5 000 kr). Reports and account measures. | medium |
| R11 | A processor or a transfer outside the EEA leaks data | low | medium | No third-party scripts, fonts or analytics in the browser. Error monitoring (optional in PRIVACY §3) is not set up in the code. | medium until EU providers are chosen and the agreements are signed (§4) |

## 4. Measures planned (not in place today)

These are needed before or during the pilot. Each one has an owner and a gate in [`RELEASE_GATES.md`](RELEASE_GATES.md).

1. **Legal review** of the privacy notice, the terms and this DPIA, with the controller details filled in (legal gate L-1 to L-4).
2. **Data processing agreements** with the hosting, backup and email providers once they are chosen (Eier, [`runbooks/BILLING.md`](runbooks/BILLING.md)).
3. **Server hardening and TLS verified** on the real server ([`runbooks/SERVER_SETUP.md`](runbooks/SERVER_SETUP.md); SEC-01, SEC-62).
4. **A real restore test**, logged in [`runbooks/RESTORE_LOG.md`](runbooks/RESTORE_LOG.md) (SEC-53).
5. **Operations alerts and an uptime monitor** that reach the owner ([`runbooks/LAUNCH.md`](runbooks/LAUNCH.md)).
6. **Weekly review of staff access** in the security log (`/admin/sikkerhet`) by the owner ([`PILOT_SUPPORT.md`](PILOT_SUPPORT.md)).
7. **Named moderators** with 2FA, who have read [`MODERERING.md`](MODERERING.md).
8. **A breach routine** that is practised once: [`PRIVACY.md`](PRIVACY.md) §9 and [`runbooks/BREACH_LOG.md`](runbooks/BREACH_LOG.md).

## 5. Consultation

- **Lawyer:** to review this DPIA together with the legal package (`MÅ FYLLES UT FØR LANSERING`: name and date).
- **Datatilsynet:** prior consultation (art. 36) is needed only if a high residual risk remains after the measures. With the measures above, no residual risk is assessed as high. The lawyer confirms this.
- **The people involved:** the closed beta ([`BETA_PLAN.md`](BETA_PLAN.md)) is used to ask testers whether the privacy information is clear.

## 6. Sign-off and review

| Role | Name | Date | Signature |
|---|---|---|---|
| Controller | `MÅ FYLLES UT FØR LANSERING` | | |
| Lawyer (reviewed) | `MÅ FYLLES UT FØR LANSERING` | | |

**Review:**
- after the first month of the pilot (January 2027);
- before any new kind of processing (for example BankID, payments or category B);
- after any personal data breach.
