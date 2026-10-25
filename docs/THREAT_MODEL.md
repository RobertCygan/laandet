# Laandet — Threat Model

**Status:** Designed (Phase 00). Review again at the end of Phase 02 and before the pilot (Phase 04).
**Method:** asset- and actor-based, with STRIDE categories. Controls refer to [`SECURITY.md`](SECURITY.md) IDs.
**Scale assumption:** small local marketplace (100–2 000 users), one EU server, no payments.

## 1. Assets

| Asset | Why it matters |
|---|---|
| A1 User accounts and sessions | Takeover lets an attacker publish fake listings, message as a neighbour or read private data |
| A2 Personal data: email, display name, locality, messages, exact meeting places, condition photos, dispute statements | Privacy harm; GDPR obligations; in a small community, leaks are easy to link to real people |
| A3 Evidence: agreements, acceptances, condition reports, booking history | Fairness of disputes; the parties' legal position |
| A4 Physical items of owners | Theft or non-return happens in the real world. The platform can only reduce risk and help document it. |
| A5 Trust signals: reviews, verification badges, completed-rental counts | Manipulation misleads other users |
| A6 Admin capabilities | Compromise = access to reports, disputes, ability to suspend users |
| A7 Availability and data durability | Lost data = lost evidence and lost trust |
| A8 Reputation of Laandet and G-PSI.ai | A local project lives on trust |

## 2. Threat actors

