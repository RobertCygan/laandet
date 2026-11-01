# P01-07 — Profiles and account settings

## GOAL
Members have a public profile with honest, real information and a private settings page («Min profil»).

## CONTEXT
- Master spec §8 (profile contents, never fabricated statistics or badges), D-010, D-014.
- Privacy rules in `docs/PRIVACY.md` §1.

## INPUT
- Tables `users`, `user_profiles`, `identity_verifications`, `listings`.
- The design components from P01-02.

## OUTPUT
1. **Public profile `/profil/[id]`:**
   - display name, locality, «Medlem siden oktober 2026», active published listings;
   - statistics only when real data exists: "Fullførte utleier: n" from Phase 02 bookings, response statistics only if measured;
   - otherwise the label «Ny på Laandet»;
   - an identity badge **only** for a `strong` + `verified` row (none in the MVP);
   - «Rapporter profil» (P01-12).
2. **`/konto` (Min profil):**
   - edit display name, locality, bio (≤ 500 characters, plain text), language;
   - email notifications on/off (essential emails such as security and agreements always go out);
   - change password and change email, both requiring re-authentication; email changes require re-verification of the new address;
   - «Logg ut fra alle enheter»;
   - «Slett konto» (flow from P01-05);
   - 2FA setup shown to staff only.
3. Profile edits are audited (action only, no values).

## CONSTRAINTS
- Email is never shown to other users.
- No exact address fields.
- A display name made only of an email address is rejected with a hint.
- All user text is rendered as plain text.

## TESTS (acceptance criteria)
1. **Integration:** user A cannot update user B's profile. A forged `userId` in the payload is ignored, and only the actor's own profile changes.
2. **Integration:** the public profile response or HTML contains no email address and no draft, paused or removed listings.
3. **Integration:** a new user's profile shows «Ny på Laandet» and no numeric statistics. A crafted database row with `level = 'basic'` shows no badge.
4. **e2e (mobile):** edit display name and locality, then see them on the public profile. Switch language to English and the profile labels change.
5. **e2e (N9 part):** the display name `<img src=x onerror=alert(1)>` is rejected or shown as text; no dialog opens.
