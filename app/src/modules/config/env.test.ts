import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hibpEnabled, parseEnv } from "./env";

const base = {
  APP_ENV: "production",
  APP_URL: "https://laandet.example",
  DATABASE_URL: "postgres://laandet_app:x@db:5432/laandet",
  BETTER_AUTH_SECRET: "a".repeat(64),
  IP_HASH_KEY: "b".repeat(64),
  MEDIA_DIR: "/data/media",
  SMTP_URL: "smtps://user%40example.no:pw@smtp.example.no:465",
  OPERATOR_LEGAL_NAME: "Ola Nordmann",
  OPERATOR_ORGNR: "ikke registrert",
  OPERATOR_ADDRESS: "Gate 1, 8000 Bodø",
  OPERATOR_EMAIL: "post@example.no",
};

describe("environment", () => {
  it("treats an empty HIBP_ENABLED as unset, so the breached-password check stays on in production", () => {
    const e = parseEnv({ ...base, HIBP_ENABLED: "" });
    expect(e.HIBP_ENABLED).toBeUndefined();
    expect(hibpEnabled(e)).toBe(true);
    expect(hibpEnabled(parseEnv({ ...base, HIBP_ENABLED: "false" }))).toBe(false);
  });

  it("accepts every setting the server gets from deploy/env/app.env.example once the secrets are filled in", () => {
    const example = readFileSync(path.join(import.meta.dirname, "../../../../deploy/env/app.env.example"), "utf8");
    const values: Record<string, string> = {};
    for (const line of example.split("\n")) {
      const [, key, value] = /^([A-Z0-9_]+)=(.*)$/.exec(line) ?? [];
      if (key !== undefined && value !== undefined) values[key] = value.replace(/^"(.*)"$/, "$1");
    }
    // What deploy/bootstrap.sh fills in on the server.
    Object.assign(values, {
      DATABASE_URL: base.DATABASE_URL,
      BETTER_AUTH_SECRET: base.BETTER_AUTH_SECRET,
      IP_HASH_KEY: base.IP_HASH_KEY,
      SMTP_URL: base.SMTP_URL,
    });
    expect(() => parseEnv(values)).not.toThrow();
  });

  it("refuses production without the mailbox", () => {
    expect(() => parseEnv({ ...base, SMTP_URL: "" })).toThrow(/SMTP_URL is required in production/);
  });
});
