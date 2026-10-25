# P01-01 — Project scaffold, tooling, CI and security headers

## GOAL
Create the Laandet application skeleton in `laandet/app/`. It must build, lint, type-check, test and run locally,
with CI and baseline security headers from the first commit.

## CONTEXT
- No application code exists. `www/` is a separate G-PSI site and must not be touched (D-002).
- Stack decision: D-004 (Next.js 16, TypeScript strict, Tailwind 4, Drizzle, Better Auth, next-intl, Vitest, Playwright).
- Target structure: `docs/ARCHITECTURE.md` §3.

## INPUT
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md` (SEC-01…03, SEC-40, SEC-60, SEC-61), `docs/TEST_STRATEGY.md` §6.
- Versions checked on 25.10.2026, to be pinned exactly in `package.json`: next 16.4.x, react 19.x, tailwindcss 4.3.x,
  drizzle-orm 0.45.x, better-auth 1.7.x, next-intl 4.x, sharp 0.35.x, zod 4.x, vitest, @playwright/test.
- Node 22 LTS.

## OUTPUT
1. `laandet/app/` Next.js App Router project:
   - `src/` layout as in ARCHITECTURE §3, with empty module folders;
   - `package.json` with exact versions and scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `db:migrate`, `db:seed`.
2. `tsconfig.json` with `strict`, `noUncheckedIndexedAccess` and path alias `@/`.
3. ESLint (flat config):
   - `typescript-eslint` strict;
   - `react-hooks`;
   - `no-restricted-syntax` banning `dangerouslySetInnerHTML` except in `src/ui/LegalMarkdown.tsx`, and banning `sql.raw`;
   - `no-restricted-imports` so that `src/app/**` cannot import `@/db`.
4. Prettier config.
5. `src/modules/config/env.ts`:
   - Zod-validated environment: `APP_ENV`, `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SMTP_*`, `MEDIA_DIR`, `IP_HASH_KEY`, optional `SENTRY_DSN`, `SUPPORT_CAMPAIGN_URL`.
   - The app fails fast with a clear message if anything is missing.
6. `.env.example` with names only.
7. `compose.dev.yaml` with `postgres:17` (with `pg_trgm`, `btree_gist`) and `axllent/mailpit`, both pinned by digest.
8. `src/proxy.ts` (Next.js 16 request proxy, formerly middleware):
   - per-request CSP nonce, with the CSP from SEC-03;
   - other headers from SEC-02 (Caddy duplicates HSTS in production).
9. `src/app/healthz/route.ts` returns 200 with `{ db: "ok" }` after `SELECT 1`, and 503 otherwise.
10. Vitest config with two projects (unit, integration). Playwright config with `mobile` (390×844) and `desktop` (1280×900) projects.
11. `.github/workflows/laandet-ci.yml` with `paths: ['laandet/**']`:
    - jobs `lint`, `typecheck`, `unit`, `build`, `security` (gitleaks, `npm audit --audit-level=high`, OSV-Scanner);
    - placeholders for the `db`, `integration` and `e2e` jobs that later tasks add.
12. `.github/dependabot.yml` entry for `/laandet/app` (npm, weekly, security updates).
13. `laandet/app/README.md`: how to run locally.

## CONSTRAINTS
- No secrets in the repository. gitleaks must pass.
- No dependency beyond the stack in D-004 without a note in `DECISIONS.md`.
- The CI workflow must not run on changes outside `laandet/**` and must not modify `www/`.
- No analytics or third-party scripts.

## TESTS (acceptance criteria)
1. `npm run lint`, `npm run typecheck`, `npm run test:unit` (≥ 1 sample test plus env-validation tests) and `npm run build` succeed locally and in CI.
2. **Unit:** the env module throws on a missing `DATABASE_URL` and on a too-short `BETTER_AUTH_SECRET` (< 32 bytes).
3. **Playwright smoke (mobile + desktop):**
   - the home placeholder renders;
   - the response has a `Content-Security-Policy` header containing `'nonce-`, `frame-ancestors 'none'` and `object-src 'none'`;
   - `X-Content-Type-Options: nosniff` is present.
4. `/healthz` returns 200 with the dev database up, and 503 when the database is stopped.
5. The CI `security` job runs and passes on the scaffold.
