# Laandet — OWASP ASVS 4.0.3 Level 1 checklist (P03-05)

**Status on 25.10.2026, after Phase 03.** Requirements that apply to Laandet, grouped by chapter. A ✅ means
an automated test, a lint rule or a reading of the code backs it (see [`SECURITY_VERIFICATION.md`](SECURITY_VERIFICATION.md)
for the tests). This is a self-assessment by the development team (AI-assisted), not an external audit.

Legend: ✅ met · 🟡 partly met or met differently · ❌ not met · ⏳ needs the server (Phase 04) · n/a not applicable

## V2 Authentication

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 2.1.1 | Passwords at least 12 characters | ❌ | **Accepted exception (owner decision D-056):** minimum **6**, because long passwords put people off. Below ASVS (12) and NIST SP 800-63B (8). Mitigations: breached-password check, sign-in limits (5 per 15 min per address, 20 per IP), mandatory TOTP for staff, «Vis passord». |
| 2.1.2 | Allow at least 64 characters | ✅ | Up to 128. |
| 2.1.3 | No truncation | ✅ | Better Auth hashes the whole password (scrypt). |
| 2.1.4 | Any printable Unicode | ✅ | No character restrictions. |
| 2.1.5 / 2.1.6 | Users can change the password; the current one is required | ✅ | `/konto` (P01-07). |
| 2.1.7 | Breached-password check | ✅ | HIBP k-anonymity check, on by default outside development and test. |
| 2.1.8 | Password strength meter | ❌ | Not built. The breached-password check and the length rule are the controls. |
| 2.1.9 / 2.1.10 | No composition rules, no forced rotation | ✅ | |
| 2.1.11 | Paste and password managers allowed | ✅ | Plain `type="password"` fields. |
| 2.1.12 | Option to show the password | ✅ | «Vis passord» on every password field (P04-02, e2e `security.spec.ts`). |
| 2.2.1 | Anti-automation | ✅ | Sign-in, sign-up and reset limits; honeypot and minimum fill time. |
| 2.2.2 | No weak authenticators | ✅ | No SMS or email codes for sign-in. |
| 2.2.3 | Notify after authentication changes | ✅ | Emails on password change and email change. |
| 2.5.1–2.5.4, 2.5.6 | Safe recovery | ✅ | Single-use reset link (1 h), no hints, no shared or default accounts. |
| 2.8.1 | Time-based OTP has a lifetime | ✅ | TOTP (staff), 30-second steps. |

## V3 Session management

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 3.1.1 | No session tokens in URLs | ✅ | Cookie only. |
| 3.2.1–3.2.3 | New token on sign-in, enough entropy, stored safely | ✅ | Better Auth; `__Host-` cookie (fixed in P03-05). |
| 3.3.1 | Sign-out invalidates the session | ✅ | Server-side session deleted; «Logg ut fra alle enheter». |
| 3.3.2 | Periodic re-authentication (L1: 30 days) | 🟡 | Sessions last 30 days and are **rolling** (renewed daily while used), so an active member stays signed in. Staff sessions end after 8 h for admin use. Explained to the owner 25.10.2026; the convenient behaviour is kept unless the owner asks for a fixed limit. |
| 3.4.1–3.4.5 | Secure, HttpOnly, SameSite, `__Host-`, Path | ✅ | e2e `security.spec.ts`. |
| 3.7.1 | Re-authentication for sensitive actions | ✅ | Email change, password change, account deletion, 2FA. |

## V4 Access control

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 4.1.1–4.1.3 | Enforced on the server; attributes not user-controllable; least privilege | ✅ | Central `can()`; ownership from the database; least-privilege database role. |
| 4.1.5 | Fail securely | ✅ | Deny by default; strangers get 404. |
| 4.2.1 | Protection against IDOR | ✅ | Negative tests in every area (N1, N2, N13, N15, bookings, claims, cases, reviews, export). |
| 4.2.2 | CSRF protection | ✅ | Server Action origin check, and the same check on the data export POST (e2e tests). |
| 4.3.1 | MFA for administrative interfaces | ✅ | TOTP mandatory for staff. |
| 4.3.2 | No directory browsing or metadata exposure | ✅ | No static listings; media served by id through an authorised route. |

## V5 Validation, sanitisation and encoding

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 5.1.2 | Mass-assignment protection | ✅ | Schemas name every field (SEC-21 test). |
| 5.1.3 / 5.1.4 | Allow-list validation, structured data validated | ✅ | Zod + database `CHECK`s. |
| 5.1.5 | Redirects only to allowed targets | ✅ | `safeRedirectPath` (unit test). |
| 5.2.1 / 5.2.2 | Untrusted HTML sanitised | ✅ | User HTML is never rendered; Markdown only from the repository, with HTML skipped. |
| 5.2.3 | Email injection | ✅ | Fixed subjects; plain-text bodies; no user-controlled headers. |
| 5.2.4 / 5.2.5 | No `eval`, no template injection | ✅ | Agreement templates are logic-less with Markdown escaping of every value. |
| 5.2.6 | SSRF | ✅ | No server-side requests to user-supplied URLs. |
| 5.2.7 | SVG scripts | ✅ | SVG is not accepted. |
| 5.3.1 / 5.3.3 | Context-aware output encoding | ✅ | React text rendering. |
| 5.3.4 | Parameterised queries | ✅ | Drizzle; `sql.raw` banned by lint. |
| 5.3.8 / 5.3.9 | OS command and file inclusion | ✅ | None in the code. |
| 5.5.1–5.5.3 | Safe deserialisation | ✅ | JSON only, validated. |

