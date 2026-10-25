/**
 * Background worker: `npm run worker` (loop) or `npm run worker -- --once`.
 * Runs in its own container in production (ARCHITECTURE.md §4.11).
 */
import { db } from "@/db/client";
import { JOBS, runJob } from "./jobs";
import { logError } from "@/modules/server/log";

const LOOP_MS = 60_000;
const lastRun = new Map<string, number>();
let stopping = false;

async function tick() {
  for (const job of JOBS) {
    const last = lastRun.get(job.name) ?? 0;
    if (Date.now() - last >= job.everySeconds * 1000) {
      lastRun.set(job.name, Date.now());
      await runJob(db, job);
    }
  }
}

async function main() {
  const once = process.argv.includes("--once");
  console.info(`[worker] started (${once ? "once" : "loop"})`);
  do {
    await tick();
    if (once) break;
    await new Promise((r) => setTimeout(r, LOOP_MS));
  } while (!stopping);
  process.exit(0);
}

process.on("SIGTERM", () => {
  stopping = true;
});

main().catch((err) => {
  logError("[worker] stopped", err);
  process.exit(1);
});
