import { execFileSync } from "node:child_process";
import { applyTestEnv } from "./env";

/** Once per run: migrations, reference data and legal texts in the test database (all idempotent). */
export default function setup() {
  applyTestEnv();
  const run = (script: string, ...args: string[]) =>
    execFileSync(process.execPath, ["--import", "tsx", script, ...args], { stdio: "inherit", env: process.env });
  run("scripts/migrate.ts");
  run("scripts/seed.ts");
  run("scripts/load-legal.ts");
}