## V7 Error handling and logging

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 7.1.1 / 7.1.2 | No credentials, session tokens or other sensitive data in logs | ✅ | `safeError` redaction (P03-05), IP hashes only. |
| 7.4.1 | Generic error message with an id | ✅ | Localized error page with the reference code (P03-05). |

## V8 Data protection

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 8.2.1 | Anti-caching for sensitive data | ✅ | Private media `no-store`; signed-in pages are dynamic and not cached publicly. |
| 8.2.2 / 8.2.3 | No sensitive data in browser storage; cleared on sign-out | ✅ | No `localStorage` for personal data (PRIVACY §7). |
| 8.3.1 | Sensitive data in the body, not the URL | ✅ | |
| 8.3.2 | Users can export and delete their data | ✅ | «Last ned mine data» and account deletion with the erasure job (P03-06). |
| 8.3.3 / 8.3.4 | Clear privacy information; sensitive data identified | 🟡 | `PRIVACY.md` and the privacy notice exist as **drafts, not legally reviewed**. |

## V9 Communications

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 9.1.1–9.1.3 | TLS everywhere, strong configuration | ⏳ | Caddy with automatic TLS; verified only when the server and domain exist. |

## V10 Malicious code

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 10.3.2 | No subdomain takeover | ⏳ | DNS does not exist yet. |

## V11 Business logic

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 11.1.1 | Steps in order, no skipping | ✅ | Booking, claim and case state machines with status-conditional updates; steps in one case serialised by a row lock; appeals decided once; database triggers for acceptances, proposals, reviews and booking money terms. |
| 11.1.2–11.1.4 | Business limits and anti-automation | ✅ | Rate limits per action, including case and booking steps; one open case per booking with at most 400 party entries; one review per party. |
| 11.1.5 | Limits documented | ✅ | `SECURITY.md` §2, `DISPUTE_POLICY.md` §3. |

## V12 Files and resources

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 12.1.1 | Large files refused | ✅ | 10 MB per file, 11 MB request limit. |
| 12.3.1–12.3.6 | No user file names in paths, no remote inclusion | ✅ | Random storage keys; images only. |
| 12.4.1 | Stored outside the web root | ✅ | Media volume served only through the authorised route. |
| 12.4.2 | Antivirus scan of uploads | 🟡 | No virus scanner. Mitigated: only images are accepted, each is decoded and re-encoded as WebP, the original is never stored or served. ClamAV is a precondition for any document upload (SEC-34). |
| 12.5.1 / 12.5.2 | Files never served as executable or HTML | ✅ | `image/webp`, `nosniff`, `Content-Disposition: inline`. |

## V13 API

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 13.1.1 / 13.1.3 | Same encoding; no keys in URLs | ✅ | The data export uses the session cookie. |
| 13.2.1–13.2.3 | Allowed methods; schema validation; CSRF | ✅ | Server Actions (POST) with origin check; the data export is POST only (GET gives 405); the remaining GET routes are read-only. |

## V14 Configuration

| ID | Requirement (short) | Status | Note |
|---|---|---|---|
| 14.2.1 | Components up to date | ✅ | Dependabot, `npm audit` and OSV-Scanner in CI (P04-02). |
| 14.2.3 | Subresource integrity for third-party assets | n/a | No third-party scripts or styles. |
| 14.3.2 / 14.3.3 | No debug output; no version headers | ✅ | Production build; `poweredByHeader: false`. |
| 14.4.1 | Content-Type with charset | ✅ | Next.js defaults. |
| 14.4.3–14.4.7 | CSP, nosniff, Referrer-Policy, frame-ancestors | ✅ | e2e header test. |
| 14.4.5 | HSTS | ⏳ | Set by Caddy; verified on the server. |
| 14.5.3 | CORS allow-list | ✅ | No `Access-Control-Allow-Origin` is sent. |

## Open items from this checklist

1. **2.1.1** minimum 6 characters — accepted by the owner as an exception (D-056).
2. **2.1.8** strength meter — not built (the breached-password check is the control). «Vis passord» (2.1.12) is done.
3. **3.3.2** rolling 30-day sessions for members — kept as the default (explained to the owner 25.10.2026).
4. **12.4.2** no antivirus — accepted risk while only re-encoded images are allowed.
5. **14.2.1** OSV-Scanner — in CI since P04-02.
6. **V9, 10.3.2, 14.4.5** — verify on the server in Phase 04.
