# Laandet

**Lei, lån bort, ønsk deg og gi bort ting – lokalt i Steigen.**
*Rent, lend, request and give away things — locally in Steigen.*

Laandet is a community peer-to-peer marketplace for physical items, starting in Steigen kommune, Norway.
It is an independent project in the **G-PSI.ai** portfolio.

## Status

| Item | Status (25.10.2026) |
|---|---|
| Visual prototype (`../Laanndet.html`) | Exists. Static demo with fictional data (see `docs/CURRENT_STATE_ASSESSMENT.md`) |
| **Phase 00:** inventory, architecture, data model, threat model, legal drafts, roadmap | **Approved by the owner** on 25.10.2026 (D-001…D-029 accepted) |
| **Phase 01:** accounts, listings, uploads, explore, legal pages, reporting (`app/`) | **Approved by the owner** on 25.10.2026. Tested locally and in CI. |
| **Phase 02:** messages, rental requests and bookings, agreements, giveaway claims, condition reports, worker jobs and notices | **Approved by the owner** on 25.10.2026. Tested locally and in CI. Rentals stay closed (`rentals_open` off) until the owner opens them. See `docs/CHANGELOG.md`. |
| Deployment (staging/production) | **Not deployed.** Deploy files and runbooks exist (`deploy/`, `docs/runbooks/`) and were tested locally with Docker. A server and domain must first be bought by the owner. |
| Database reference schema | Designed. **Validated:** applied to PostgreSQL 16 and 23/23 checks passed (`docs/DATA_MODEL.md` §9) |
| Legal drafts (nb authoritative, en informational) | **Drafts. Not legally reviewed. Must not be used with real users before review.** |
| Target | Public pilot 14.12.2026, subject to the gates in `docs/DEVELOPMENT_ROADMAP.md` |

We distinguish *planned → designed → implemented → tested → verified → approved → released* and never claim a
later stage than reached.

## Folder layout

```
laandet/
├─ README.md                    this file
├─ docs/                        project documentation (English)
│  ├─ MASTER_SPECIFICATION.md   owner's master prompt (verbatim) + amendments
│  ├─ CURRENT_STATE_ASSESSMENT.md  what exists, what works, what to reuse
│  ├─ DECISIONS.md              ADR log (D-001 … D-041); D-001…D-029 accepted 25.10.2026
│  ├─ ARCHITECTURE.md           smallest viable secure architecture
│  ├─ DATA_MODEL.md             entities, state machines, privileges, validation record
│  ├─ AUTH_MODEL.md             authentication + authorisation matrix
│  ├─ SECURITY.md               security requirements SEC-01 … SEC-63
│  ├─ THREAT_MODEL.md           assets, actors, 29 threats with controls
│  ├─ CONDITION_REPORTS.md      handover/return condition report design
│  ├─ RENTAL_AGREEMENTS.md      agreement selection, snapshots, acceptance, deposit rules
│  ├─ DISPUTE_POLICY.md         dispute workflow design
│  ├─ PROHIBITED_ITEMS.md       category taxonomy, prohibited/restricted rules
│  ├─ PRIVACY.md                records of processing, retention, DPIA screening, cookies
│  ├─ SUPPORT_AND_FUNDING.md    «Støtt Laandet» and transparency page
│  ├─ LEGAL_REVIEW_CHECKLIST.md verified facts vs assumptions vs questions for a lawyer
│  ├─ OPERATING_COSTS.md        monthly cost model (100 / 500 / 2 000 / 10 000 users)
│  ├─ TEST_STRATEGY.md          test pyramid, mandatory negative tests, CI
│  ├─ DEVELOPMENT_ROADMAP.md    timeline to 14.12.2026, MVP scope, release gates, owner decisions
│  ├─ GLOSSARY.md               nb ↔ en product terms
│  └─ CHANGELOG.md
├─ legal/
│  ├─ nb/                       Norwegian legal drafts (authoritative)
│  └─ en/                       English informational translations
├─ db/
│  ├─ schema-draft.sql          reference PostgreSQL schema (MVP)
│  └─ schema-checks.sql         executable invariant checks
├─ design/prototype/            assets extracted from the prototype (CSS, images, demo content)
├─ app/                         the web application (Next.js); see app/README.md
├─ deploy/                      Docker Compose, Caddy, backups (for the future server)
└─ tasks/                       development tasks (GOAL/CONTEXT/INPUT/OUTPUT/CONSTRAINTS/TESTS)
```

## Where to start

1. **Project owner:** read `docs/DEVELOPMENT_ROADMAP.md` §6 (decisions needed this week), then `docs/DECISIONS.md`.
2. **Lawyer:** read `docs/LEGAL_REVIEW_CHECKLIST.md`, then `legal/nb/`.
3. **Developer or AI assistant:** read `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/AUTH_MODEL.md` and
   `docs/SECURITY.md`, then `app/README.md` to run the application locally.

## Validate the reference schema locally

```bash
createdb laandet_schema_check
psql -v ON_ERROR_STOP=1 -d laandet_schema_check -f db/schema-draft.sql
psql -v ON_ERROR_STOP=1 -d laandet_schema_check -f db/schema-checks.sql   # ends with "ALL SCHEMA CHECKS PASSED"
```

## Principles (short)

- The platform is a meeting place. It is not an insurer, a payment institution, a deposit holder or a judge.
- Planned features are never presented as live. Example listings are always labelled.
- Security and privacy come first: server-side authorisation, least privilege, no tracking, data in the EU/EEA.
- Interface in Norwegian Bokmål (default) and English.
- Keep it simple: one app, one database, one server.
