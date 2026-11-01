import "server-only";
import { notFound, redirect } from "next/navigation";
import { localePath } from "@/i18n/page";
import type { UserActor } from "@/modules/authz/actor-types";
import { can } from "@/modules/authz/policy";
import { getActor } from "./actor";

/** Page guard: signed-in user, otherwise to the sign-in page with a return path. */
export async function requirePageUser(locale: string, returnTo: string): Promise<UserActor> {
  const actor = await getActor();
  if (actor.kind !== "user") {
    redirect(`${localePath(locale, "/logg-inn")}?neste=${encodeURIComponent(localePath(locale, returnTo))}`);
  }
  return actor;
}

/**
 * Page guard for /admin: staff only (others get a 404), with 2FA and a fresh session (≤ 8 h).
 * Staff without 2FA are sent to the 2FA setup page.
 */
export async function requireStaffPage(locale: string): Promise<UserActor> {
  const actor = await requirePageUser(locale, "/admin");
  if (actor.role !== "moderator" && actor.role !== "admin") notFound();
  const decision = can(actor, "admin.access");
  if (decision.allow) return actor;
  if (decision.reason === "staff_2fa_required") redirect(localePath(locale, "/konto/tofaktor"));
  if (decision.reason === "staff_session_expired") {
    redirect(`${localePath(locale, "/logg-inn")}?utlopt=1&neste=${encodeURIComponent(localePath(locale, "/admin"))}`);
  }
  notFound();
}
