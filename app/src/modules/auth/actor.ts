import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db/client";
import { userProfiles, users, type AccountStatus, type Role } from "@/db/schema";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { AppError } from "@/modules/errors";
import { auth } from "./auth";

const STAFF_SESSION_MS = 8 * 60 * 60 * 1000;
const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;
const SEEN_REFRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve the current actor from the session cookie, once per request.
 * Account status, role and verification come from the database on every request
 * (no cookie cache), so suspensions and role changes take effect immediately.
 */
export const getActor = cache(async (): Promise<Actor> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { kind: "anonymous" };
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      twoFactorEnabled: users.twoFactorEnabled,
      createdAt: users.createdAt,
      role: userProfiles.role,
      status: userProfiles.status,
      locale: userProfiles.locale,
      lastSeenAt: userProfiles.lastSeenAt,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, session.user.id));
  if (!row || row.status === "deleted") return { kind: "anonymous" };
  // Rolling sessions mean an active member may never sign in again; the inactivity job reads this instead.
  if (Date.now() - row.lastSeenAt.getTime() > SEEN_REFRESH_MS) {
    await db.update(userProfiles).set({ lastSeenAt: new Date() }).where(eq(userProfiles.userId, row.id));
  }
  const sessionCreated = new Date(session.session.createdAt).getTime();
  const actor: UserActor = {
    kind: "user",
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status as AccountStatus,
    locale: row.locale,
    emailVerified: row.emailVerified,
    idLevel: "none",
    staff2fa: row.twoFactorEnabled,
    staffSessionFresh: Date.now() - sessionCreated < STAFF_SESSION_MS,
    isNewAccount: Date.now() - row.createdAt.getTime() < NEW_ACCOUNT_MS,
    sessionId: session.session.id,
  };
  return actor;
});

export async function requireUser(): Promise<UserActor> {
  const actor = await getActor();
  if (actor.kind !== "user") throw new AppError("auth_required");
  return actor;
}
