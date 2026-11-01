import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { signUp } from "@/modules/auth/service";
import { assertPrivateAccount } from "@/modules/business/account";
import { getListingForViewer, searchListings } from "@/modules/listings/queries";
import { saveListing } from "@/modules/listings/service";
import { eraseDueAccounts } from "@/modules/privacy/erasure";
import { getPublicProfile } from "@/modules/users/service";
import { categoryId, createUser, owner, rentalDraft, resetDb } from "./helpers";

const ORG = "974760673";

async function serviceDraft(o: Parameters<typeof rentalDraft>[0] = {}) {
  return rentalDraft({
    type: "service_offer",
    title: "Plenklipping i Nordfold",
    description: "Jeg klipper plenen din med egen klipper og tar med graset.",
    categoryId: await categoryId("tjeneste-hage"),
    itemCondition: null,
    knownDefects: null,
    priceOre: 30000,
    priceUnit: "hour",
    declaredValueOre: null,
    depositOre: null,
    includedAccessories: [],
    handoverPickup: false,
    ...o,
  });
}

async function makeBusiness() {
  const u = await createUser();
  await owner
    .update(schema.userProfiles)
    .set({
      accountType: "business",
      orgNumber: ORG,
      businessName: "YOGA 60+ NORDFOLD",
      businessVerifiedAt: new Date(),
      privateUseConfirmedAt: null,
    })
    .where(eq(schema.userProfiles.userId, u.id));
  return u;
}

function stubBrreg(status: number, body?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })),
  );
}

const signUpBase = {
  name: "Kari N.",
  email: "yoga@example.test",
  password: "en lang og trygg setning",
  locality: "nordfold",
  age18: "on" as const,
  terms: "on" as const,
  locale: "nb" as const,
  website: "",
};

describe("Tjenester and business accounts (D-063)", () => {
  beforeEach(resetDb);
  afterEach(() => vi.unstubAllGlobals());

  it("publishes paid, free and «by agreement» services and lists them under Tjenester", async () => {
    const u = await createUser();
    const paid = await saveListing(u, await serviceDraft(), [], { intent: "publish" });
    const free = await saveListing(u, await serviceDraft({ priceOre: 0, priceUnit: null }), [], { intent: "publish" });
    const wanted = await saveListing(
      u,
      await serviceDraft({ type: "service_wanted", priceOre: null, priceUnit: null, title: "Trenger snømåking" }),
      [],
      { intent: "publish" },
    );
    await saveListing(u, await rentalDraft(), [], { intent: "publish" });
    const { items } = await searchListings({ type: "services" });
    expect(items.map((i) => i.id).sort()).toEqual([paid.id, free.id, wanted.id].sort());
    expect(items.every((i) => i.businessName === null)).toBe(true);
  });

  it("refuses a service in an item category and a rental unit on a service", async () => {
    const u = await createUser();
    await expect(
      saveListing(u, await serviceDraft({ categoryId: await categoryId("verktoy") }), [], { intent: "publish" }),
    ).rejects.toMatchObject({ details: { fieldErrors: { categoryId: "category_type_not_allowed" } } });
    await expect(
      saveListing(u, await serviceDraft({ priceUnit: "day" }), [], { intent: "publish" }),
    ).rejects.toMatchObject({ details: { fieldErrors: { priceUnit: "unit_not_allowed" } } });
  });

  it("the database refuses item terms or handover on a service", async () => {
    const u = await createUser();
    const { id } = await saveListing(u, await serviceDraft(), [], { intent: "publish" });
    await expect(
      owner.update(schema.listings).set({ handoverPickup: true }).where(eq(schema.listings.id, id)),
    ).rejects.toThrow();
    await expect(
      owner.update(schema.listings).set({ declaredValueOre: 10000 }).where(eq(schema.listings.id, id)),
    ).rejects.toThrow();
  });

  it("business accounts post services only, cannot rent or claim, and show as «Bedrift»", async () => {
    const b = await makeBusiness();
    await expect(saveListing(b, await rentalDraft(), [], { intent: "publish" })).rejects.toMatchObject({
      details: { fieldErrors: { type: "business_services_only" } },
    });
    const { id } = await saveListing(b, await serviceDraft({ priceOre: 0, priceUnit: null }), [], {
      intent: "publish",
    });
    const { items } = await searchListings({ type: "services" });
    expect(items.find((i) => i.id === id)?.businessName).toBe("YOGA 60+ NORDFOLD");
    const detail = await getListingForViewer({ kind: "anonymous" }, id);
    expect(detail?.owner).toMatchObject({ accountType: "business", orgNumber: ORG });
    expect((await getPublicProfile(b.id))?.business).toEqual({ name: "YOGA 60+ NORDFOLD", orgNumber: ORG });
    await expect(assertPrivateAccount(b.id)).rejects.toMatchObject({ message: "business_private_only" });
    await expect(assertPrivateAccount((await createUser()).id)).resolves.toBeUndefined();
  });

  it("signs up a business after checking Enhetsregisteret and stores the registered name", async () => {
    stubBrreg(200, { organisasjonsnummer: ORG, navn: "YOGA 60+ NORDFOLD" });
    await signUp({ ...signUpBase, accountType: "business", orgNumber: ORG, startedAt: Date.now() - 10_000 });
    const [u] = await owner.select().from(schema.users).where(eq(schema.users.email, signUpBase.email));
    const [p] = await owner.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, u!.id));
    expect(p).toMatchObject({
      accountType: "business",
      orgNumber: ORG,
      businessName: "YOGA 60+ NORDFOLD",
      privateUseConfirmedAt: null,
    });
    expect(p?.businessVerifiedAt).toBeInstanceOf(Date);

    // The same org number cannot register twice.
    await expect(
      signUp({
        ...signUpBase,
        email: "andre@example.test",
        accountType: "business",
        orgNumber: ORG,
        startedAt: Date.now() - 10_000,
      }),
    ).rejects.toMatchObject({ details: { fieldErrors: { orgNumber: "org_number_taken" } } });
  });

  it("refuses a bankrupt entity before any account is created", async () => {
    stubBrreg(200, { organisasjonsnummer: ORG, navn: "KONKURS AS", konkurs: true });
    await expect(
      signUp({ ...signUpBase, accountType: "business", orgNumber: ORG, startedAt: Date.now() - 10_000 }),
    ).rejects.toMatchObject({ details: { fieldErrors: { orgNumber: "org_not_active" } } });
    expect(await owner.select().from(schema.users)).toHaveLength(0);
  });

  it("erasing a business account removes the org number and name", async () => {
    const b = await makeBusiness();
    await owner
      .update(schema.userProfiles)
      .set({ status: "deletion_pending", deletionRequestedAt: new Date() })
      .where(eq(schema.userProfiles.userId, b.id));
    expect(await eraseDueAccounts()).toBe(1);
    const [p] = await owner.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, b.id));
    expect(p).toMatchObject({ status: "deleted", orgNumber: null, businessName: null, businessVerifiedAt: null });
  });
});
