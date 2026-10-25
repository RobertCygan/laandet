# Laandet — Authentication and Authorisation Model

**Status:** Designed (Phase 00). Implementation tasks: P01-05 (authentication) and P01-06 (authorisation and audit).

## 1. Authentication

| Capability | MVP design |
|---|---|
| Library | Better Auth (self-hosted, same app and database). No custom cryptography. |
| Sign-up | Email + password + display name + locality (optional). The user must tick three confirmations, each stored with a timestamp: **(1)** «Jeg er 18 år eller eldre», **(2)** «Jeg bruker Laandet som privatperson, ikke i næringsvirksomhet», **(3)** «Jeg godtar brukervilkårene» (links to the terms and the privacy notice). |
| Email verification | A link valid for 24 hours. Until the email is verified, the user can only browse, edit their profile and resend the link. |
| Password rules | Minimum 10 characters, maximum 128. Rejected if found in the breached-password corpus (k-anonymity check). No composition rules. Hashed with scrypt (Better Auth default). |
| Sign-in | Email + password. Optional passkey (flag `passkeys`). Generic error message: «Feil e-post eller passord». The message is the same whether or not the account exists. |
| Password reset | An emailed link, valid for 1 hour and single use. A successful reset revokes all other sessions. The response is identical whether or not the email exists. |
| Sessions | Database sessions, stored in a cookie named `__Host-laandet.session`. Cookie attributes: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Lifetime: 30 days, rolling. For staff: 8 hours, with no "remember me". |
| Sign-out | Deletes the server session. A "Logg ut fra alle enheter" option revokes every session. |
| Staff 2FA | TOTP is **mandatory** for `moderator` and `admin`. `/admin` refuses access without a 2FA-verified session. Backup codes are shown once. |
| Re-authentication | Required within the last 10 minutes before these actions: change email, change password, delete account, enable or disable 2FA, and administrative role changes. |
| Rate limits | **Sign-in:** 5 attempts per 15 min per email and 20 per 15 min per IP. **Sign-up:** 5 per hour per IP. **Reset and verification emails:** 3 per hour per email. **Exceeded:** HTTP 429 with a friendly Norwegian message. Every limit is logged to `audit_events` as `auth.rate_limited`. |
| Bot protection | Honeypot field, minimum fill time (3 s) and email verification. Cloudflare Turnstile is prepared behind the flag `captcha_turnstile` (off by default; D-007). |
| Account deletion | **Request:** «Slett konto» → re-authenticate → status becomes `deletion_pending`, published listings are hidden and all sessions are revoked. **Erasure:** runs when no booking, claim or dispute is active (immediately, or as soon as they close). See `PRIVACY.md` §6 for what is erased and what is kept, and for how long. |

## 2. Roles and trust levels

Role (`user_profiles.role`) and verification level are separate dimensions.

| Level | How it is reached | Badge shown |
|---|---|---|
| **Visitor** (`anonymous`) | not signed in | — |
| **Registered** (`registered`) | account created, email **not** verified | — |
| **Member** (`member`) | email verified | none (email verification is not identity verification) |
| **Verified** (`verified`) | `identity_verifications` row with `level = 'strong'`, `status = 'verified'`, written **only** by the identity-provider callback (BankID, Phase 05) | «ID verifisert» with provider and date |
| **Moderator** (`moderator`) | assigned by an admin, 2FA required | «Laandet-moderator» on staff messages only |
| **Administrator** (`admin`) | assigned by an admin, 2FA required | — |

**No code path lets users set their own verification level, role or status.** The service functions that
write these columns accept only the identity-provider callback (verification) or an admin actor
(role, status), and each write is audited.

## 3. Account status

| Status | Effect |
|---|---|
| `active` | normal |
| `restricted` | Can sign in, read, finish ongoing bookings and disputes, and appeal. **Cannot** publish, request, claim or start new conversations. |
| `suspended` | All sessions revoked. The user can sign in only to see the reason, appeal and download their data. Their listings are hidden. |
| `deletion_pending` | As `suspended`, plus erasure is scheduled. |
| `deleted` | Personal data erased or pseudonymised. The account cannot sign in. |

Status is checked **on every request** in `getSession()`, so a suspended user is not left with a working session.

## 4. Authorisation matrix

Legend: ✅ allowed · 🔒 only own resource / only as a party · ⛔ denied · 🛡 staff with recorded reason (audited)

