import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  categorySchema,
  createLocality,
  createLocalitySchema,
  listCategoriesForAdmin,
  updateCategory,
  updateCategoryPolicy,
  updateLocality,
  updateLocalitySchema,
} from "@/modules/admin/catalog";
import { getMetrics } from "@/modules/admin/metrics";
import { flagSchema, listAuditEvents, listFlags, listLegalVersions, setFlag } from "@/modules/admin/settings";
import {
  listTransparencyForAdmin,
  listTransparencyMonths,
  removeTransparencyMonth,
  saveTransparencyMonth,
  transparencySchema,
} from "@/modules/admin/transparency";
import { isFlagEnabled } from "@/modules/flags/flags";
import { db } from "@/db/client";
import { saveListing } from "@/modules/listings/service";
import { requestBooking } from "@/modules/rentals/service";
import { categoryId, createUser, owner, rentalDraft, resetDb } from "./helpers";

const REASON = "Pilotdrift: endring avtalt med eieren.";

async function staff() {
  return {
    admin: await createUser({ role: "admin", staff2fa: true, name: "Admin A." }),
    moderator: await createUser({ role: "moderator", staff2fa: true, name: "Moderator M." }),
  };
}

async function audits(action: string) {
  return owner.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, action));
}

async function category(slug: string) {
  const [c] = await owner.select().from(schema.categories).where(eq(schema.categories.slug, slug));
  return c!;
}

const fullCategory = (c: typeof schema.categories.$inferSelect, overrides: Record<string, unknown> = {}) =>
  categorySchema.parse({
    categoryId: c.id,
    labelNb: c.labels.nb,
    labelEn: c.labels.en,
    safetyNb: c.safetyNotice?.nb ?? "",
    safetyEn: c.safetyNotice?.en ?? "",
    policy: c.policy,
    types: c.allowedListingTypes,
    allowPaidRental: c.allowPaidRental ? "on" : "",
    active: c.active ? "on" : "",
    sortOrder: String(c.sortOrder),
    reason: REASON,
    ...overrides,
  });

