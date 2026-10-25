import type { ListingStatus } from "@/db/schema";
import { AppError, type ErrorCode } from "@/modules/errors";
import type { Actor, UserActor } from "./actor-types";

/**
 * Central authorisation (docs/AUTH_MODEL.md §4–5). Every service calls `can`/`assertCan`
 * before reading private data or writing. Ownership always comes from the database.
 */
export type Action =
  | "listing.view"
  | "listing.create"
  | "listing.update"
  | "listing.publish"
  | "listing.delete"
  | "media.upload"
  | "profile.update"
  | "account.delete"
  | "savedListing.toggle"
  | "report.create"
  | "categorySuggestion.create"
  | "appeal.create"
  | "admin.access"
  | "report.handle"
  | "listing.moderate"
  | "appeal.decide"
  | "category.policy"
  | "category.manage"
  | "flag.manage"
  | "role.grant"
  | "audit.view"
  // Phase 02
  | "conversation.start"
  | "conversation.read"
  | "message.send"
  | "user.block"
  | "booking.request"
  | "booking.view"
  | "booking.respond"
  | "booking.participate"
  | "claim.create"
  | "claim.view"
  | "claim.respond"
  | "claim.participate"
  // Phase 03
  | "dispute.open"
  | "dispute.view"
  | "dispute.participate"
  | "dispute.support"
  | "evidence.upload"
  | "review.write"
  | "review.moderate"
  | "user.moderate"
  | "account.export"
  | "metrics.view"
  | "locality.manage"
  | "legal.view"
  | "transparency.manage";

export type Resource =
  | { type: "none" }
  | { type: "listing"; ownerId: string; status: ListingStatus; isDemo?: boolean }
  | { type: "profile"; userId: string }
  | { type: "moderationAction"; affectedUserId: string }
  | {
      type: "appeal";
      appellantId: string;
      originalActorId: string;
      otherStaffAvailable: boolean;
    }
  | { type: "conversation"; participantIds: string[] }
  | { type: "booking"; ownerId: string; renterId: string }
  | { type: "claim"; giverId: string; claimantId: string }
  | { type: "dispute"; openerId: string; respondentId: string }
  | { type: "review"; authorId: string; subjectId: string };

export type Decision = { allow: true } | { allow: false; reason: ErrorCode };

const ALLOW: Decision = { allow: true };
const deny = (reason: ErrorCode): Decision => ({ allow: false, reason });

const NONE: Resource = { type: "none" };

function staffAccess(a: UserActor): Decision {
  if (a.role !== "moderator" && a.role !== "admin") return deny("forbidden");
  if (a.status !== "active") return deny("forbidden");
  if (!a.staff2fa) return deny("staff_2fa_required");
  if (!a.staffSessionFresh) return deny("staff_session_expired");
  return ALLOW;
}

/** Actions a suspended account may still perform. */
const ALLOWED_WHEN_SUSPENDED: ReadonlySet<Action> = new Set([
  "listing.view",
  "appeal.create",
  "booking.view",
  "claim.view",
  "dispute.view",
  "account.export",
]);
/**
 * A person waiting for erasure can still finish what is under way — return an item, confirm a handover, answer
 * a case — since erasure waits for exactly that (PRIVACY §6, security review L5).
 */
const ALLOWED_WHEN_DELETION_PENDING: ReadonlySet<Action> = new Set([
  ...ALLOWED_WHEN_SUSPENDED,
  "booking.participate",
  "claim.participate",
  "dispute.participate",
  "evidence.upload",
]);
/** Actions a restricted account may not perform (AUTH_MODEL §3). */
const DENIED_WHEN_RESTRICTED: ReadonlySet<Action> = new Set([
  "listing.create",
  "listing.publish",
  "media.upload",
  "categorySuggestion.create",
  "conversation.start",
  "booking.request",
  "claim.create",
]);
/** Actions that need a verified email (registered-but-unverified users are read-only). */
const NEEDS_VERIFIED_EMAIL: ReadonlySet<Action> = new Set([
  "listing.create",
  "listing.update",
  "listing.publish",
  "listing.delete",
  "media.upload",
  "categorySuggestion.create",
  "conversation.start",
  "message.send",
  "booking.request",
  "booking.respond",
  "booking.participate",
  "claim.create",
  "claim.respond",
  "claim.participate",
  "dispute.open",
  "dispute.participate",
  "evidence.upload",
  "review.write",
]);

