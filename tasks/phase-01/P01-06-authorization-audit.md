# P01-06 — Authorisation module and audit log

## GOAL
One central, testable place where every server-side permission decision is made, and an append-only audit trail of
security-relevant events.

## CONTEXT
- Matrix and rules: `docs/AUTH_MODEL.md` §2–6.
- Requirements: SEC-20, SEC-21, SEC-50, SEC-51.
- Database privileges come from P01-04.

## INPUT
- The `Actor` type and the `can()` signature in `AUTH_MODEL.md` §5.
- Phase 01 resources: profile, listing, listing image, saved listing, report, admin area, category, feature flag.

## OUTPUT
1. `src/modules/authz/`:
   - `can(actor, action, resource) → { allow } | { allow: false, reason }`
   - `assertCan(...)` throws a typed `ForbiddenError` or `NotFoundError`; NotFound is used when the resource does not belong to the actor.
   - Deny reasons map to localised messages.
2. Conventions:
   - Services receive `ctx.actor`.
   - Queries are actor-scoped.
   - Foreign ids return 404.
   - Documented in `docs/ARCHITECTURE.md` §3, with a code example.
3. `src/modules/audit/`:
   - `record(tx, { action, targetType, targetId, reason?, metadata? })`;
   - writes `ip_hash = HMAC-SHA256(ip, IP_HASH_KEY)`, never the raw IP;
   - request id taken from a header set by the proxy.
4. Staff guard for `/admin/**`:
   - role is `moderator` or `admin`, **and** 2FA is enabled and verified in this session;
   - session ≤ 8 h;
   - re-authentication helper for sensitive actions (10 min).
5. `scripts/grant-role.ts`:
   - CLI run on the server by the owner to bootstrap the first admin;
   - requires `--reason`;
   - writes audit and emails all admins.
   - There is **no** web UI to self-assign roles.

## CONSTRAINTS
- No permission logic in React components, only in services.
- No "impersonate user" feature.
- Audit metadata never contains message bodies, emails or addresses.

## TESTS (acceptance criteria)
1. **Unit:** table-driven tests covering every Phase 01 cell of the `AUTH_MODEL.md` §4 matrix, for anonymous, registered, member, moderator and admin, including restricted and suspended statuses.
2. **Integration (SEC-21):** submitting `role`, `status`, `email_verified` or `value_category` in any form payload is rejected by `.strict()` schemas or ignored, and the database values do not change.
3. **Integration:** audit rows exist after sign-in success, sign-in failure, password change and role grant. Their `ip_hash` is 64 hex characters and never equals the raw IP.
4. **Integration (N14):** a moderator without 2FA → `/admin` redirects to the 2FA setup page, and the admin server actions return 403.
5. **Integration:** the runtime role cannot update or delete audit rows (privilege test from P01-04 still green).
