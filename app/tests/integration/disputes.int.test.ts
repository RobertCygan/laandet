import sharp from "sharp";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { addEntry, confirmReport, mayViewConditionMedia } from "@/modules/condition/service";
import { activeGrant, mayViewDisputeMedia } from "@/modules/disputes/access";
import { getDisputeForParty } from "@/modules/disputes/queries";
import {
  addStatement,
  answerRecommendation,
  escalate,
  loadDisputeFor,
  makeProposal,
  openDispute,
  respondToProposal,
  withdrawDispute,
} from "@/modules/disputes/service";
import {
  closeByStaff,
  getCaseForStaff,
  listRecentlyClosed,
  listSupportQueue,
  recommend,
  reopenCase,
  requestDocumentation,
  takeCase,
} from "@/modules/disputes/support";
import { uploadImage } from "@/modules/media/service";
import { getPublicProfile } from "@/modules/users/service";
import type { DisputeCategory } from "@/modules/disputes/rules";
import { createUser, owner, resetDb } from "./helpers";
import {
  bookingRow,
  completedBooking,
  DAY,
  entry,
  handedOverBooking,
  noticesFor,
  setRentalsOpen,
} from "./rental-fixtures";

const open = (bookingId: string, category: DisputeCategory = "damaged") => ({
  bookingId,
  category,
  summary: "Det er en ny ripe på håndtaket etter leien.",
  photoIds: [] as string[],
});
const later = (days: number) => new Date(Date.now() + days * DAY);

async function disputeRow(id: string) {
  const [d] = await owner.select().from(schema.disputes).where(eq(schema.disputes.id, id));
  return d!;
}

async function photo(user: Awaited<ReturnType<typeof createUser>>, scope: "dispute" | "condition") {
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#806040" } })
    .png()
    .toBuffer();
  return uploadImage(user, new File([new Uint8Array(png)], "bevis.png", { type: "image/png" }), scope);
}

const staff = () => createUser({ role: "moderator", staff2fa: true, name: "Moderator M." });