export function can(actor: Actor, action: Action, resource: Resource = NONE): Decision {
  // Anyone may view a published listing.
  if (action === "listing.view" && resource.type === "listing" && resource.status === "published") {
    return ALLOW;
  }
  if (actor.kind === "anonymous") return deny("auth_required");
  if (actor.status === "deleted") return deny("auth_required");
  if (actor.status === "suspended" && !ALLOWED_WHEN_SUSPENDED.has(action)) return deny("account_restricted");
  if (actor.status === "deletion_pending" && !ALLOWED_WHEN_DELETION_PENDING.has(action)) {
    return deny("account_restricted");
  }
  if (actor.status === "restricted" && DENIED_WHEN_RESTRICTED.has(action)) {
    return deny("account_restricted");
  }
  if (!actor.emailVerified && NEEDS_VERIFIED_EMAIL.has(action)) return deny("email_unverified");

  switch (action) {
    case "listing.view": {
      if (resource.type !== "listing") return deny("not_found");
      if (resource.ownerId === actor.id) return ALLOW;
      return staffAccess(actor).allow ? ALLOW : deny("not_found");
    }
    case "listing.create":
    case "media.upload":
    case "savedListing.toggle":
    case "report.create":
    case "categorySuggestion.create":
    case "account.delete":
      return ALLOW;
    case "listing.update":
    case "listing.publish":
    case "listing.delete": {
      if (resource.type !== "listing" || resource.ownerId !== actor.id) return deny("not_found");
      if (resource.isDemo) return deny("forbidden");
      if (resource.status === "deleted") return deny("not_found");
      // A listing hidden by a moderator can only come back through an appeal.
      if (resource.status === "removed" && action !== "listing.delete") return deny("forbidden");
      return ALLOW;
    }
    case "profile.update":
      return resource.type === "profile" && resource.userId === actor.id ? ALLOW : deny("not_found");
    case "appeal.create":
      return resource.type === "moderationAction" && resource.affectedUserId === actor.id ? ALLOW : deny("not_found");
    case "admin.access":
      return staffAccess(actor);
    case "report.handle":
    case "category.policy":
      return staffAccess(actor);
    case "listing.moderate": {
      const s = staffAccess(actor);
      if (!s.allow) return s;
      // Staff never moderate their own content.
      if (resource.type === "listing" && resource.ownerId === actor.id) return deny("forbidden");
      return ALLOW;
    }
    case "appeal.decide": {
      const s = staffAccess(actor);
      if (!s.allow) return s;
      if (resource.type !== "appeal") return deny("not_found");
      if (resource.appellantId === actor.id) return deny("forbidden");
      if (resource.originalActorId === actor.id && resource.otherStaffAvailable) {
        return deny("forbidden");
      }
      return ALLOW;
    }
    // ---- Phase 02: only the parties themselves (a wrong party gets not_found, never a hint).
    case "conversation.start":
    case "booking.request":
    case "claim.create":
    case "user.block":
      return ALLOW;
    case "conversation.read":
    case "message.send":
      return resource.type === "conversation" && resource.participantIds.includes(actor.id) ? ALLOW : deny("not_found");
    case "booking.view":
    case "booking.participate":
      return resource.type === "booking" && (resource.ownerId === actor.id || resource.renterId === actor.id)
        ? ALLOW
        : deny("not_found");
    case "booking.respond":
      if (resource.type !== "booking" || (resource.ownerId !== actor.id && resource.renterId !== actor.id)) {
        return deny("not_found");
      }
      return resource.ownerId === actor.id ? ALLOW : deny("forbidden");
    case "claim.view":
    case "claim.participate":
      return resource.type === "claim" && (resource.giverId === actor.id || resource.claimantId === actor.id)
        ? ALLOW
        : deny("not_found");
    case "claim.respond":
      if (resource.type !== "claim" || (resource.giverId !== actor.id && resource.claimantId !== actor.id)) {
        return deny("not_found");
      }
      return resource.giverId === actor.id ? ALLOW : deny("forbidden");
    // ---- Phase 03
    case "account.export":
    // Condition and case photos: a restricted account still documents its own rentals (review L5). The
    // photo stays private to the uploader until the booking or case service attaches it for a party.
    case "evidence.upload":
      return ALLOW;
    case "dispute.open":
    case "review.write":
      // Only a party of the booking (the service checks status and deadlines).
      return resource.type === "booking" && (resource.ownerId === actor.id || resource.renterId === actor.id)
        ? ALLOW
        : deny("not_found");
    case "dispute.view":
    case "dispute.participate":
      return resource.type === "dispute" && (resource.openerId === actor.id || resource.respondentId === actor.id)
        ? ALLOW
        : deny("not_found");
    case "dispute.support": {
      // Staff facilitation; the time-boxed grant is checked by the service. Never in a case of one's own.
      const s = staffAccess(actor);
      if (!s.allow) return s;
      if (resource.type === "dispute" && (resource.openerId === actor.id || resource.respondentId === actor.id))
        return deny("forbidden");
      return ALLOW;
    }
    case "review.moderate": {
      const s = staffAccess(actor);
      if (!s.allow) return s;
      if (resource.type === "review" && (resource.authorId === actor.id || resource.subjectId === actor.id))
        return deny("forbidden");
      return ALLOW;
    }
    case "user.moderate": {
      const s = staffAccess(actor);
      if (!s.allow) return s;
      if (resource.type === "profile" && resource.userId === actor.id) return deny("forbidden");
      return ALLOW;
    }
    case "metrics.view":
      return staffAccess(actor);
    case "category.manage":
    case "flag.manage":
    case "role.grant":
    case "audit.view":
    case "locality.manage":
    case "legal.view":
    case "transparency.manage": {
      const s = staffAccess(actor);
      if (!s.allow) return s;
      return actor.role === "admin" ? ALLOW : deny("forbidden");
    }
  }
}

export function assertCan(actor: Actor, action: Action, resource?: Resource): asserts actor is UserActor {
  const d = can(actor, action, resource);
  if (!d.allow) throw new AppError(d.reason);
}
