import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import type { DbOrTx } from "@/db/client";
import { emailOutbox } from "@/db/schema";
import { env } from "@/modules/config/env";
import { isEmailTemplate, renderEmail, type EmailTemplate } from "./email-templates";

export async function queueEmail(
  db: DbOrTx,
  input: {
    toEmail: string;
    toUserId?: string | null;
    template: EmailTemplate;
    locale: "nb" | "en";
    payload: Record<string, string>;
  },
): Promise<void> {
  await db.insert(emailOutbox).values({
    toEmail: input.toEmail,
    toUserId: input.toUserId ?? null,
    template: input.template,
    locale: input.locale,
    payload: input.payload,
  });
}

type Transport = { send(to: string, subject: string, text: string): Promise<void> };

function transport(): Transport {
  const e = env();
  if (!e.SMTP_URL) {
    // Development/test only (production requires SMTP_URL, see env.ts).
    return {
      async send(to, subject, text) {
        console.info(`[email:log-transport] to=${to} subject="${subject}"\n${text}\n`);
      },
    };
  }
  const t = nodemailer.createTransport(e.SMTP_URL);
  return {
    async send(to, subject, text) {
      await t.sendMail({ from: e.MAIL_FROM, to, subject, text });
    },
  };
}

const MAX_ATTEMPTS = 5;

/** Sends due outbox rows. Safe to run concurrently (SKIP LOCKED). Returns number sent. */
export async function sendDueEmails(db: DbOrTx, limit = 20): Promise<number> {
  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE email_outbox SET status = 'sending', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM email_outbox
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const ids = claimed.rows.map((r) => r.id);
  if (ids.length === 0) return 0;
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(inArray(emailOutbox.id, ids))
    .orderBy(asc(emailOutbox.createdAt));
  const t = transport();
  let sent = 0;
  for (const row of rows) {
    try {
      if (!isEmailTemplate(row.template)) throw new Error(`unknown template ${row.template}`);
      const { subject, text } = renderEmail(row.template, row.locale, row.payload);
      await t.send(row.toEmail, subject, text);
      await db
        .update(emailOutbox)
        .set({ status: "sent", sentAt: new Date(), lastError: null })
        .where(eq(emailOutbox.id, row.id));
      sent++;
    } catch (err) {
      const failed = row.attempts >= MAX_ATTEMPTS;
      const backoffMinutes = 2 ** row.attempts;
      await db
        .update(emailOutbox)
        .set({
          status: failed ? "failed" : "pending",
          lastError: err instanceof Error ? err.message.slice(0, 500) : "send failed",
          nextAttemptAt: sql`now() + make_interval(mins => ${backoffMinutes})`,
        })
        .where(eq(emailOutbox.id, row.id));
    }
  }
  return sent;
}

/** Re-queue rows stuck in 'sending' (e.g. worker crashed mid-send). */
export async function releaseStuckEmails(db: DbOrTx): Promise<void> {
  await db
    .update(emailOutbox)
    .set({ status: "pending" })
    .where(
      and(
        eq(emailOutbox.status, "sending"),
        lte(emailOutbox.nextAttemptAt, sql`now() - interval '10 minutes'`),
      ),
    );
}
