import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { signUp } from "@/modules/auth/service";
import { owner, resetDb } from "./helpers";

const base = {
  name: "Kari N.",
  email: "kari@example.test",
  password: "en lang og trygg setning",
  locality: "nordfold",
  age18: "on" as const,
  privateUse: "on" as const,
  terms: "on" as const,
  locale: "nb" as const,
  website: "",
};

describe("sign-up (P01-05)", () => {
  beforeEach(resetDb);

  it("creates the profile, records consent to the current terms and privacy texts, and queues verification", async () => {
    const startedAt = Date.now() - 10_000;
    await signUp({ ...base, startedAt });
    const [u] = await owner.select().from(schema.users).where(eq(schema.users.email, base.email));
    expect(u?.emailVerified).toBe(false);
    const [p] = await owner.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, u!.id));
    expect(p?.age18ConfirmedAt).toBeInstanceOf(Date);
    expect(p?.privateUseConfirmedAt).toBeInstanceOf(Date);
    const accepted = await owner
      .select({ key: schema.legalDocumentVersions.docKey })
      .from(schema.legalAcceptances)
      .innerJoin(
        schema.legalDocumentVersions,
        eq(schema.legalDocumentVersions.id, schema.legalAcceptances.documentVersionId),
      )
      .where(eq(schema.legalAcceptances.userId, u!.id));
    expect(accepted.map((a) => a.key).sort()).toEqual(["privacy", "terms"]);
    const mails = await owner.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.toEmail, base.email));
    expect(mails.map((m) => m.template)).toEqual(["verify_email"]);
  });

  it("answers the same for an existing email and informs the owner instead (no enumeration)", async () => {
    await signUp({ ...base, startedAt: Date.now() - 10_000 });
    await expect(signUp({ ...base, name: "Noen andre", startedAt: Date.now() - 10_000 })).resolves.toBeUndefined();
    const mails = await owner.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.toEmail, base.email));
    expect(mails.map((m) => m.template).sort()).toEqual(["existing_account_signup", "verify_email"]);
    const users = await owner.select().from(schema.users).where(eq(schema.users.email, base.email));
    expect(users).toHaveLength(1);
  });

  it("rejects bots: filled honeypot or a form sent in under 3 seconds", async () => {
    await expect(
      signUp({ ...base, website: "http://spam.example", startedAt: Date.now() - 10_000 }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(signUp({ ...base, startedAt: Date.now() - 500 })).rejects.toMatchObject({
      code: "validation",
      message: "too_fast",
    });
    expect(await owner.select().from(schema.users)).toHaveLength(0);
  });

  it("recovers an interrupted sign-up (account row without a profile) instead of locking the address", async () => {
    await owner.insert(schema.users).values({ name: "Halvferdig", email: base.email, emailVerified: false });
    await signUp({ ...base, startedAt: Date.now() - 10_000 });
    const [u] = await owner.select().from(schema.users).where(eq(schema.users.email, base.email));
    const profiles = await owner.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, u!.id));
    expect(u?.name).toBe(base.name);
    expect(profiles).toHaveLength(1);
  });
});