| Action | Visitor | Registered | Member | Moderator | Admin |
|---|---|---|---|---|---|
| Browse published listings, categories, public profiles, legal pages | ✅ | ✅ | ✅ | ✅ | ✅ |
| View listing images (published listings) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / edit / pause / archive / delete listing | ⛔ | ⛔ | 🔒 | 🛡 hide/restore only | 🛡 hide/restore only |
| Upload listing images | ⛔ | ⛔ | 🔒 | ⛔ | ⛔ |
| Save listings | ⛔ | ✅ | ✅ | ✅ | ✅ |
| Start conversation about a listing | ⛔ | ⛔ | ✅ (not own, not blocked) | ✅ | ✅ |
| Read conversation | ⛔ | ⛔ | 🔒 participant | 🛡 only messages attached to a report, or an escalated dispute grant | same as moderator |
| Send rental request / giveaway claim | ⛔ | ⛔ | ✅ (not own listing, category rules) | ✅ | ✅ |
| Accept / decline request, select recipient | ⛔ | ⛔ | 🔒 listing owner | ⛔ | ⛔ |
| Accept agreement | ⛔ | ⛔ | 🔒 the named party only | ⛔ | ⛔ |
| Record condition entry / confirm | ⛔ | ⛔ | 🔒 booking party, own entries only | ⛔ | ⛔ |
| View condition report and photos | ⛔ | ⛔ | 🔒 booking party | 🛡 dispute grant | 🛡 dispute grant |
| Open dispute, add evidence, make or answer proposal | ⛔ | ⛔ | 🔒 booking party | ⛔ (adds support notes and recommendations only) | ⛔ |
| Escalate dispute to support | ⛔ | ⛔ | 🔒 booking party | — | — |
| Write review | ⛔ | ⛔ | 🔒 party of a completed booking, once | ⛔ | ⛔ |
| Report listing, user, message, review | ⛔ (visitors use the contact email) | ✅ | ✅ | ✅ | ✅ |
| Handle reports, hide listings, restrict or suspend users, remove reviews | ⛔ | ⛔ | ⛔ | 🛡 | 🛡 |
| Decide appeals | ⛔ | ⛔ | ⛔ | 🛡 not on own decision | 🛡 not on own decision |
| Manage categories, localities, restricted-item policy | ⛔ | ⛔ | ⛔ | 🛡 policy field only | 🛡 |
| Manage feature flags, legal versions, staff roles | ⛔ | ⛔ | ⛔ | ⛔ | 🛡 |
| View security events and audit log | ⛔ | ⛔ | ⛔ | ⛔ | 🛡 |
| Export own data / request deletion | ⛔ | ✅ | ✅ | ✅ | ✅ |

Notes:
- **Blocking:** if A blocks B, neither can start a conversation, send a request or send a claim to the other. Ongoing bookings stay accessible so both can finish them.
- **Staff as users:** staff who use Laandet privately act as Members. A staff member can never moderate a case in which they are a party; the service checks this.
- **Appeals:** the reviewer of an appeal must differ from the person who took the original action. If only one staff member exists, the appeal is marked «behandlet av samme person» and the user is told so.

## 5. Implementation pattern

```ts
// modules/authz/policy.ts
type Actor =
  | { kind: 'anonymous' }
  | { kind: 'user'; id: string; role: 'user' | 'moderator' | 'admin';
      status: AccountStatus; emailVerified: boolean; idLevel: 'none' | 'basic' | 'strong';
      staff2fa: boolean };

export function can(actor: Actor, action: Action, resource: Resource): Decision
// Decision = { allow: true } | { allow: false; reason: DenyReason }  (DenyReason → localised message)
```

- **Services call `can()` first.** The check runs before any read of private data or any write. It is never done in React components.
- **Ownership comes from the database.** Ownership checks use database values (`listing.owner_id`, `booking.renter_id`), never ids sent by the client.
- **Queries are actor-scoped.** For example: `WHERE b.id = $1 AND $actor IN (b.owner_id, b.renter_id)`. A wrong id returns **404, not 403**, so resource existence is not leaked.
- **Staff reads of private data:**
  - Go through `support_access_grants`, which requires a reason, has a time limit and is checked at read time.
  - Every read writes `audit_events(action = 'staff.view_*', reason, target)`.
- **Negative tests:** one per ⛔/🔒 cell above, in the integration suite (see `TEST_STRATEGY.md` §4).

## 6. Staff administration rules

- Production starts with **one admin account** (the project owner). It needs a strong unique password and 2FA. Backup codes are stored offline.
- Admin and moderator roles are granted by an admin. Each grant is audited and emailed to all admins.
- There is no "impersonate user" feature.
- Staff never see password hashes, session tokens or 2FA secrets.
- Database access on the server (`psql`) requires SSH key login to the VPS. SSH password login is disabled. Direct database queries on personal data are recorded in a manual access log (`docs/runbooks/ACCESS_LOG.md`, created in P01-13).
