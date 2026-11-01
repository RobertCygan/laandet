import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { digestListings, digestText, sendDailyDigest } from "@/modules/digest/daily";
import { saveListing } from "@/modules/listings/service";
import { categoryId, createUser, owner, rentalDraft, resetDb } from "./helpers";

const HOUR = 3600 * 1000;
const TO = "eier@example.test";
// 18:00 in Oslo (winter time, UTC+1) on a day after today, so real publish times never fall inside.
const AT = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 10, 2, 17, 0));

async function publishedAt(id: string, when: Date) {
  await owner.update(schema.listings).set({ publishedAt: when }).where(eq(schema.listings.id, id));
}

describe("daily Facebook post (D-064)", () => {
  beforeEach(resetDb);

  it("lists the day's public listings with link, place and price; not older ones, examples or private names", async () => {
    const u = await createUser({ name: "Ola Privat" });
    const rent = await saveListing(u, await rentalDraft(), [], { intent: "publish" });
    const free = await saveListing(
      u,
      await rentalDraft({
        type: "service_offer",
        title: "Gratis yoga for 60+",
        description: "Rolig yoga i grendehuset hver tirsdag.",
        categoryId: await categoryId("tjeneste-kurs"),
        itemCondition: null,
        knownDefects: null,
        priceOre: 0,
        priceUnit: null,
        declaredValueOre: null,
        depositOre: null,
        includedAccessories: [],
        handoverPickup: false,
      }),
      [],
      { intent: "publish" },
    );
    const old = await saveListing(u, await rentalDraft({ title: "Gammel annonse" }), [], { intent: "publish" });
    const demo = await saveListing(u, await rentalDraft({ title: "Eksempelannonse" }), [], { intent: "publish" });
    await publishedAt(rent.id, new Date(AT.getTime() - HOUR));
    await publishedAt(free.id, new Date(AT.getTime() - 2 * HOUR));
    await publishedAt(old.id, new Date(AT.getTime() - 30 * HOUR));
    await publishedAt(demo.id, new Date(AT.getTime() - HOUR));
    await owner.update(schema.listings).set({ isDemo: true }).where(eq(schema.listings.id, demo.id));

    const items = await digestListings(AT);
    expect(items.map((i) => i.id)).toEqual([rent.id, free.id]);
    const text = digestText(items, AT, "https://laandet.example/");
    expect(text).toContain("2 nye annonser");
    expect(text).toContain(`https://laandet.example/annonse/${rent.id}`);
    expect(text).toContain("150 kr / dag");
    expect(text).toContain("Gratis yoga for 60+ – Nordfold · gratis");
    expect(text).not.toContain("Ola Privat");
    expect(text).not.toContain("Gammel annonse");
  });

  it("emails the post once a day from 17:45 Oslo time, and not on a day without new listings", async () => {
    expect(await sendDailyDigest(AT, TO)).toBe(0); // nothing new
    const u = await createUser();
    const { id } = await saveListing(u, await rentalDraft(), [], { intent: "publish" });
    await publishedAt(id, new Date(AT.getTime() - HOUR));
    expect(await sendDailyDigest(new Date(AT.getTime() - HOUR), TO)).toBe(0); // 17:00 Oslo: too early
    expect(await sendDailyDigest(AT, TO)).toBe(1);
    expect(await sendDailyDigest(new Date(AT.getTime() + HOUR), TO)).toBe(0); // already sent today
    const mails = await owner.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.template, "daily_digest"));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ toEmail: TO, locale: "nb" });
    expect(mails[0]!.payload.text).toContain(`/annonse/${id}`);
    expect(await sendDailyDigest(new Date(AT.getTime() + 24 * HOUR), "")).toBe(0); // no recipient set
  });
});
