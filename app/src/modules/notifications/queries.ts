import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { ACTIVITY_KINDS, type ActivityKind } from "./email-templates";

/** Moderation notices are stored with the decision id; they link to the statement of reasons. */
const MODERATION_KINDS = ["listing_hidden", "account_measure", "appeal_decided", "restriction_ended"] as const;
type ModerationKind = (typeof MODERATION_KINDS)[number];

export type NotificationItem = {
  id: string;
  kind: ActivityKind | ModerationKind;
  title: string;
  path: string;
  readAt: Date | null;
  createdAt: Date;
};

/** In-app notices, newest first (P02-06). Only kinds we know how to show, and only internal paths. */
export async function listNotifications(actor: Actor, limit = 50): Promise<NotificationItem[]> {
  if (actor.kind !== "user") return [];
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, actor.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.flatMap((r): NotificationItem[] => {
    if ((MODERATION_KINDS as readonly string[]).includes(r.type)) {
      const actionId = String(r.payload.actionId ?? "");
      const path = /^[0-9a-f-]{36}$/i.test(actionId) ? `/moderering/${actionId}` : "/konto";
      return [{ id: r.id, kind: r.type as ModerationKind, title: "", path, readAt: r.readAt, createdAt: r.createdAt }];
    }
    const path = String(r.payload.path ?? "");
    if (!(r.type in ACTIVITY_KINDS) || !/^\/[a-z0-9/_-]*$/i.test(path)) return [];
    return [
      {
        id: r.id,
        kind: r.type as ActivityKind,
        title: String(r.payload.title ?? ""),
        path,
        readAt: r.readAt,
        createdAt: r.createdAt,
      },
    ];
  });
}

export async function unreadNotificationCount(actor: Actor): Promise<number> {
  if (actor.kind !== "user") return 0;
  const [r] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

/** Opening «Varsler» marks everything as read. */
export async function markAllNotificationsRead(actor: Actor): Promise<void> {
  if (actor.kind !== "user") return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
}
