# Laandet — Development Tasks

Every task uses the format from master spec §26:
- **GOAL**
- **CONTEXT**
- **INPUT**
- **OUTPUT**
- **CONSTRAINTS**
- **TESTS**

The project commands (`#PLAN`, `#BUILD`, `#TEST`, `#AUDIT`, `#DEBUG`, `#REFACTOR`, `#SECURITY`, `#RELEASE`) are
conventions for the person or AI assistant working on a task. They are not tool features.

**Definition of done:** master spec §27. A task is *done* only when its TESTS ran green in CI and the docs listed
under OUTPUT are updated. Report status precisely: planned → designed → implemented → tested → verified → approved → released.

## Phase 01 — Users and listings (weeks 44–46)

| ID | Task | Depends on | Estimate (ideal days) | Status |
|---|---|---|---|---|
| [P01-01](phase-01/P01-01-scaffold.md) | Project scaffold, tooling, CI, security headers | owner approves D-002/D-004 | 1.5 | planned |
| [P01-02](phase-01/P01-02-design-system.md) | Design system ported from the prototype | P01-01 | 2 | planned |
| [P01-03](phase-01/P01-03-i18n.md) | i18n foundation (nb + en, formats) | P01-01 | 0.5 | planned |
| [P01-04](phase-01/P01-04-database.md) | Database schema, migrations, roles, seeds | P01-01 | 1.5 | planned |
| [P01-05](phase-01/P01-05-authentication.md) | Authentication (Better Auth) and email outbox | P01-03, P01-04 | 2 | planned |
| [P01-06](phase-01/P01-06-authorization-audit.md) | Authorisation module and audit log | P01-04, P01-05 | 1 | planned |
| [P01-07](phase-01/P01-07-profiles.md) | Profiles and account settings | P01-05, P01-06 | 1 | planned |
| [P01-08](phase-01/P01-08-listings.md) | Listings for all three types | P01-02, P01-06, P01-09 | 3 | planned |
| [P01-09](phase-01/P01-09-image-uploads.md) | Image upload pipeline and media delivery | P01-04, P01-06 | 1.5 | planned |
| [P01-10](phase-01/P01-10-explore-search.md) | Explore, search, filters, listing detail | P01-08 | 2 | planned |
| [P01-11](phase-01/P01-11-content-legal-pages.md) | Content pages and legal document publishing | P01-02, P01-03 | 1.5 | planned |
| [P01-12](phase-01/P01-12-reporting-minimal.md) | Reporting and minimal moderation | P01-06, P01-08 | 1 | planned |
| [P01-13](phase-01/P01-13-deployment-backups.md) | Staging/production deploy, backups, runbooks | P01-01, owner buys server and domain | 1.5 | planned |

**Total: about 20 ideal days.** Week 44–46 has 15 working days, so the plan relies on AI-assisted speed-up and
parallel work (P01-11 and P01-13 can run alongside P01-05…P01-10). If Phase 01 is not accepted by
**15.11.2026** (gate G1), apply the scope cuts in `docs/DEVELOPMENT_ROADMAP.md` §3 (Should items first).

## Phase 02–04 (outline — detailed task files are written at the end of the previous phase)

| ID | Task |
|---|---|
| P02-01 | Conversations and messages (block, report, polling, email batching) |
| P02-02 | Rental requests and booking state machine (incl. the exclusion constraint) |
| P02-03 | Giveaway claims and transfer confirmation |
| P02-04 | Agreement generation, rendering, acceptance, revisions (`RENTAL_AGREEMENTS.md`) |
| P02-05 | Handover and return condition reports with photos (`CONDITION_REPORTS.md`) |
| P02-06 | Worker jobs: expiries, reminders, not-returned flow, notifications |
| P03-01 | Dispute workflow steps 1–6 (`DISPUTE_POLICY.md`) |
| P03-02 | Reviews (double-blind) |
| P03-03 | Moderation: full queue, actions, appeals, support access grants |
| P03-04 | Admin: categories, localities, feature flags, legal versions, metrics |
| P03-05 | Security test pass (`#SECURITY`), ASVS L1 checklist |
| P03-06 | Data export and retention jobs (`PRIVACY.md`) |
| P03-07 | Transparency page figures (owner input) |
| P04-01 | Closed beta with residents, feedback loop |
| P04-02 | Release gates: security, legal, restore test, mobile usability |
| P04-03 | DPIA document (short) |
| P04-04 | Production launch and pilot support rota |
