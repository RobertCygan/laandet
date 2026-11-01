import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { feedbackSchema, listFeedback, markFeedbackHandled, sendFeedback } from "@/modules/feedback/service";
import { eraseAccount } from "@/modules/privacy/erasure";
import { buildDataExport } from "@/modules/privacy/export";
import { purgeFeedback } from "@/modules/privacy/retention";
import { createUser, owner, resetDb } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const input = (body: string, pagePath?: string) => feedbackSchema.parse({ kind: "error", body, pagePath });

describe("«Gi tilbakemelding» (P04-01)", () => {
  beforeEach(resetDb);

  it("members send it (page path without query), staff list it and mark it handled once (audited)", async () => {
    const member = await createUser({ name: "Tester T." });
    const mod = await createUser({ role: "moderator", staff2fa: true });
    await sendFeedback(member, input("Knappen «Lagre» svarer ikke på mobilen.", "/annonse/abc?token=hemmelig#x"));
    const [row] = await owner.select().from(schema.feedback);
    expect(row).toMatchObject({ userId: member.id, status: "open", pagePath: "/annonse/abc" });

    await expect(listFeedback(member)).rejects.toMatchObject({ code: "forbidden" });
    const list = await listFeedback(mod);
    expect(list.open.map((f) => [f.senderName, f.body])).toEqual([
      ["Tester T.", "Knappen «Lagre» svarer ikke på mobilen."],
    ]);
    await markFeedbackHandled(mod, row!.id);
    await expect(markFeedbackHandled(mod, row!.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await listFeedback(mod)).handled).toHaveLength(1);
    const audits = await owner
      .select()
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.action, "feedback.handled"), eq(schema.auditEvents.targetId, row!.id)));
    expect(audits).toHaveLength(1);
  });

  it("is limited to ten a day, refused for visitors and suspended accounts, and checks its input", async () => {
    const member = await createUser();
    for (let i = 0; i < 10; i++) await sendFeedback(member, input(`Tilbakemelding nummer ${i}`));
    await expect(sendFeedback(member, input("Den ellevte"))).rejects.toMatchObject({ code: "rate_limited" });
    await expect(sendFeedback({ kind: "anonymous" }, input("Fra en besøkende"))).rejects.toMatchObject({
      code: "auth_required",
    });
    const suspended = await createUser({ status: "suspended" });
    await expect(sendFeedback(suspended, input("Fra en utestengt konto"))).rejects.toMatchObject({
      code: "account_restricted",
    });
    expect(feedbackSchema.safeParse({ kind: "error", body: "x" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ kind: "spam", body: "Gyldig tekst" }).success).toBe(false);
    expect(feedbackSchema.parse({ kind: "other", body: "Hei", pagePath: "javascript:alert(1)" }).pagePath).toBeNull();
  });

  it("is in the data export, removed with the account, and purged after 12 months", async () => {
    const member = await createUser();
    await sendFeedback(member, input("Teksten på forsiden er uklar."));
    expect((await buildDataExport(member)).feedback.map((f) => f.body)).toEqual(["Teksten på forsiden er uklar."]);

    const old = await createUser();
    await owner.insert(schema.feedback).values([
      { userId: old.id, kind: "other", body: "Gammel tilbakemelding", createdAt: new Date(Date.now() - 400 * DAY) },
      { userId: old.id, kind: "other", body: "Ny tilbakemelding" },
    ]);
    expect(await purgeFeedback()).toBe(1);

    await owner
      .update(schema.userProfiles)
      .set({ status: "deletion_pending" })
      .where(eq(schema.userProfiles.userId, member.id));
    await eraseAccount(member.id);
    expect(await owner.select().from(schema.feedback).where(eq(schema.feedback.userId, member.id))).toHaveLength(0);
  });
});