| Actor | Motivation | Capability |
|---|---|---|
| T1 Opportunistic internet attacker | credential stuffing, spam, SEO spam, malware hosting | automated tools, leaked password lists |
| T2 Scammer | fake listings, advance-payment or deposit fraud, phishing links, "send payment via this link" | creates many accounts, social engineering |
| T3 Dishonest participant | keep or damage an item and deny it, fabricate damage claims, retaliate in reviews | legitimate account, real-world access to items |
| T4 Harasser | unwanted contact, stalking (finding someone's address) | legitimate account, local knowledge |
| T5 Curious or malicious insider | browse private messages or disputes | moderator/admin role, server access |
| T6 Supply-chain attacker | malicious npm package or base image | indirect |

## 3. Trust boundaries

```
[Browser] ──HTTPS──▶ [Caddy] ──▶ [Next.js app] ──▶ [PostgreSQL]   (runtime role, least privilege)
                                     │  └──────▶ [media volume]   (only via /media route)
                                     └──SMTP──▶ [Email provider]  (receives email address + template text)
[Owner laptop] ──SSH key──▶ [VPS]  ── restic ──▶ [Off-site backup] (encrypted client-side)
[GitHub Actions] ──SSH deploy key (restricted user)──▶ [VPS]
```

## 4. Threats and controls

Ratings are L (likelihood) and I (impact), each on a 1–3 scale. Residual risk is what remains after the controls.

| # | Threat (spec item) | STRIDE | L/I | Controls | Residual risk / note |
|---|---|---|---|---|---|
| TH-01 | **Account takeover** via phishing or reused password | S | 2/3 | breached-password check, rate limits, session revocation on reset, notification email on password/email change, optional passkeys | Phishing outside our control. Mitigated by "new sign-in" emails (Phase 03 nice-to-have). |
| TH-02 | **Credential stuffing / brute force** | S | 3/2 | SEC-13 limits per email and IP, generic errors, audit `auth.rate_limited`, optional Turnstile | Low |
| TH-03 | **Automated spam accounts** | S, D | 3/2 | email verification before any write, sign-up rate limit per IP, honeypot and timing, stricter limits for accounts < 7 days, `registrations_open` kill switch | Low–medium. Turnstile as a fallback. |
| TH-04 | **Fake listings** (bait items, stolen goods, prohibited items) | S, T | 2/2 | email-verified owners only, prohibited/restricted category rules, report button on every listing, moderator hide with statement of reasons, new-account limits, no external links in listings | Medium. Community reporting is key in a small market. |
| TH-05 | **Fraudulent rental requests** (fake renter collects and disappears) | S | 2/3 | requests only from verified-email members, profile shows join date and genuine completed rentals, owner decides, deposit option (off-platform), category A cap (≤ 5 000 kr) in the MVP, handover report, guidance in *Trygg utleie* | Medium. The 5 000 kr cap limits worst-case loss. |
| TH-06 | **Stolen or unreturned equipment** | — | 2/3 | `not_returned` flow, documented agreement + identity of account, guidance to police report (underslag/tyveri), account restriction pending clarification, cap ≤ 5 000 kr | Real-world risk remains; communicate honestly. |
| TH-07 | **Unauthorised access to private messages** | I | 2/3 | actor-scoped queries, 404 on foreign ids, staff access only via reported messages or dispute grants with reason + audit, negative tests | Low |
| TH-08 | **Insecure file uploads** (malware, polyglots, decompression bombs, SVG XSS) | T, E | 2/3 | SEC-30…34: magic-byte detection, pixel limit, sharp re-encode to WebP, no SVG/PDF, random keys, `nosniff` | Low |
| TH-09 | **Stored XSS** via listing text, messages, display names, reviews | T, E | 2/3 | React text rendering only, no user HTML/Markdown, CSP with nonces, lint ban on `dangerouslySetInnerHTML` | Low |
| TH-10 | **CSRF** | T | 1/2 | Server Actions origin check, `SameSite=Lax`, Better Auth trusted origins, no state-changing GET | Low |
| TH-11 | **SQL injection** | T, I | 1/3 | Drizzle parameterisation, lint rule on raw SQL, least-privilege database role | Low |
| TH-12 | **IDOR / broken object-level authorisation** (edit others' listings, read others' bookings, fetch private photos) | E, I | 3/3 | `authz.can()` in every service, ownership from database, scoped queries, one negative test per matrix cell, `/media` checks | Low if tests are kept complete. **Highest-priority test area.** |
| TH-13 | **Privilege escalation** (user sets own role, verification, review status) | E | 2/3 | strict Zod schemas, no generic update endpoints, role changes admin-only + audited + emailed | Low |
| TH-14 | **Session hijacking** | S | 1/3 | `__Host-` HttpOnly Secure cookies, HTTPS + HSTS, no tokens in URLs, CSP | Low |
| TH-15 | **Leakage of personal addresses** | I | 2/3 | only localities + short area note in public. Exact meeting place is visible only to the two booking parties after confirmation. Image EXIF/GPS stripped. Warnings in the listing form ("ikke skriv adressen din her"). | Medium: users may still type addresses into descriptions. Optional address detector (Phase 03). |
| TH-16 | **Exposure of sensitive data** (emails in public pages, logs, error messages) | I | 2/2 | public profile shows display name, locality, join date, real statistics only. Email never shown to other users. Logs redacted (SEC-43). | Low |
| TH-17 | **Malicious links** in messages or listings | S, T | 2/2 | URLs not clickable, listing description has no links, warning banner in conversations, reportable | Low–medium |
| TH-18 | **Fraudulent external payment requests** ("pay deposit here", fake Vipps/bank pages) | S | 3/2 | UI states Laandet never sends payment links and never holds money. Message warning when a URL or "betal" pattern is detected (Phase 02). Guidance in *Trygg utleie*. Report button. | Medium. A common scam pattern on Norwegian marketplaces; keep visible education. |
| TH-19 | **Review manipulation** (fake reviews, retaliation, review trading) | T, R | 2/2 | reviews only after a genuine completed booking between two accounts, one per party, double-blind publication, report abusive reviews, statistics only from real bookings, staff monitor for clusters of new accounts reviewing each other | Low–medium |
| TH-20 | **Admin account compromise** | E | 1/3 | mandatory TOTP, short sessions, re-auth for sensitive actions, notification of role changes, audit log, no bulk export, no impersonation | Low |
| TH-21 | **Insider misuse** (staff reads private disputes without need) | I | 1/3 | grants with reason and expiry, audit of each view, parties informed when support reviews their case | Low |
| TH-22 | **Data loss / backup failure** | D | 2/3 | nightly encrypted off-site backups, retention policy, monthly restore test, pre-deploy dump, Hetzner server backups (optional) | Low after first verified restore |
| TH-23 | **Denial of service** (upload floods, expensive searches) | D | 2/2 | Caddy request size limits, upload limits, rate limits, search query limits (max 100 chars, indexed filters), pagination cap | Medium (single server). Cloudflare proxy can be added if needed. |
| TH-24 | **Dependency or supply-chain compromise** | T, E | 1/3 | lockfile, Dependabot, audit + OSV in CI, pinned base image digests, minimal dependencies | Low–medium |
| TH-25 | **Harassment / stalking** via messaging or profiles | — | 2/3 | conversations only about listings, blocking, reporting, no public exact location, display name may be a first name + initial, moderators can restrict accounts | Medium. Community scale makes people recognisable. |
| TH-26 | **Repudiation of agreements** ("I never accepted that") | R | 2/2 | immutable snapshots + hashes, acceptance per party with timestamp, booking event history, append-only privileges | Low |
| TH-27 | **Tampering with condition evidence** | T, R | 2/3 | append-only entries per author, supersede chain instead of edits, photo hashes, confirmations bound to entry sequence | Low |
| TH-28 | **Minors using the service** | — | 2/2 | 18+ self-declaration (honestly shown as self-declared), terms forbid use by minors, reportable | Medium: cannot be verified without BankID (Phase 05) |
| TH-29 | **Defamation via disputes** (pending complaint presented as a crime) | — | 2/2 | disputes are visible only to the parties and staff, never public. Profiles never show accusations. Neutral wording ("sak under behandling"). Negative test. | Low |

## 5. Abuse cases tested end-to-end (see `TEST_STRATEGY.md` §4)

1. User A edits user B's listing → 404.
2. User A opens user B's conversation by guessing the id → 404.
3. User C fetches a condition photo of booking A–B → 404.
4. The owner submits the renter's acceptance → rejected (service + database trigger).
5. A category B booking request → rejected (service + database `CHECK`).
6. A prohibited category listing → rejected. A restricted category without safety confirmation → rejected.
7. A user tries to "release" or "deduct" a deposit → no such endpoint. Deposit fields are read-only after acceptance.
8. Uploading an SVG with a script, an HTML file renamed to `.jpg`, or a decompression bomb → rejected.
9. Message `<img src=x onerror=alert(1)>` → rendered as text, no execution, no CSP violation.
10. A suspended user's old session cookie → signed out.
11. Registering and publishing without donating → works (the donation is never required).
12. An open dispute is not visible on any public profile or listing.

## 6. Out of scope for the MVP (accepted risks, revisit in Phase 05)

- Strong identity of participants (BankID). Mitigated by the category A cap.
- Insurance for damage or theft. Communicated clearly to users.
- Payment fraud protection. Laandet does not handle money; the risk is communicated.
- DDoS beyond what a single server and Caddy limits can absorb.
