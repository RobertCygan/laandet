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
| [P01-01](phase-01/P01-01-scaffold.md) | Project scaffold, tooling, CI, security headers | owner approves D-002/D-004 | 1.5 | **approved** 25.10.2026 (CI green) |
| [P01-02](phase-01/P01-02-design-system.md) | Design system ported from the prototype | P01-01 | 2 | **approved** 25.10.2026 (CI green) |
| [P01-03](phase-01/P01-03-i18n.md) | i18n foundation (nb + en, formats) | P01-01 | 0.5 | **approved** 25.10.2026 (CI green) |
| [P01-04](phase-01/P01-04-database.md) | Database schema, migrations, roles, seeds | P01-01 | 1.5 | **approved** 25.10.2026 (CI green) |
| [P01-05](phase-01/P01-05-authentication.md) | Authentication (Better Auth) and email outbox | P01-03, P01-04 | 2 | **approved** 25.10.2026 (CI green) |
| [P01-06](phase-01/P01-06-authorization-audit.md) | Authorisation module and audit log | P01-04, P01-05 | 1 | **approved** 25.10.2026 (CI green) |
| [P01-07](phase-01/P01-07-profiles.md) | Profiles and account settings | P01-05, P01-06 | 1 | **approved** 25.10.2026 (CI green) |
| [P01-08](phase-01/P01-08-listings.md) | Listings for all three types | P01-02, P01-06, P01-09 | 3 | **approved** 25.10.2026 (CI green) |
| [P01-09](phase-01/P01-09-image-uploads.md) | Image upload pipeline and media delivery | P01-04, P01-06 | 1.5 | **approved** 25.10.2026 (CI green) |
| [P01-10](phase-01/P01-10-explore-search.md) | Explore, search, filters, listing detail | P01-08 | 2 | **approved** 25.10.2026 (CI green) |
| [P01-11](phase-01/P01-11-content-legal-pages.md) | Content pages and legal document publishing | P01-02, P01-03 | 1.5 | **approved** 25.10.2026 (CI green) |
| [P01-12](phase-01/P01-12-reporting-minimal.md) | Reporting and minimal moderation | P01-06, P01-08 | 1 | **approved** 25.10.2026 (CI green) |
| [P01-13](phase-01/P01-13-deployment-backups.md) | Staging/production deploy, backups, runbooks | P01-01, owner buys server and domain | 1.5 | files implemented; **not deployed** (needs server + domain) |

Status of 25.10.2026: see `docs/CHANGELOG.md` (Phase 01) for exactly what was tested and the known gaps per task.

**Total: about 20 ideal days.** Week 44–46 has 15 working days, so the plan relies on AI-assisted speed-up and
parallel work (P01-11 and P01-13 can run alongside P01-05…P01-10). If Phase 01 is not accepted by
**15.11.2026** (gate G1), apply the scope cuts in `docs/DEVELOPMENT_ROADMAP.md` §3 (Should items first).

## Phase 02 — Rentals and giveaways (weeks 47–48)

| ID | Task | Depends on | Estimate (ideal days) | Status |
|---|---|---|---|---|
| [P02-01](phase-02/P02-01-messaging.md) | Conversations and messages (block, report, polling, email batching) | P01 | 2 | approved |
| [P02-02](phase-02/P02-02-rental-requests-bookings.md) | Rental requests and the booking state machine (incl. the exclusion constraint) | P01 | 2.5 | approved |
| [P02-03](phase-02/P02-03-giveaway-claims.md) | Giveaway claims and transfer confirmation | P02-01, P02-04 | 1 | approved |
| [P02-04](phase-02/P02-04-agreements.md) | Agreement generation, rendering, acceptance, revisions | P02-02 | 2 | approved |
| [P02-05](phase-02/P02-05-condition-reports.md) | Handover and return condition reports with photos | P02-04 | 2.5 | approved |
| [P02-06](phase-02/P02-06-worker-notifications.md) | Worker jobs, reminders, in-app notifications, emails | P02-02…05 | 1 | approved |

## Phase 03 — Trust and moderation (week 49)

| ID | Task | Depends on | Estimate (ideal days) | Status |
|---|---|---|---|---|
| [P03-01](phase-03/P03-01-disputes.md) | Dispute workflow steps 1–6 with staff facilitation and access grants | P02 | 2.5 | approved |
| [P03-02](phase-03/P03-02-reviews.md) | Two-sided, double-blind reviews | P02 | 1 | approved |
| [P03-03](phase-03/P03-03-moderation.md) | Moderation: full queue, user measures, appeals, support access grants | P01-12 | 1.5 | approved |
| [P03-04](phase-03/P03-04-admin.md) | Admin: categories, localities, feature flags, legal versions, security log, metrics | P01 | 1.5 | approved |
| [P03-05](phase-03/P03-05-security.md) | Security test pass, ASVS L1 checklist | P03-01…07 | 1.5 | approved |
| [P03-06](phase-03/P03-06-data-export-retention.md) | Data export, retention jobs, account erasure | P02 | 1.5 | approved |
| [P03-07](phase-03/P03-07-transparency.md) | Transparency figures (owner input) | P03-04 | 0.5 | approved |

## Phase 04 — Beta, release gates and launch (week 50)

| ID | Task | Depends on | Estimate (ideal days) | Status |
|---|---|---|---|---|
| [P04-01](phase-04/P04-01-closed-beta.md) | Closed beta: «Gi tilbakemelding», staging banner, beta plan and tester guide | P03 | 1 | tested |
| [P04-02](phase-04/P04-02-release-gates.md) | Release gates: gate document, `release:check`, missing journeys, OSV-Scanner, «Vis passord», usability script | P03 | 1.5 | tested |
| [P04-03](phase-04/P04-03-dpia.md) | Short DPIA | P03 | 0.5 | written (draft) |
| [P04-04](phase-04/P04-04-launch-and-support.md) | Launch runbook, operations alerts, pilot support, moderator guide | P01-13 | 1 | tested |

Steps that need the server, the domain, a lawyer or beta testers are the owner's (marked «Eier» in the documents).
