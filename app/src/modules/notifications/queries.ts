import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { ACTIVITY_KINDS, type ActivityKind } from "./email-templates";

export type NotificationItem = {
  id: string;
  kind: ActivityKind;
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
  return rows.flatMap((r) => {
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
