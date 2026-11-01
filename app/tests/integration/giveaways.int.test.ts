import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  confirmTransfer,
  createClaim,
  declineClaim,
  loadClaimFor,
  selectClaim,
  withdrawClaim,
} from "@/modules/giveaways/service";
import { saveListing } from "@/modules/listings/service";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";
import { noticesFor } from "./rental-fixtures";

async function setup() {
  const giver = await createUser({ name: "Giver G." });
  const a = await createUser({ name: "Mottaker A." });
  const b = await createUser({ name: "Mottaker B." });
  const draft = await rentalDraft({
    type: "give_away",
    title: "Barnesykkel 16 tommer",
    priceOre: null,
    priceUnit: null,
    declaredValueOre: null,
    depositOre: null,
    knownDefects: "Litt rust på kjedet",
  });
  const { id: listingId } = await saveListing(giver, draft, [], { intent: "publish" });
  return { giver, a, b, listingId };
}

const claim = (listingId: string, message = "") => ({ listingId, handoverMethod: undefined, message });

async function listingStatus(id: string) {
  const [l] = await owner
    .select({ status: schema.listings.status })
    .from(schema.listings)
    .where(eq(schema.listings.id, id));
  return l!.status;
}

async function claimStatus(id: string) {
  const [g] = await owner
    .select({ status: schema.giveawayClaims.status })
    .from(schema.giveawayClaims)
    .where(eq(schema.giveawayClaims.id, id));
  return g!.status;
}

async function liveContract(claimId: string) {
  const [c] = await owner.select().from(schema.contracts).where(eq(schema.contracts.giveawayClaimId, claimId));
  return c!;
}

describe("giveaway claims (P02-03)", () => {
  beforeEach(resetDb);

  it("claim → the giver picks one → both confirm the exact transfer text → «Gitt bort»", async () => {
    const { giver, a, b, listingId } = await setup();
    const ca = await createClaim(a, claim(listingId, "Kan hente i kveld"));
    const cb = await createClaim(b, claim(listingId));
    await expect(createClaim(a, claim(listingId))).rejects.toMatchObject({
      code: "conflict",
      message: "already_claimed",
    });
    await expect(createClaim(giver, claim(listingId))).rejects.toMatchObject({ message: "own_listing" });
    expect(await noticesFor(giver.id)).toEqual(["claim_received", "claim_received"]);

    await selectClaim(giver, ca.id);
    expect(await listingStatus(listingId)).toBe("reserved");
    expect(await noticesFor(b.id)).toEqual(["claim_not_selected"]);
    // Only one person can be selected at a time.
    await expect(selectClaim(giver, cb.id)).rejects.toMatchObject({ code: "conflict" });

    const c = await liveContract(ca.id);
    expect(c).toMatchObject({ kind: "giveaway_transfer", status: "pending_acceptance" });
    expect(c.agreementNumber).toMatch(/^GB-\d{4}-\d{6}$/);
    expect(c.renderedText).toContain("Mottaker A.");
    await expect(confirmTransfer(a, ca.id, "f".repeat(64))).rejects.toMatchObject({ message: "agreement_changed" });
    expect(await confirmTransfer(a, ca.id, c.renderedSha256)).toBe("waiting");
    expect(await noticesFor(giver.id)).toContain("transfer_to_confirm");
    expect(await confirmTransfer(giver, ca.id, c.renderedSha256)).toBe("transferred");

    expect(await listingStatus(listingId)).toBe("given_away");
    expect(await claimStatus(ca.id)).toBe("transferred");
    expect(await claimStatus(cb.id)).toBe("expired");
    expect((await liveContract(ca.id)).status).toBe("accepted");
    const [g] = await owner.select().from(schema.giveawayClaims).where(eq(schema.giveawayClaims.id, ca.id));
    const system = await owner
      .select({ body: schema.messages.body })
      .from(schema.messages)
      .where(and(eq(schema.messages.conversationId, g!.conversationId), eq(schema.messages.kind, "system")));
    expect(system.map((m) => m.body)).toEqual(["claim.requested", "claim.selected", "claim.transferred"]);
  });

  it("only giver and claimant see a claim; the database refuses an acceptance from anyone else", async () => {
    const { giver, a, b, listingId } = await setup();
    const stranger = await createUser();
    const ca = await createClaim(a, claim(listingId));
    await createClaim(b, claim(listingId));
    await expect(loadClaimFor(stranger, ca.id, "claim.view")).rejects.toMatchObject({ code: "not_found" });
    await expect(loadClaimFor(b, ca.id, "claim.view")).rejects.toMatchObject({ code: "not_found" });
    await expect(selectClaim(a, ca.id)).rejects.toMatchObject({ code: "forbidden" });

    await selectClaim(giver, ca.id);
    const c = await liveContract(ca.id);
    await expect(
      owner.insert(schema.contractAcceptances).values({
        contractId: c.id,
        userId: b.id,
        partyRole: "recipient",
        acceptedSha256: c.renderedSha256,
      }),
    ).rejects.toThrow();
  });

  it("withdrawing a selected claim reopens the listing and voids the transfer text", async () => {
    const { giver, a, b, listingId } = await setup();
    const ca = await createClaim(a, claim(listingId));
    const cb = await createClaim(b, claim(listingId));
    await selectClaim(giver, ca.id);
    await withdrawClaim(a, ca.id);
    expect(await claimStatus(ca.id)).toBe("cancelled");
    expect(await listingStatus(listingId)).toBe("published");
    expect((await liveContract(ca.id)).status).toBe("void");
    expect(await noticesFor(giver.id)).toContain("claim_cancelled");

    await selectClaim(giver, cb.id);
    expect(await listingStatus(listingId)).toBe("reserved");
    const other = await createUser();
    const cc = await createClaim(other, claim(listingId)).catch((e: unknown) => e);
    // A reserved listing takes no new claims.
    expect(cc).toMatchObject({ code: "not_found" });
  });

  it("the giver can decline a claim", async () => {
    const { giver, a, listingId } = await setup();
    const ca = await createClaim(a, claim(listingId));
    await declineClaim(giver, ca.id);
    expect(await claimStatus(ca.id)).toBe("declined");
    expect(await noticesFor(a.id)).toEqual(["claim_cancelled"]);
  });
});
