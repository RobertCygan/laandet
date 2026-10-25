# P03-05 — Security test pass and OWASP ASVS Level 1 checklist

## GOAL
Before the beta, every security requirement has a known status, and the gaps are fixed or written down.

## CONTEXT
- `docs/SECURITY.md` (SEC-01 … SEC-63), `docs/THREAT_MODEL.md`, `docs/TEST_STRATEGY.md` §4 (N1–N15).

## INPUT
- The application after P03-01 … P03-04, P03-06, P03-07.

## OUTPUT
1. `docs/SECURITY_VERIFICATION.md`: each SEC requirement with status (verified by an automated test / verified manually / open / needs the server) and where the evidence is.
2. `docs/ASVS_L1.md`: the OWASP ASVS 4.0.3 Level 1 requirements that apply, with status and evidence.
3. An independent read-only review of the Phase 02–03 code (separate agent, not anchored on the implementer's view). Every finding is fixed with a test, or recorded with a reason.
4. Missing negative tests added: N6 (no deposit endpoint, deposit immutable after acceptance), N10, N12, N15, SEC-21 (extra fields rejected), SEC-22 (foreign `Origin` refused), SEC-42 (generic error page with a request id), SEC-43 (no secrets or message text in logs).

## CONSTRAINTS
- Report only what ran. «Needs the server» items stay open until Phase 04.

## TESTS
- All new tests green in CI. The two documents list their evidence.
