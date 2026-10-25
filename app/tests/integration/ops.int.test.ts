import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { GET as healthz } from "@/app/healthz/route";
import { checkOpsAlerts } from "@/modules/ops/alerts";
import { runJob } from "../../worker/jobs";
import { owner, resetDb } from "./helpers";

const HOUR = 60 * 60 * 1000;
const TO = "drift@example.test";
const INTERVALS = { email_outbox: 0, retention: 24 * 3600 };

async function alerts() {
  return owner.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.template, "ops_alert"));
}

describe("operations alerts (P04-04)", () => {
  beforeEach(resetDb);

  it("the worker counts failures in a row, with redacted errors, and resets on success", async () => {
    const failing = {
      name: "test_job",
      everySeconds: 60,
      run: async () => {
        throw new Error("SMTP refused ola.nordmann@example.no at https://x.example/?token=abc");
      },
    };
    for (let i = 0; i < 3; i++) await runJob(owner, failing);
    const [h] = await owner.select().from(schema.workerHeartbeats).where(eq(schema.workerHeartbeats.job, "test_job"));
    expect(h!.failCount).toBe(3);
    expect(h!.lastError).not.toMatch(/ola\.nordmann|token=abc/);
    await runJob(owner, { ...failing, run: async () => undefined });
    const [ok] = await owner.select().from(schema.workerHeartbeats).where(eq(schema.workerHeartbeats.job, "test_job"));
    expect(ok!.failCount).toBe(0);
  });

  it("one alert after three failures, a reminder after 6 hours, one recovery email; nothing without a recipient", async () => {
    const now = new Date();
    await owner.insert(schema.workerHeartbeats).values({
      job: "email_outbox",
      lastRunAt: now,
      failCount: 3,
      lastError: "connect ECONNREFUSED",
    });
    expect(await checkOpsAlerts(INTERVALS, now, undefined)).toBe(0);
    expect(await checkOpsAlerts(INTERVALS, now, TO)).toBe(1);
    expect(await checkOpsAlerts(INTERVALS, new Date(now.getTime() + HOUR), TO)).toBe(0);
    expect(await checkOpsAlerts(INTERVALS, new Date(now.getTime() + 7 * HOUR), TO)).toBe(1);

    await owner
      .update(schema.workerHeartbeats)
      .set({ failCount: 0, lastError: null, lastRunAt: new Date(now.getTime() + 8 * HOUR) })
      .where(eq(schema.workerHeartbeats.job, "email_outbox"));
    expect(await checkOpsAlerts(INTERVALS, new Date(now.getTime() + 8 * HOUR), TO)).toBe(1);
    expect(await checkOpsAlerts(INTERVALS, new Date(now.getTime() + 8 * HOUR + 5 * 60 * 1000), TO)).toBe(0);

    const sent = await alerts();
    expect(sent.map((s) => s.payload)).toEqual([
      expect.objectContaining({ job: "email_outbox", state: "failing", error: "connect ECONNREFUSED" }),
      expect.objectContaining({ job: "email_outbox", state: "failing" }),
      expect.objectContaining({ job: "email_outbox", state: "recovered", error: "" }),
    ]);
    // Only the operator's address, no user, and only the four fields.
    expect(sent.every((s) => s.toEmail === TO && s.toUserId === null)).toBe(true);
    expect(Object.keys(sent[0]!.payload as object).sort()).toEqual(["error", "job", "lastRun", "state"]);
  });

  it("an overdue job is reported; a job that no longer exists is ignored", async () => {
    const now = new Date();
    await owner.insert(schema.workerHeartbeats).values([
      { job: "retention", lastRunAt: new Date(now.getTime() - 4 * 24 * HOUR), failCount: 0 },
      { job: "removed_job", lastRunAt: new Date(now.getTime() - 30 * 24 * HOUR), failCount: 9 },
    ]);
    expect(await checkOpsAlerts(INTERVALS, now, TO)).toBe(1);
    expect((await alerts())[0]!.payload).toMatchObject({ job: "retention", state: "overdue" });
  });

  it("/healthz?worker=1 fails while the worker is silent; plain /healthz does not look at it", async () => {
    const get = (q = "") => healthz(new Request(`http://localhost/healthz${q}`));
    expect((await get()).status).toBe(200);
    const silent = await get("?worker=1");
    expect(silent.status).toBe(503);
    expect(await silent.json()).toMatchObject({ worker: "fail" });
    await owner.insert(schema.workerHeartbeats).values({ job: "email_outbox", lastRunAt: new Date() });
    expect((await get("?worker=1")).status).toBe(200);
  });
});
