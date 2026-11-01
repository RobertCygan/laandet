import { execFileSync } from "node:child_process";
import { closeOwner, resetDb } from "../integration/helpers";

/** Fresh data for the browser tests: migrations, reference data, labelled demo listings and legal texts. */
export default async function globalSetup() {
  const run = (script: string, ...args: string[]) =>
    execFileSync(process.execPath, ["--import", "tsx", script, ...args], { stdio: "inherit", env: process.env });
  run("scripts/migrate.ts");
  await resetDb();
  await closeOwner();
  run("scripts/seed.ts", "--demo");
  run("scripts/load-legal.ts");
}
