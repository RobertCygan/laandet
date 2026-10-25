import { describe, expect, it } from "vitest";
import { testUser, type Actor } from "./actor-types";
import { can, type Action, type Resource } from "./policy";

const OWNER = "00000000-0000-0000-0000-00000000000a";
const OTHER = "00000000-0000-0000-0000-00000000000b";

const anon: Actor = { kind: "anonymous" };
const member = testUser({ id: OWNER });
const otherMember = testUser({ id: OTHER });
const unverified = testUser({ id: OWNER, emailVerified: false });
const restricted = testUser({ id: OWNER, status: "restricted" });
const suspended = testUser({ id: OWNER, status: "suspended" });
const leaving = testUser({ id: OWNER, status: "deletion_pending" });
const moderator = testUser({ id: OTHER, role: "moderator", staff2fa: true });
const moderatorNo2fa = testUser({ id: OTHER, role: "moderator", staff2fa: false });
const moderatorStale = testUser({ id: OTHER, role: "moderator", staff2fa: true, staffSessionFresh: false });
const admin = testUser({ id: OTHER, role: "admin", staff2fa: true });

const listing = (status: "draft" | "published" | "removed" = "published"): Resource => ({
  type: "listing",
  ownerId: OWNER,
  status,
});

const THIRD = "00000000-0000-0000-0000-00000000000c";
const stranger = testUser({ id: THIRD });
const moderator3 = testUser({ id: THIRD, role: "moderator", staff2fa: true });
const booking = (): Resource => ({ type: "booking", ownerId: OWNER, renterId: OTHER });
const dispute = (): Resource => ({ type: "dispute", openerId: OWNER, respondentId: OTHER });

type Row = [string, Actor, Action, Resource | undefined, boolean, string?];

