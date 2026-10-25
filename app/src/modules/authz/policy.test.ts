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
const moderator = testUser({ id: OTHER, role: "moderator", staff2fa: true });
const moderatorNo2fa = testUser({ id: OTHER, role: "moderator", staff2fa: false });
const moderatorStale = testUser({ id: OTHER, role: "moderator", staff2fa: true, staffSessionFresh: false });
const admin = testUser({ id: OTHER, role: "admin", staff2fa: true });

const listing = (status: "draft" | "published" | "removed" = "published"): Resource => ({
  type: "listing",
  ownerId: OWNER,
  status,
});

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
