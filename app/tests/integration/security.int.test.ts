import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { openSchema } from "@/modules/disputes/service";
import { uploadImage } from "@/modules/media/service";
import { userMeasureSchema } from "@/modules/moderation/users";
import { changeTermsSchema, requestSchema } from "@/modules/rentals/service";
import { reviewSchema } from "@/modules/reviews/service";
import { profileSchema } from "@/modules/users/service";
import { createUser, owner, resetDb } from "./helpers";
import { confirmedBooking, setRentalsOpen } from "./rental-fixtures";

/**
 * SEC-21: users can never write role, status, verification, review status, contract status or money
 * terms through any input. The schemas drop every field they do not name, so such fields never reach
 * a service (the database guards the rest: column privileges and triggers).
 */
const SMUGGLED = {
  role: "admin",
  status: "published",
  emailVerified: "true",
  idLevel: "strong",
  ownerId: "00000000-0000-0000-0000-00000000000a",
  depositOre: "0",
  priceOre: "0",
  renderedSha256: "0".repeat(64),
};

describe("inputs drop fields a user may not set (SEC-21)", () => {
  it("profile", () => {
    const out = profileSchema.parse({ name: "Ola N.", locale: "nb", ...SMUGGLED });
    for (const k of Object.keys(SMUGGLED)) expect(out).not.toHaveProperty(k);
  });

  it("rental request and change of terms carry no money terms", () => {
    const base = {
      listingId: "7c9e6679-7425-40de-944b-e07fc1f90ae0",
      bookingId: "7c9e6679-7425-40de-944b-e07fc1f90ae1",
      start: "2026-12-14T10:00:00+01:00",
      end: "2026-12-15T10:00:00+01:00",
      handoverMethod: "pickup",
      returnMethod: "pickup",
    };
    for (const schema of [requestSchema, changeTermsSchema]) {
      const out = schema.parse({ ...base, ...SMUGGLED });
      for (const k of Object.keys(SMUGGLED)) expect(out).not.toHaveProperty(k);
    }
  });

  it("review, case and account measure", () => {
    const review = reviewSchema.parse({
      bookingId: "7c9e6679-7425-40de-944b-e07fc1f90ae1",
      communication: "5",
      punctuality: "5",
      itemCondition: "5",
      agreement: "5",
      ...SMUGGLED,
    });
    expect(review).not.toHaveProperty("status");
    const open = openSchema.parse({
      bookingId: "7c9e6679-7425-40de-944b-e07fc1f90ae1",
      category: "damaged",
      summary: "En ripe på håndtaket.",
      ...SMUGGLED,
    });
    expect(open).not.toHaveProperty("status");
    const measure = userMeasureSchema.parse({
      userId: "7c9e6679-7425-40de-944b-e07fc1f90ae2",
      measure: "warn",
      reasonCode: "spam",
      statement: "Gjentatt spam i meldinger.",
      ...SMUGGLED,
    });
    expect(measure).not.toHaveProperty("role");
  });
});

describe("N6: money terms of a booking never change after the request", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("the database refuses any change to deposit, price, value or parties, for the app role and the owner role", async () => {
    const { id, renter } = await confirmedBooking();
    const { db } = await import("@/db/client");
    for (const conn of [db, owner]) {
      await expect(conn.execute(sql`UPDATE bookings SET deposit_ore = 0 WHERE id = ${id}`)).rejects.toThrow();
      await expect(conn.execute(sql`UPDATE bookings SET price_ore = price_ore + 1 WHERE id = ${id}`)).rejects.toThrow();
      await expect(
        conn.execute(sql`UPDATE bookings SET renter_id = owner_id, owner_id = ${renter.id} WHERE id = ${id}`),
      ).rejects.toThrow();
    }
    const [b] = await owner.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b!.depositOre).toBe(50000);
    // Status changes still work.
    await db.execute(sql`UPDATE bookings SET meeting_place_private = 'Ved butikken' WHERE id = ${id}`);
  });
});

describe("evidence uploads for restricted accounts (security review L5)", () => {
  beforeEach(resetDb);

  it("a restricted member can upload condition and case photos, but no listing photos", async () => {
    const restricted = await createUser({ status: "restricted" });
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#406080" } })
      .png()
      .toBuffer();
    const file = () => new File([new Uint8Array(png)], "foto.png", { type: "image/png" });
    await expect(uploadImage(restricted, file(), "condition")).resolves.toMatchObject({ id: expect.any(String) });
    await expect(uploadImage(restricted, file(), "dispute")).resolves.toMatchObject({ id: expect.any(String) });
    await expect(uploadImage(restricted, file(), "listing")).rejects.toMatchObject({ code: "account_restricted" });
  });
});

describe("pseudonymous email keys", () => {
  it("are keyed with the server secret, so a known address cannot be matched by hashing it", async () => {
    const { createHash } = await import("node:crypto");
    const { emailKey } = await import("@/modules/auth/service");
    expect(emailKey("Ola@Example.no")).toBe(emailKey("ola@example.no"));
    expect(emailKey("ola@example.no")).toMatch(/^[0-9a-f]{32}$/);
    const unkeyed = createHash("sha256").update("laandet:ola@example.no").digest("hex").slice(0, 32);
    expect(emailKey("ola@example.no")).not.toBe(unkeyed);
  });
});
