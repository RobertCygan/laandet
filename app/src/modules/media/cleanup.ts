import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { mediaStore } from "./store";

/** Delete listing uploads never attached to a listing within 24 h, and soft-deleted media. */
export async function deleteOrphanMedia(db: DbOrTx): Promise<number> {
  const rows = await db.execute<{ id: string; storage_key: string; thumb_key: string }>(sql`
    DELETE FROM media_objects m
    WHERE m.scope = 'listing'
      AND (
        (m.created_at < now() - interval '24 hours'
          AND NOT EXISTS (SELECT 1 FROM listing_images li WHERE li.media_id = m.id))
        OR (m.deleted_at IS NOT NULL AND m.deleted_at < now() - interval '30 days'
          AND NOT EXISTS (SELECT 1 FROM listing_images li WHERE li.media_id = m.id))
      )
    RETURNING m.id, m.storage_key, m.thumb_key
  `);
  const store = mediaStore();
  for (const r of rows.rows) {
    await store.delete(r.storage_key);
    await store.delete(r.thumb_key);
  }
  return rows.rows.length;
}
