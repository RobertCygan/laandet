# P01-05 — Authentication and email outbox

## GOAL
Users can register with email and password, verify their email, sign in and out, reset their password and request
account deletion. All of this is secure, rate-limited and localised.

## CONTEXT
- Policy: `docs/AUTH_MODEL.md` §1, `docs/SECURITY.md` SEC-10…14, D-007, D-008, D-010.
- Better Auth runs in the same app and database (tables from P01-04).

## INPUT
- Better Auth 1.7.x with:
  - `emailAndPassword` (`requireEmailVerification: true`)
  - email verification
  - password reset
  - `haveIBeenPwned` plugin
  - rate limit with `storage: 'database'`
  - `twoFactor` plugin (staff)
  - optional `passkey` plugin behind the `passkeys` flag
- SMTP settings from env. Mailpit in development and CI.

## OUTPUT
1. `src/modules/auth/auth.ts` (Better Auth config):
   - cookies prefixed `__Host-laandet.*`, `HttpOnly`, `Secure`, `SameSite=Lax`;
   - `trustedOrigins` = `BETTER_AUTH_URL`;
   - session lifetime 30 days, rolling;
   - min password length 10, max 128.
2. **Pages (nb/en):**

   | Page | Path |
   |---|---|
   | Opprett konto | `/registrer` |
   | Logg inn | `/logg-inn` |
   | Bekreft e-post | `/bekreft-epost` |
   | Glemt passord | `/glemt-passord` |
   | Nytt passord | `/nytt-passord` |

   The sign-up form has: display name (2–40 characters), email, password, optional locality, and three required checkboxes (18+, private use, terms + privacy with links).
3. **Sign-up service:**
   - writes `user_profiles` with `age_18_confirmed_at` and `private_use_confirmed_at`;
   - writes `legal_acceptances` for the current `terms` and `privacy` versions;
   - writes an audit event.
4. **Bot protection:** hidden honeypot field and minimum fill time (3 s). The `registrations_open` flag is respected.
5. **`getActor()` helper:**
   - Loads session, profile status, role and verification level on every request.
   - Treats `suspended`, `deletion_pending` and `deleted` as signed out, except on the appeal and data pages.
6. **Sign-out and sign-out-everywhere.**
7. **Account deletion request:**
   - re-authentication;
   - status set to `deletion_pending`;
   - sessions revoked;
   - listings hidden;
   - confirmation email;
   - the erasure job itself is P03-06.
8. **Email:**
   - `email_outbox` writer (in the same transaction);
   - minimal `worker/` that sends due outbox rows via SMTP with retries;
   - templates in nb/en: verify email, reset password, password changed, deletion requested.
   - Emails contain no secrets beyond the single-use link.
9. **Generic responses:**
   - sign-in failure: «Feil e-post eller passord»;
   - reset request: the same message whether the email exists or not;
   - sign-up with an existing email: the same "check your inbox" response (the existing user gets an informational email instead).

## CONSTRAINTS
- No custom cryptography or token formats.
- No email addresses, passwords or tokens in logs (SEC-43).
- The email verification link expires after 24 h and the reset link after 1 h. Both are single use.
- Rate limits per `AUTH_MODEL.md` §1.

## TESTS (acceptance criteria)
1. **Integration:**
   - sign-up stores all three confirmations with timestamps and the legal acceptances;
   - a missing checkbox → validation error, no user row.
2. **Integration (N3):** an unverified user calling the publish-listing action is rejected. Calling it after verification works.
3. **Integration:**
   - the verification link works once; the second use fails;
   - an expired link fails.
4. **Integration:** a password reset revokes all other sessions; the old session cookie is rejected on the next request.
5. **Integration:**
   - 6 failed sign-ins for one email within 15 min → HTTP 429 and an audit row `auth.rate_limited`;
   - a breached password (`password123456`) is rejected.
6. **Integration (N10):**
   - a session belonging to a user whose status was set to `suspended` is rejected;
   - same for a user who requested deletion.
7. **Integration:** a filled honeypot or a submit faster than 3 s → rejected without creating a user.
8. **e2e (mobile):** register → open the verification email in Mailpit → verified → sign out → sign in → see «Min profil».
9. Emails render in nb and en, and the language follows the user's choice.
