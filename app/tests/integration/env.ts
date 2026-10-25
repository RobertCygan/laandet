import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Integration tests run against a dedicated *_test database only. The URLs come from
 * TEST_DATABASE_URL / TEST_DATABASE_MIGRATION_URL (CI) or the local defaults from
 * scripts/db-setup-local.sh. A dev or production DATABASE_URL is never used.
 */
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://laandet_app:laandet_app_dev@localhost:5432/laandet_test";
export const TEST_DB_OWNER_URL =
  process.env.TEST_DATABASE_MIGRATION_URL ?? "postgres://laandet_owner:laandet_owner_dev@localhost:5432/laandet_test";

for (const url of [TEST_DB_URL, TEST_DB_OWNER_URL]) {
  if (!new URL(url).pathname.endsWith("_test"))
    throw new Error(
      `Refusing to run integration tests against ${new URL(url).pathname}: the database name must end with _test`,
    );
}

export function applyTestEnv(): void {
  const mediaDir = path.join(os.tmpdir(), "laandet-test-media");
  // /healthz reports the media volume; on a fresh CI machine it must exist before the server starts.
  mkdirSync(mediaDir, { recursive: true });
  Object.assign(process.env, {
    APP_ENV: "test",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: TEST_DB_URL,
    DATABASE_MIGRATION_URL: TEST_DB_OWNER_URL,
    BETTER_AUTH_SECRET: "integration-test-secret-integration-test-secret",
    IP_HASH_KEY: "integration-test-ip-hash-key-integration-test",
    MEDIA_DIR: mediaDir,
    SMTP_URL: "",
    HIBP_ENABLED: "false",
    MAIL_FROM: "Laandet <noreply@example.invalid>",
  });
}
