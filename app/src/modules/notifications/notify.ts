import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { notifications, userProfiles, users } from "@/db/schema";
import { localePath } from "@/i18n/page";
import { env } from "@/modules/config/env";
import type { ActivityKind } from "./email-templates";
import { queueEmail } from "./outbox";

export type NotifyInput = {
  userId: string;
  kind: ActivityKind;
  /** Short label shown in the notice, e.g. the listing title (never message text). */
  title: string;
  /** In-app path without locale prefix, e.g. `/leieforhold/<id>`. */
  path: string;
  /**
   * Essential notices (agreements, bookings, claims) are emailed even when the user turned email
   * notifications off; optional ones (new messages) respect the setting (P01-07).
   */
  email: "essential" | "optional" | "none";
};

/** In-app notification plus, where appropriate, an email notice with a link (same transaction). */
export async function notify(db: DbOrTx, n: NotifyInput): Promise<void> {
  await db.insert(notifications).values({
    userId: n.userId,
    type: n.kind,
    payload: { title: n.title.slice(0, 120), path: n.path },
  });
  if (n.email === "none") return;
  const [u] = await db
    .select({
      email: users.email,
      name: users.name,
      locale: userProfiles.locale,
      opt: userProfiles.emailNotifications,
      status: userProfiles.status,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, n.userId));
  if (!u || !["active", "restricted"].includes(u.status)) return;
  if (n.email === "optional" && !u.opt) return;
  await queueEmail(db, {
    toEmail: u.email,
    toUserId: n.userId,
    template: "activity",
    locale: u.locale,
    payload: {
      name: u.name,
      kind: n.kind,
      title: n.title.slice(0, 120),
      url: `${env().APP_URL}${localePath(u.locale, n.path)}`,
    },
  });
}