const rows: Row[] = [
  ["anyone views a published listing", anon, "listing.view", listing("published"), true],
  ["visitor cannot view a draft", anon, "listing.view", listing("draft"), false, "auth_required"],
  ["owner views own draft", member, "listing.view", listing("draft"), true],
  ["other member cannot view a draft (404)", otherMember, "listing.view", listing("draft"), false, "not_found"],
  ["staff can view a draft", moderator, "listing.view", listing("draft"), true],
  ["visitor cannot create listings", anon, "listing.create", undefined, false, "auth_required"],
  ["unverified cannot create listings", unverified, "listing.create", undefined, false, "email_unverified"],
  ["verified member creates listings", member, "listing.create", undefined, true],
  ["restricted cannot create listings", restricted, "listing.create", undefined, false, "account_restricted"],
  ["suspended cannot create listings", suspended, "listing.create", undefined, false, "account_restricted"],
  ["owner updates own listing", member, "listing.update", listing(), true],
  ["N1: user A cannot edit user B's listing", otherMember, "listing.update", listing(), false, "not_found"],
  ["N1: user A cannot delete user B's listing", otherMember, "listing.delete", listing(), false, "not_found"],
  ["owner cannot republish a removed listing", member, "listing.publish", listing("removed"), false, "forbidden"],
  ["owner can delete a removed listing", member, "listing.delete", listing("removed"), true],
  [
    "demo listings are not editable",
    member,
    "listing.update",
    { ...listing(), isDemo: true } as Resource,
    false,
    "forbidden",
  ],
  ["unverified cannot upload", unverified, "media.upload", undefined, false, "email_unverified"],
  ["restricted cannot upload", restricted, "media.upload", undefined, false, "account_restricted"],
  ["registered (unverified) may report", unverified, "report.create", undefined, true],
  ["restricted may still report", restricted, "report.create", undefined, true],
  ["visitor cannot report", anon, "report.create", undefined, false, "auth_required"],
  ["user updates own profile", member, "profile.update", { type: "profile", userId: OWNER }, true],
  [
    "user cannot update another profile",
    otherMember,
    "profile.update",
    { type: "profile", userId: OWNER },
    false,
    "not_found",
  ],
  [
    "suspended user may appeal own action",
    suspended,
    "appeal.create",
    { type: "moderationAction", affectedUserId: OWNER },
    true,
  ],
  [
    "user cannot appeal someone else's action",
    otherMember,
    "appeal.create",
    { type: "moderationAction", affectedUserId: OWNER },
    false,
    "not_found",
  ],
  ["member has no admin access", member, "admin.access", undefined, false, "forbidden"],
  [
    "N14: moderator without 2FA has no admin access",
    moderatorNo2fa,
    "admin.access",
    undefined,
    false,
    "staff_2fa_required",
  ],
  [
    "moderator with stale session must sign in again",
    moderatorStale,
    "admin.access",
    undefined,
    false,
    "staff_session_expired",
  ],
  ["moderator with 2FA has admin access", moderator, "admin.access", undefined, true],
  ["moderator handles reports", moderator, "report.handle", undefined, true],
  ["moderator moderates others' listings", moderator, "listing.moderate", listing(), true],
  [
    "staff never moderate own listing",
    testUser({ id: OWNER, role: "moderator", staff2fa: true }),
    "listing.moderate",
    listing(),
    false,
    "forbidden",
  ],
  ["moderator cannot manage flags", moderator, "flag.manage", undefined, false, "forbidden"],
  ["admin manages flags", admin, "flag.manage", undefined, true],
  ["admin grants roles", admin, "role.grant", undefined, true],
  ["moderator cannot grant roles", moderator, "role.grant", undefined, false, "forbidden"],
  // ---- Phase 03
  ["a booking party opens a dispute", member, "dispute.open", booking(), true],
  ["a stranger cannot open a dispute (404)", stranger, "dispute.open", booking(), false, "not_found"],
  ["unverified cannot open a dispute", unverified, "dispute.open", booking(), false, "email_unverified"],
  ["a party reads the case", otherMember, "dispute.view", dispute(), true],
  ["a stranger cannot read the case (404)", stranger, "dispute.view", dispute(), false, "not_found"],
  ["staff cannot read a case as a party would (404)", moderator3, "dispute.view", dispute(), false, "not_found"],
  ["suspended party can still read the case", suspended, "dispute.view", dispute(), true],
  ["suspended party cannot add to the case", suspended, "dispute.participate", dispute(), false, "account_restricted"],
  ["restricted party can still take part", restricted, "dispute.participate", dispute(), true],
  ["staff facilitate a case", moderator3, "dispute.support", dispute(), true],
  ["staff never facilitate their own case", moderator, "dispute.support", dispute(), false, "forbidden"],
  [
    "moderator without 2FA cannot facilitate",
    moderatorNo2fa,
    "dispute.support",
    dispute(),
    false,
    "staff_2fa_required",
  ],
  ["members cannot facilitate", stranger, "dispute.support", dispute(), false, "forbidden"],
  ["a party writes a review", member, "review.write", booking(), true],
  ["a stranger cannot write a review", stranger, "review.write", booking(), false, "not_found"],
  [
    "staff moderate reviews",
    moderator3,
    "review.moderate",
    { type: "review", authorId: OWNER, subjectId: OTHER },
    true,
  ],
  [
    "staff never moderate a review about themselves",
    moderator,
    "review.moderate",
    { type: "review", authorId: OWNER, subjectId: OTHER },
    false,
    "forbidden",
  ],
  ["staff restrict a user", moderator, "user.moderate", { type: "profile", userId: OWNER }, true],
  [
    "staff never moderate themselves",
    moderator,
    "user.moderate",
    { type: "profile", userId: OTHER },
    false,
    "forbidden",
  ],
  ["a member cannot moderate users", member, "user.moderate", { type: "profile", userId: OTHER }, false, "forbidden"],
  ["a suspended user can still export their data", suspended, "account.export", undefined, true],
  // L5: a restricted account still documents its rentals; an account waiting for erasure finishes them.
  ["restricted may upload condition and case photos", restricted, "evidence.upload", undefined, true],
  ["unverified cannot upload evidence", unverified, "evidence.upload", undefined, false, "email_unverified"],
  ["suspended cannot upload evidence", suspended, "evidence.upload", undefined, false, "account_restricted"],
  ["deletion pending finishes a booking", leaving, "booking.participate", booking(), true],
  ["deletion pending answers a case", leaving, "dispute.participate", dispute(), true],
  ["deletion pending uploads evidence", leaving, "evidence.upload", undefined, true],
  ["deletion pending cannot request a booking", leaving, "booking.request", undefined, false, "account_restricted"],
  ["deletion pending cannot upload listing photos", leaving, "media.upload", undefined, false, "account_restricted"],
  ["suspended cannot take part in a booking", suspended, "booking.participate", booking(), false, "account_restricted"],
  ["a visitor cannot export data", anon, "account.export", undefined, false, "auth_required"],
  ["moderators see platform metrics", moderator, "metrics.view", undefined, true],
  ["moderators cannot manage localities", moderator, "locality.manage", undefined, false, "forbidden"],
  ["admins manage localities", admin, "locality.manage", undefined, true],
  ["moderators cannot see legal versions admin", moderator, "legal.view", undefined, false, "forbidden"],
  ["moderators cannot enter transparency figures", moderator, "transparency.manage", undefined, false, "forbidden"],
  ["admins enter transparency figures", admin, "transparency.manage", undefined, true],
  ["moderators set category policy", moderator, "category.policy", undefined, true],
  ["moderators cannot edit categories otherwise", moderator, "category.manage", undefined, false, "forbidden"],
  ["moderators cannot view the audit log", moderator, "audit.view", undefined, false, "forbidden"],
  [
    "original decider cannot decide the appeal when other staff exist",
    moderator,
    "appeal.decide",
    { type: "appeal", appellantId: OWNER, originalActorId: OTHER, otherStaffAvailable: true },
    false,
    "forbidden",
  ],
  [
    "original decider may decide when they are the only staff",
    moderator,
    "appeal.decide",
    { type: "appeal", appellantId: OWNER, originalActorId: OTHER, otherStaffAvailable: false },
    true,
  ],
  [
    "another staff member decides the appeal",
    admin,
    "appeal.decide",
    {
      type: "appeal",
      appellantId: OWNER,
      originalActorId: "00000000-0000-0000-0000-00000000000c",
      otherStaffAvailable: true,
    },
    true,
  ],
];

describe("authorisation matrix (AUTH_MODEL.md §4)", () => {
  it.each(rows)("%s", (_name, actor, action, resource, allowed, reason) => {
    const d = can(actor, action, resource);
    expect(d.allow).toBe(allowed);
    if (!d.allow && reason) expect(d.reason).toBe(reason);
  });
});
