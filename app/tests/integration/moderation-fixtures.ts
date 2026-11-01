import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { owner } from "./helpers";

/** Notification types a user has received (any kind, including moderation notices). */
export async function notificationsFor(userId: string) {
  const rows = await owner
    .select({ type: schema.notifications.type })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId));
  return rows.map((r) => r.type);
}