describe("admin panel (P03-04)", () => {
  // Categories, localities and flags are reference data that resetDb keeps: put them back after each test.
  let seeded: typeof schema.categories.$inferSelect;
  beforeAll(async () => {
    seeded = await category("verktoy");
  });
  beforeEach(resetDb);
  afterEach(async () => {
    const { id, ...rest } = seeded;
    await owner.update(schema.categories).set(rest).where(eq(schema.categories.id, id));
    await owner.delete(schema.localities).where(eq(schema.localities.slug, "nyby"));
    await owner.execute(sql`UPDATE feature_flags SET enabled = false WHERE key IN ('rentals_open', 'passkeys')`);
  });
  afterAll(() => owner.execute(sql`UPDATE feature_flags SET updated_by = NULL`));

  it("moderators change a category's policy only; admins edit the rest; every change is audited", async () => {
    const { admin, moderator } = await staff();
    const verktoy = await category("verktoy");
    const before = verktoy.policy;

    await updateCategoryPolicy(moderator, { categoryId: verktoy.id, policy: "prohibited", reason: REASON });
    expect((await category("verktoy")).policy).toBe("prohibited");
    const [a] = await audits("category.updated");
    expect(a).toMatchObject({ actorId: moderator.id, reason: REASON, targetId: verktoy.id });
    expect(a!.metadata).toMatchObject({ changed: ["policy"], policy: { from: before, to: "prohibited" } });

    // A moderator cannot touch labels, types or paid rental.
    await expect(
      updateCategory(moderator, fullCategory(verktoy, { labelNb: "Verktøy og utstyr" })),
    ).rejects.toMatchObject({ code: "forbidden" });
    // Restricted needs a safety notice, which only an admin can write.
    await expect(
      updateCategoryPolicy(moderator, { categoryId: verktoy.id, policy: "restricted", reason: REASON }),
    ).rejects.toMatchObject({ code: "validation", message: "safety_notice_required" });
    expect(() => fullCategory(verktoy, { policy: "restricted", safetyNb: "", safetyEn: "" })).toThrow();

    await updateCategory(
      admin,
      fullCategory(await category("verktoy"), {
        labelNb: "Verktøy og utstyr",
        policy: "allowed",
        allowPaidRental: "",
      }),
    );
    const after = await category("verktoy");
    expect(after).toMatchObject({ policy: "allowed", allowPaidRental: false });
    expect(after.labels.nb).toBe("Verktøy og utstyr");
    expect(after.slug).toBe("verktoy");
    expect(await audits("category.updated")).toHaveLength(2);

    // A reason is required, and members get nothing.
    expect(() => fullCategory(after, { reason: "kort" })).toThrow();
    await expect(listCategoriesForAdmin(await createUser())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("shows how many published listings a category has before it is prohibited, without hiding them", async () => {
    const { moderator } = await staff();
    const owner1 = await createUser();
    await saveListing(owner1, await rentalDraft(), [], { intent: "publish" });
    const id = await categoryId("verktoy");
    await updateCategoryPolicy(moderator, { categoryId: id, policy: "prohibited", reason: REASON });
    const row = (await listCategoriesForAdmin(moderator)).find((c) => c.id === id)!;
    expect(row.publishedListings).toBe(1);
    const [l] = await owner.select().from(schema.listings).where(eq(schema.listings.ownerId, owner1.id));
    expect(l!.status).toBe("published");
  });

  it("only admins switch flags, localities, legal versions, the security log and transparency figures", async () => {
    const { moderator } = await staff();
    const refused = [
      () => listFlags(moderator),
      () => setFlag(moderator, flagSchema.parse({ key: "rentals_open", enabled: "true", reason: REASON })),
      () =>
        createLocality(
          moderator,
          createLocalitySchema.parse({
            slug: "nyby",
            name: "Nyby",
            municipality: "Steigen",
            sortOrder: "9",
            reason: REASON,
          }),
        ),
      () => listLegalVersions(moderator),
      () => listAuditEvents(moderator),
      () => listTransparencyForAdmin(moderator),
    ];
    for (const call of refused) await expect(call()).rejects.toMatchObject({ code: "forbidden" });
    // Metrics are for all staff, never for members.
    await expect(getMetrics(moderator)).resolves.toBeTruthy();
    await expect(getMetrics(await createUser())).rejects.toMatchObject({ code: "forbidden" });
    await expect(getMetrics(await createUser({ role: "moderator" }))).rejects.toMatchObject({
      code: "staff_2fa_required",
    });
  });

  it("switching rentals_open in the admin opens requests, records who did it and audits the reason", async () => {
    const { admin } = await staff();
    await owner.execute(sql`UPDATE feature_flags SET enabled = false WHERE key = 'rentals_open'`);
    const lender = await createUser();
    const renter = await createUser();
    const { id: listingId } = await saveListing(lender, await rentalDraft(), [], { intent: "publish" });
    const start = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const req = {
      listingId,
      start: start.toISOString(),
      end: new Date(start.getTime() + 24 * 3600 * 1000).toISOString(),
      handoverMethod: "pickup" as const,
      returnMethod: "pickup" as const,
      message: "",
    };
    await expect(requestBooking(renter, req)).rejects.toMatchObject({ code: "feature_disabled" });

    await setFlag(admin, flagSchema.parse({ key: "rentals_open", enabled: "true", reason: REASON }));
    expect(await isFlagEnabled(db, "rentals_open")).toBe(true);
    await expect(requestBooking(renter, req)).resolves.toMatchObject({ id: expect.any(String) });

    const [row] = await owner.select().from(schema.featureFlags).where(eq(schema.featureFlags.key, "rentals_open"));
    expect(row!.updatedBy).toBe(admin.id);
    const [a] = await audits("flag.updated");
    expect(a).toMatchObject({ actorId: admin.id, reason: REASON });
    expect(a!.metadata).toMatchObject({ key: "rentals_open", from: false, to: true });
    const flags = await listFlags(admin);
    expect(flags.find((f) => f.key === "rentals_open")).toMatchObject({ enabled: true, updatedByName: "Admin A." });
    expect(() => flagSchema.parse({ key: "not_a_flag", enabled: "true", reason: REASON })).toThrow();
  });

  it("localities: add with a unique slug, rename and deactivate; the slug never changes", async () => {
    const { admin } = await staff();
    const id = await createLocality(
      admin,
      createLocalitySchema.parse({
        slug: "nyby",
        name: "Nyby",
        municipality: "Steigen",
        sortOrder: "9",
        reason: REASON,
      }),
    );
    await expect(
      createLocality(
        admin,
        createLocalitySchema.parse({
          slug: "nyby",
          name: "Igjen",
          municipality: "Steigen",
          sortOrder: "1",
          reason: REASON,
        }),
      ),
    ).rejects.toMatchObject({ message: "slug_taken" });
    expect(() =>
      createLocalitySchema.parse({
        slug: "Ny By",
        name: "x y",
        municipality: "Steigen",
        sortOrder: "1",
        reason: REASON,
      }),
    ).toThrow();
    await updateLocality(
      admin,
      updateLocalitySchema.parse({
        localityId: id,
        name: "Nybyen",
        municipality: "Steigen",
        active: "",
        sortOrder: "9",
        reason: REASON,
      }),
    );
    const [l] = await owner.select().from(schema.localities).where(eq(schema.localities.id, id));
    expect(l).toMatchObject({ slug: "nyby", name: "Nybyen", active: false });
    expect((await audits("locality.created")).length).toBe(1);
    expect((await audits("locality.updated"))[0]!.metadata).toMatchObject({ changed: ["name", "active"] });
  });

  it("legal versions are listed read-only with the current one marked", async () => {
    const { admin } = await staff();
    const rows = await listLegalVersions(admin);
    expect(rows.length).toBeGreaterThan(0);
    const terms = rows.filter((r) => r.docKey === "terms" && r.locale === "nb");
    expect(terms.filter((r) => r.current)).toHaveLength(1);
    expect(terms[0]!.current).toBe(true);
    // The runtime role still cannot change legal texts (nothing in the admin can mark one as reviewed).
    await expect(db.execute(sql`UPDATE legal_document_versions SET is_draft = false`)).rejects.toThrow();
  });

  it("the security log is newest first, filtered by prefix and capped", async () => {
    const { admin } = await staff();
    await setFlag(admin, flagSchema.parse({ key: "passkeys", enabled: "true", reason: REASON }));
    await setFlag(admin, flagSchema.parse({ key: "passkeys", enabled: "false", reason: REASON }));
    await owner.insert(schema.auditEvents).values({ action: "auth.sign_in", actorId: admin.id });
    const flagsOnly = await listAuditEvents(admin, { prefix: "flag." });
    expect(flagsOnly.map((e) => e.action)).toEqual(["flag.updated", "flag.updated"]);
    expect(flagsOnly[0]!.metadata).toMatchObject({ to: false });
    expect(flagsOnly[0]!.actorName).toBe("Admin A.");
    // An invalid prefix is ignored rather than passed on.
    expect((await listAuditEvents(admin, { prefix: "%' OR 1=1 --" })).length).toBe(3);
  });

  it("metrics count by status and flag late, never-run and failing worker jobs", async () => {
    const { moderator } = await staff();
    const now = new Date();
    await owner.insert(schema.workerHeartbeats).values([
      { job: "email_outbox", lastRunAt: now, lastOkAt: now },
      { job: "orphan_media", lastRunAt: new Date(now.getTime() - 5 * 3600 * 1000), lastOkAt: new Date(0) },
      { job: "audit_retention", lastRunAt: now, lastOkAt: new Date(now.getTime() - 1000), lastError: "boom" },
    ]);
    await owner.insert(schema.auditEvents).values({ action: "auth.rate_limited" });
    const m = await getMetrics(moderator, now);
    expect(m.users.active).toBeGreaterThanOrEqual(2);
    const job = (name: string) => m.jobs.find((j) => j.name === name)!;
    expect(job("email_outbox")).toMatchObject({ late: false, failing: false });
    expect(job("orphan_media")).toMatchObject({ late: true, failing: true });
    expect(job("audit_retention")).toMatchObject({ late: false, failing: true, lastError: "boom" });
    expect(job("rate_limit_cleanup")).toMatchObject({ late: true, lastRunAt: null });
    expect(m.rateLimited["auth.rate_limited"]).toBe(1);
  });
});

describe("transparency figures (P03-07)", () => {
  beforeEach(resetDb);

  const month = (overrides: Record<string, string> = {}) =>
    transparencySchema.parse({
      month: "2026-09",
      costTotalOre: "212,50",
      costServerOre: "93",
      costBackupOre: "",
      costEmailOre: "",
      costDomainOre: "",
      costOtherOre: "",
      supportReceivedOre: "",
      note: "Første måned med server.",
      sourceNote: "Faktura H-123",
      reason: REASON,
      ...overrides,
    });

  it("only admins enter figures; the public list never shows the internal source note", async () => {
    const { admin, moderator } = await staff();
    await expect(saveTransparencyMonth(moderator, month())).rejects.toMatchObject({ code: "forbidden" });
    await saveTransparencyMonth(admin, month());
    const pub = await listTransparencyMonths();
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({
      month: "2026-09-01",
      costTotalOre: 21250,
      costServerOre: 9300,
      supportReceivedOre: null,
    });
    expect(pub[0]).not.toHaveProperty("sourceNote");
    expect(pub[0]).not.toHaveProperty("enteredBy");
    expect((await listTransparencyForAdmin(admin))[0]!.sourceNote).toBe("Faktura H-123");
    const [a] = await owner
      .select()
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.action, "transparency.saved"), eq(schema.auditEvents.actorId, admin.id)));
    expect(a).toMatchObject({ reason: REASON });
  });

  it("the same month again corrects it; parts cannot exceed the total; no future months", async () => {
    const { admin } = await staff();
    await saveTransparencyMonth(admin, month());
    await saveTransparencyMonth(admin, month({ costTotalOre: "250", supportReceivedOre: "100" }));
    const rows = await listTransparencyMonths();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ costTotalOre: 25000, supportReceivedOre: 10000 });

    expect(() => month({ costTotalOre: "50", costServerOre: "93" })).toThrow();
    expect(() => month({ costTotalOre: "" })).toThrow();
    expect(() => month({ costTotalOre: "-5" })).toThrow();
    // The database refuses it too.
    await expect(
      owner.insert(schema.transparencyMonths).values({
        month: "2026-08-01",
        costTotalOre: 100,
        costServerOre: 200,
        enteredBy: admin.id,
      }),
    ).rejects.toThrow();
    await expect(
      saveTransparencyMonth(admin, month({ month: "2026-11" }), new Date("2026-10-25T12:00:00Z")),
    ).rejects.toMatchObject({ message: "month_in_future" });
  });

  it("a month entered by mistake can be removed, with a reason in the log", async () => {
    const { admin } = await staff();
    await saveTransparencyMonth(admin, month());
    const [row] = await listTransparencyForAdmin(admin);
    await removeTransparencyMonth(admin, { monthId: row!.id, reason: REASON });
    expect(await listTransparencyMonths()).toHaveLength(0);
    const [a] = await owner
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "transparency.removed"));
    expect(a!.metadata).toMatchObject({ month: "2026-09" });
  });
});
