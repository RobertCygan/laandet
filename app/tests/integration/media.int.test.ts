import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { uploadListingImage } from "@/modules/media/service";
import { createUser, owner, resetDb } from "./helpers";

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 30, g: 90, b: 60 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TestKamera", Copyright: "Ola Nordmann" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "67/1 50/1 0/1" },
    })
    .toBuffer();
}

describe("image uploads (P01-09)", () => {
  beforeEach(resetDb);

  it("re-encodes to WebP and strips all metadata (EXIF, GPS)", async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const u = await createUser();
    const res = await uploadListingImage(u, new File([new Uint8Array(input)], "bilde.jpg", { type: "image/jpeg" }));
    const [m] = await owner.select().from(schema.mediaObjects).where(eq(schema.mediaObjects.id, res.id));
    expect(m?.mimeType).toBe("image/webp");
    for (const key of [m!.storageKey, m!.thumbKey]) {
      const stored = await readFile(path.join(process.env.MEDIA_DIR!, key));
      const meta = await sharp(stored).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(stored.includes(Buffer.from("Ola Nordmann"))).toBe(false);
    }
  });

  it("rejects files that are not images, whatever their name or declared type", async () => {
    const u = await createUser();
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "bilde.jpg", { type: "image/jpeg" });
    await expect(uploadListingImage(u, fake)).rejects.toMatchObject({
      code: "validation",
      message: "image_unsupported_type",
    });
    expect(await owner.select().from(schema.mediaObjects)).toHaveLength(0);
  });

  it("requires a verified email", async () => {
    const u = await createUser({ emailVerified: false });
    await expect(uploadListingImage(u, new File([new Uint8Array(await jpegWithGps())], "a.jpg"))).rejects.toMatchObject(
      { code: "email_unverified" },
    );
  });
});
