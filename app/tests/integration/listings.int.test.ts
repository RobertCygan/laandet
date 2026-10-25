import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { getListingForViewer, searchListings } from "@/modules/listings/queries";
import { changeListingStatus, saveListing } from "@/modules/listings/service";
import { categoryId, createUser, owner, rentalDraft, resetDb } from "./helpers";

const anonymous = { kind: "anonymous" } as const;

describe("listings (P01-08, P01-10)", () => {
  beforeEach(resetDb);

  it("publishes a complete rental and shows it in explore", async () => {
    const u = await createUser();
    const res = await saveListing(u, await rentalDraft(), [], { intent: "publish" });
    expect(res.status).toBe("published");
    const { items } = await searchListings({ q: "slagdrill" });
    expect(items.map((i) => i.id)).toContain(res.id);
    const audit = await owner.select().from(schema.auditEvents).where(eq(schema.auditEvents.targetId, res.id));
    expect(audit.map((a) => a.action)).toContain("listing.publish");
  });

  it("saves an incomplete draft but refuses to publish it, reporting every problem", async () => {
    const u = await createUser();
    const draft = await rentalDraft({
      priceOre: null,
      declaredValueOre: null,
      description: "kort",
      handoverPickup: false,
    });
    const saved = await saveListing(u, draft, [], { intent: "draft" });
    expect(saved.status).toBe("draft");
    await expect(saveListing(u, draft, [], { listingId: saved.id, intent: "publish" })).rejects.toMatchObject({
      code: "validation",
      details: {
        fieldErrors: {
          price: "price_required",
          declaredValue: "declared_value_required",
          description: "description_length",
          handover: "handover_required",
        },
      },
    });
  });

  it("keeps value category B (over 5 000 kr) out of rental while the preview flag is off", async () => {
    const u = await createUser();
    const draft = await rentalDraft({ declaredValueOre: 500_001 });
    await expect(saveListing(u, draft, [], { intent: "publish" })).rejects.toMatchObject({
      details: { fieldErrors: { declaredValue: "high_value_blocked" } },
    });
    expect((await saveListing(u, draft, [], { intent: "draft" })).status).toBe("draft");
    expect(
      (await saveListing(u, await rentalDraft({ declaredValueOre: 500_000 }), [], { intent: "publish" })).status,
    ).toBe("published");
  });

  it("allows only free lending in categories without paid rental (DPI: trailers, bikes, paddling)", async () => {
    const u = await createUser();
    const cat = await categoryId("sykler");
    await expect(
      saveListing(u, await rentalDraft({ categoryId: cat }), [], { intent: "publish" }),
    ).rejects.toMatchObject({
      details: { fieldErrors: { price: "paid_rental_not_allowed" } },
    });
    expect(
      (await saveListing(u, await rentalDraft({ categoryId: cat, priceOre: 0 }), [], { intent: "publish" })).status,
    ).toBe("published");
  });

  it("never lets another user, an anonymous visitor or an unverified account change a listing", async () => {
    const ownerUser = await createUser();
    const other = await createUser();
    const unverified = await createUser({ emailVerified: false });
    const { id } = await saveListing(ownerUser, await rentalDraft(), [], { intent: "publish" });
    const edit = await rentalDraft({ title: "Overtatt" });
    await expect(saveListing(other, edit, [], { listingId: id, intent: "publish" })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(saveListing(anonymous, edit, [], { listingId: id, intent: "publish" })).rejects.toMatchObject({
      code: "auth_required",
    });
    await expect(saveListing(unverified, edit, [], { intent: "publish" })).rejects.toMatchObject({
      code: "email_unverified",
    });
    await expect(changeListingStatus(other, id, "delete")).rejects.toMatchObject({ code: "not_found" });
  });

  it("hides drafts and paused listings from everyone but the owner", async () => {
    const u = await createUser();
    const other = await createUser();
    const draft = await saveListing(u, await rentalDraft({ title: "Kladd-drill" }), [], { intent: "draft" });
    const live = await saveListing(u, await rentalDraft({ title: "Pause-drill" }), [], { intent: "publish" });
    await changeListingStatus(u, live.id, "pause");
    for (const id of [draft.id, live.id]) {
      expect(await getListingForViewer(anonymous, id)).toBeNull();
      expect(await getListingForViewer(other, id)).toBeNull();
      expect(await getListingForViewer(u, id)).not.toBeNull();
    }
    expect((await searchListings({ q: "drill" })).items).toHaveLength(0);
  });

  it("limits new accounts to 3 new listings per day", async () => {
    const u = await createUser({ isNewAccount: true });
    for (let i = 0; i < 3; i++)
      await saveListing(u, await rentalDraft({ title: `Drill nummer ${i}` }), [], { intent: "publish" });
    await expect(
      saveListing(u, await rentalDraft({ title: "Drill nummer 4" }), [], { intent: "publish" }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("creates an automatic report for prohibited-item keywords and warns the owner", async () => {
    const u = await createUser();
    const res = await saveListing(
      u,
      await rentalDraft({ title: "Hagle til jakt", description: "Godt vedlikeholdt hagle med reim." }),
      [],
      { intent: "publish" },
    );
    expect(res.warnings).toContain("keywords");
    const reports = await owner
      .select()
      .from(schema.reports)
      .where(and(eq(schema.reports.targetId, res.id), eq(schema.reports.isAutomatic, true)));
    expect(reports).toHaveLength(1);
    expect(reports[0]?.reporterId).toBeNull();
  });
});
