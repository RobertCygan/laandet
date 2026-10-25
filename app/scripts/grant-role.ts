/**
 * Grant or revoke a staff role (AUTH_MODEL §2). Run on the server by the owner only:
 *   npm run grant-role -- --email ola@example.no --role moderator --reason "Pilot moderator, avtalt 25.10.2026"
 * Roles: user | moderator | admin. The change is audited and every other admin is emailed.
 * The new staff member must set up 2FA before /admin opens for them.
 */
import { parseArgs } from "node:util";
import { and, eq, inArray, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { queueEmail } from "../src/modules/notifications/outbox";

const ROLES = ["user", "moderator", "admin"] as const;

const { values } = parseArgs({
  options: { email: { type: "string" }, role: { type: "string" }, reason: { type: "string" } },
});
const email = values.email?.trim().toLowerCase();
const role = ROLES.find((r) => r === values.role);
const reason = values.reason?.trim();
if (!email || !role || !reason || reason.length < 10) {
  console.error('Usage: npm run grant-role -- --email <email> --role user|moderator|admin --reason "<at least 10 characters>"');
  process.exit(2);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle({ client: pool, schema, casing: "snake_case" });

async function main() {
  const [user] = await db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.userProfiles.role, status: schema.userProfiles.status })
    .from(schema.users)
    .innerJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id))
    .where(eq(schema.users.email, email!));
  if (!user) throw new Error("No account with that email");
  if (user.status !== "active") throw new Error(`Account status is ${user.status}; only active accounts can get a role`);
  if (user.role === role) {
    console.log(`No change: the account already has the role ${role}.`);
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.userProfiles).set({ role: role!, updatedAt: new Date() }).where(eq(schema.userProfiles.userId, user.id));
    // A role change ends existing sessions, so the new rights start with a fresh sign-in.
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    await tx.insert(schema.auditEvents).values({
      actorId: null,
      actorRole: "system",
      action: "role.grant",
      targetType: "user",
      targetId: user.id,
      reason: reason!,
      metadata: { from: user.role, to: role, via: "cli" },
    });
    const admins = await tx
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, locale: schema.userProfiles.locale })
      .from(schema.users)
      .innerJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id))
      .where(and(inArray(schema.userProfiles.role, ["admin"]), eq(schema.userProfiles.status, "active"), ne(schema.users.id, user.id)));
    for (const a of admins) {
      await queueEmail(tx, {
        toEmail: a.email,
        toUserId: a.id,
        template: "role_granted",
        locale: a.locale,
        payload: { name: a.name, subject: user.name, role: role!, reason: reason! },
      });
    }
  });
  console.log(`Role changed: ${user.role} → ${role}. Sessions ended; the user must sign in again${role === "user" ? "" : " and set up 2FA at /konto/tofaktor"}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
