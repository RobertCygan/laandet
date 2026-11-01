import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { deleteOrphanMedia } from "@/modules/media/cleanup";
import { eraseDueAccounts } from "@/modules/privacy/erasure";
import { buildDataExport } from "@/modules/privacy/export";
import { getAvatarMediaId, getPublicProfile, removeAvatar, setAvatar } from "@/modules/users/service";
import { createUser, owner, resetDb } from "./helpers";

async function photo(): Promise<File> {
  const jpeg = await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 20, g: 80, b: 60 } } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "67/1 50/1 0/1" } })
    .toBuffer();
  return new File([new Uint8Array(jpeg)], "meg.jpg", { type: "image/jpeg" });
}

const media = async (id: string) =>
  (await owner.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.id, id)))[0];
const exists = (key: string) =>
  stat(path.join(process.env.MEDIA_DIR!, key)).then(
    () => true,
    () => false,
  );

describe("profile photos (D-061)", () => {
  beforeEach(resetDb);

  it("sets a photo through the image pipeline, shows it on the public profile and audits the change", async () => {
    const u = await createUser();
    await setAvatar(u, await photo());
    const id = await getAvatarMediaId(u.id);
    expect(id).toBeTruthy();
    const m = await media(id!);
    expect(m).toMatchObject({ scope: "avatar", uploadedBy: u.id, mimeType: "image/webp", deletedAt: null });
    expect((await getPublicProfile(u.id))?.avatarMediaId).toBe(id);
    const events = await owner
      .select({ action: schema.auditEvents.action })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.actorId, u.id));
    expect(events.map((e) => e.action)).toContain("profile.avatar_set");
  });

  it("replacing or removing a photo deletes the old one; the cleanup job removes the files", async () => {
    const u = await createUser();
    await setAvatar(u, await photo());
    const first = (await getAvatarMediaId(u.id))!;
    await setAvatar(u, await photo());
    const second = (await getAvatarMediaId(u.id))!;
    expect(second).not.toBe(first);
    expect((await media(first))?.deletedAt).toBeInstanceOf(Date);

    await removeAvatar(u);
    expect(await getAvatarMediaId(u.id)).toBeNull();
    expect((await media(second))?.deletedAt).toBeInstanceOf(Date);

    const before = await owner.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.scope, "avatar"));
    const keys = before.flatMap((m) => [m.storageKey, m.thumbKey]);
    for (const k of keys) expect(await exists(k)).toBe(true);
    expect(await deleteOrphanMedia(owner)).toBe(2);
    expect(await owner.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.scope, "avatar"))).toHaveLength(
      0,
    );
    for (const k of keys) expect(await exists(k)).toBe(false);
  });

  it("keeps the current photo when the cleanup job runs", async () => {
    const u = await createUser();
    await setAvatar(u, await photo());
    await owner.update(schema.mediaObjects).set({ createdAt: new Date(Date.now() - 3 * 86_400_000) });
    expect(await deleteOrphanMedia(owner)).toBe(0);
    expect(await getAvatarMediaId(u.id)).toBeTruthy();
  });

  it("needs a verified email, like listing photos", async () => {
    const u = await createUser({ emailVerified: false });
    await expect(setAvatar(u, await photo())).rejects.toMatchObject({ code: "email_unverified" });
    expect(await owner.select().from(schema.mediaObjects)).toHaveLength(0);
  });

  it("is in the data export and goes when the account is erased", async () => {
    const u = await createUser();
    await setAvatar(u, await photo());
    const id = (await getAvatarMediaId(u.id))!;
    expect(JSON.stringify(await buildDataExport(u))).toContain(id);

    await owner
      .update(schema.userProfiles)
      .set({ status: "deletion_pending", deletionRequestedAt: new Date() })
      .where(eq(schema.userProfiles.userId, u.id));
    expect(await eraseDueAccounts()).toBe(1);
    expect(await getAvatarMediaId(u.id)).toBeNull();
    expect((await media(id))?.deletedAt).toBeInstanceOf(Date);
    expect(await deleteOrphanMedia(owner)).toBe(1);
  });
});