describe("disputes (P03-01)", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("report → answer → proposal → counter-proposal → accept → resolved; the booking is completed again", async () => {
    const { lender, renter, id } = await completedBooking();
    const { id: caseId } = await openDispute(lender, open(id));
    expect((await bookingRow(id)).status).toBe("disputed");
    expect(await noticesFor(renter.id)).toContain("dispute_opened");
    await expect(openDispute(renter, open(id))).rejects.toMatchObject({ message: "case_open" });

    await addStatement(renter, { disputeId: caseId, body: "Ripen var der da jeg hentet den.", photoIds: [] });
    expect((await disputeRow(caseId)).status).toBe("in_negotiation");

    await makeProposal(lender, { disputeId: caseId, type: "partial_compensation", amountOre: 30000, text: "300 kr" });
    await makeProposal(renter, { disputeId: caseId, type: "repair", text: "Jeg polerer den selv." });
    const proposals = await owner
      .select()
      .from(schema.disputeProposals)
      .where(eq(schema.disputeProposals.disputeId, caseId));
    expect(proposals.map((p) => p.status).sort()).toEqual(["pending", "superseded"]);
    const counter = proposals.find((p) => p.status === "pending")!;
    await expect(respondToProposal(renter, { proposalId: counter.id, decision: "accept" })).rejects.toMatchObject({
      message: "own_proposal",
    });
    await respondToProposal(lender, { proposalId: counter.id, decision: "accept" });

    const d = await disputeRow(caseId);
    expect(d).toMatchObject({ status: "resolved_by_agreement", closureNote: "Jeg polerer den selv." });
    expect((await bookingRow(id)).status).toBe("completed");
    const view = await getDisputeForParty(renter, caseId);
    expect(view?.open).toBe(false);
    expect(await noticesFor(renter.id)).toContain("dispute_closed");
  });

  it("only the two parties; the database refuses accepting one's own proposal or a proposal from anyone else", async () => {
    const { lender, renter, id } = await completedBooking();
    const stranger = await createUser();
    const { id: caseId } = await openDispute(lender, open(id));
    expect(await getDisputeForParty(stranger, caseId)).toBeNull();
    await expect(loadDisputeFor(stranger, caseId, "dispute.view")).rejects.toMatchObject({ code: "not_found" });
    await expect(addStatement(stranger, { disputeId: caseId, body: "Hei", photoIds: [] })).rejects.toMatchObject({
      code: "not_found",
    });
    await makeProposal(lender, { disputeId: caseId, type: "no_compensation", text: "Glemt det" });
    const [p] = await owner.select().from(schema.disputeProposals).where(eq(schema.disputeProposals.disputeId, caseId));
    await expect(
      owner.execute(
        sql`UPDATE dispute_proposals SET responded_by = proposer_id, status = 'accepted' WHERE id = ${p!.id}`,
      ),
    ).rejects.toThrow();
    await expect(
      owner.insert(schema.disputeProposals).values({
        disputeId: caseId,
        proposerId: stranger.id,
        type: "other",
        text: "Jeg bestemmer",
      }),
    ).rejects.toThrow();
    // The case file is append-only for the app role; proposal terms cannot change.
    const [priv] = (
      await owner.execute<{ ev: boolean; txt: boolean; st: boolean }>(
        sql`SELECT has_table_privilege('laandet_app', 'dispute_events', 'UPDATE') AS ev,
                   has_column_privilege('laandet_app', 'dispute_proposals', 'text', 'UPDATE') AS txt,
                   has_column_privilege('laandet_app', 'dispute_proposals', 'status', 'UPDATE') AS st`,
      )
    ).rows;
    expect(priv).toEqual({ ev: false, txt: false, st: true });
    void renter;
  });

  it("escalation, staff grant, audited views, documentation, recommendation accepted by both", async () => {
    const { lender, renter, id } = await completedBooking();
    const mod = await staff();
    const { id: caseId } = await openDispute(lender, open(id));
    await expect(escalate(lender, caseId)).rejects.toMatchObject({ message: "escalation_not_available" });
    await escalate(lender, caseId, later(8));
    expect((await disputeRow(caseId)).status).toBe("support_review");
    expect((await listSupportQueue(mod)).map((q) => q.id)).toEqual([caseId]);

    // Without a grant, nothing; with one, every view is audited.
    await expect(getCaseForStaff(mod, caseId)).rejects.toMatchObject({ message: "grant_required" });
    await takeCase(mod, { disputeId: caseId, reason: "Saken er eskalert av utleier." });
    const view = await getCaseForStaff(mod, caseId);
    expect(view.dispute.id).toBe(caseId);
    const audits = await owner
      .select({ action: schema.auditEvents.action })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.targetId, caseId));
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["staff.grant_dispute", "staff.view_dispute"]));
    expect(await activeGrant(owner, mod.id, "dispute", caseId, later(31))).toBeNull();

    await requestDocumentation(mod, { disputeId: caseId, body: "Har dere bilder fra utleveringen?" });
    expect((await disputeRow(caseId)).status).toBe("awaiting_documentation");
    await addStatement(renter, { disputeId: caseId, body: "Se protokollen fra utleveringen.", photoIds: [] });
    expect((await disputeRow(caseId)).status).toBe("support_review");

    await recommend(mod, {
      disputeId: caseId,
      documented: "Ripen er ikke nevnt i utleveringen.",
      disagreed: "Om ripen kom under leien.",
      recommendation: "Del en eventuell kostnad likt.",
    });
    const party = await getDisputeForParty(lender, caseId);
    const recId = party!.latestRecommendation!.id;
    await answerRecommendation(lender, { disputeId: caseId, eventId: recId, decision: "accept" });
    expect((await disputeRow(caseId)).status).toBe("support_review");
    await answerRecommendation(renter, { disputeId: caseId, eventId: recId, decision: "accept" });
    expect(await disputeRow(caseId)).toMatchObject({
      status: "resolved_by_agreement",
      closureNote: "Del en eventuell kostnad likt.",
    });
  });

  it("staff never get a grant in their own case, and members never facilitate", async () => {
    const { lender, id } = await completedBooking();
    const { id: caseId } = await openDispute(lender, open(id));
    const member = await createUser();
    await expect(listSupportQueue(member)).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      owner.insert(schema.supportAccessGrants).values({
        staffId: lender.id,
        scope: "dispute",
        targetId: caseId,
        disputeId: caseId,
        reason: "Forsøk på å gi seg selv tilgang",
        expiresAt: later(1),
      }),
    ).rejects.toThrow();
  });

  it("urgent categories escalate at once; only the opener withdraws; staff close and reopen within 30 days", async () => {
    const { lender, renter, id } = await handedOverBooking();
    const mod = await staff();
    const { id: caseId } = await openDispute(lender, open(id, "not_returned"));
    expect((await bookingRow(id)).status).toBe("handed_over");
    await escalate(lender, caseId);
    await takeCase(mod, { disputeId: caseId, reason: "Gjenstanden er ikke levert tilbake." });
    await closeByStaff(mod, {
      disputeId: caseId,
      outcome: "referred_to_authority",
      note: "Utleier har meldt forholdet til politiet.",
    });
    expect((await disputeRow(caseId)).status).toBe("referred_to_authority");
    await reopenCase(mod, { disputeId: caseId, reason: "Leietaker har tatt kontakt igjen." });
    expect((await disputeRow(caseId)).status).toBe("support_review");
    await expect(withdrawDispute(renter, caseId)).rejects.toMatchObject({ code: "forbidden" });
    await withdrawDispute(lender, caseId);
    expect((await disputeRow(caseId)).status).toBe("withdrawn");
  });

  it("M2: a case the parties closed themselves, never escalated, cannot be reopened by staff", async () => {
    const { lender, id } = await completedBooking();
    const mod = await staff();
    const { id: caseId } = await openDispute(lender, open(id));
    await withdrawDispute(lender, caseId);
    expect((await listRecentlyClosed(mod)).map((c) => c.id)).not.toContain(caseId);
    await expect(reopenCase(mod, { disputeId: caseId, reason: "Vil se på saken igjen." })).rejects.toMatchObject({
      message: "reopen_not_available",
    });
  });

  it("L2: both parties accepting a recommendation at the same moment still resolve the case", async () => {
    const { lender, renter, id } = await completedBooking();
    const mod = await staff();
    const { id: caseId } = await openDispute(lender, open(id));
    await escalate(lender, caseId, later(8));
    await takeCase(mod, { disputeId: caseId, reason: "Saken er eskalert av utleier." });
    await recommend(mod, {
      disputeId: caseId,
      documented: "Ripen er ikke nevnt i utleveringen.",
      disagreed: "Om ripen kom under leien.",
      recommendation: "Del en eventuell kostnad likt.",
    });
    const recId = (await getDisputeForParty(lender, caseId))!.latestRecommendation!.id;
    await Promise.all(
      [lender, renter].map((p) => answerRecommendation(p, { disputeId: caseId, eventId: recId, decision: "accept" })),
    );
    expect((await disputeRow(caseId)).status).toBe("resolved_by_agreement");
    // A recommendation after closing is refused.
    await expect(
      recommend(mod, { disputeId: caseId, documented: "Ny.", disagreed: "Ny.", recommendation: "Ny anbefaling." }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("L3: contesting the return while a «not returned» case is open adds to that case", async () => {
    const { lender, renter, id, end } = await handedOverBooking();
    const { id: caseId } = await openDispute(lender, open(id, "not_returned"));
    await addEntry(renter, entry(id, "return", { proposedOutcome: "returned_ok" }), end);
    await confirmReport(renter, { bookingId: id, phase: "return", decision: "confirm", checklist: {}, comment: "" });
    expect(
      await confirmReport(lender, {
        bookingId: id,
        phase: "return",
        decision: "contest",
        checklist: {},
        comment: "Levert fire dager for sent, og bladet er sprukket.",
      }),
    ).toBe("contested");
    expect(await owner.select().from(schema.disputes)).toHaveLength(1);
    const statements = await owner
      .select({ body: schema.disputeEvents.body })
      .from(schema.disputeEvents)
      .where(and(eq(schema.disputeEvents.disputeId, caseId), eq(schema.disputeEvents.kind, "statement")));
    expect(statements.map((e) => e.body)).toContain("Levert fire dager for sent, og bladet er sprukket.");
    expect((await bookingRow(id)).status).toBe("disputed");
  });

  it("M4: case steps are rate-limited (audited) and a full case takes no more party entries", async () => {
    const { lender, renter, id } = await completedBooking();
    const { id: caseId } = await openDispute(lender, open(id));
    const say = (who: typeof renter) =>
      addStatement(who, { disputeId: caseId, body: "Mer informasjon.", photoIds: [] });
    await owner
      .insert(schema.appRateLimits)
      .values({ bucket: `case:user:${renter.id}`, count: 60, windowEnd: later(1) });
    await expect(say(renter)).rejects.toMatchObject({ code: "rate_limited" });
    const hits = await owner
      .select()
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.action, "abuse.rate_limited"), eq(schema.auditEvents.actorId, renter.id)));
    expect(hits).toHaveLength(1);

    await owner.insert(schema.disputeEvents).values(
      Array.from({ length: 400 }, () => ({
        disputeId: caseId,
        actorId: lender.id,
        kind: "statement" as const,
        body: "x",
      })),
    );
    await expect(say(lender)).rejects.toMatchObject({ message: "case_full" });
    expect((await getDisputeForParty(lender, caseId))!.events.length).toBeLessThanOrEqual(500);
  });

  it("a late case is accepted and marked; N12: a pending case leaves no trace on the public profile", async () => {
    const { lender, renter, id } = await completedBooking();
    await owner
      .update(schema.bookings)
      .set({ returnedAt: new Date(Date.now() - 20 * DAY) })
      .where(eq(schema.bookings.id, id));
    const { id: caseId } = await openDispute(lender, open(id, "not_as_described"));
    expect((await disputeRow(caseId)).reportedLate).toBe(true);
    const profile = JSON.stringify(await getPublicProfile(renter.id));
    expect(profile).not.toContain("ripe på håndtaket");
    expect(profile).not.toMatch(/\b(dispute|disputed|svindel|tyveri|sak under behandling)\b/i);
  });

  it("case and condition photos: the parties, and staff only with a grant (audited)", async () => {
    const { lender, renter, id } = await completedBooking();
    const stranger = await createUser();
    const mod = await staff();
    const up = await photo(lender, "dispute");
    const { id: caseId } = await openDispute(lender, { ...open(id), photoIds: [up.id] });
    expect(await mayViewDisputeMedia(renter, up.id, lender.id)).toBe(true);
    expect(await mayViewDisputeMedia(stranger, up.id, lender.id)).toBe(false);
    expect(await mayViewDisputeMedia(mod, up.id, lender.id)).toBe(false);
    // A condition photo of the same booking.
    const [handover] = await owner
      .select({ id: schema.conditionReports.id })
      .from(schema.conditionReports)
      .where(and(eq(schema.conditionReports.bookingId, id), eq(schema.conditionReports.phase, "handover")));
    expect(handover).toBeDefined();
    const cphoto = await photo(lender, "condition");
    const [e] = await owner
      .select({ id: schema.conditionEntries.id })
      .from(schema.conditionEntries)
      .where(eq(schema.conditionEntries.reportId, handover!.id));
    await owner.insert(schema.conditionPhotos).values({ entryId: e!.id, mediaId: cphoto.id });
    expect(await mayViewConditionMedia(mod, cphoto.id, lender.id)).toBe(false);

    await escalate(lender, caseId, later(8));
    await takeCase(mod, { disputeId: caseId, reason: "Ser på bildene i saken." });
    expect(await mayViewDisputeMedia(mod, up.id, lender.id)).toBe(true);
    expect(await mayViewConditionMedia(mod, cphoto.id, lender.id)).toBe(true);
    const views = await owner
      .select()
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.action, "staff.view_media"), eq(schema.auditEvents.actorId, mod.id)));
    expect(views).toHaveLength(2);
    void entry;
  });
});
