import { describe, expect, it } from "vitest";
import { safeError } from "./log";

describe("safeError (SEC-43)", () => {
  it("drops the query parameters and emails of a failed database query", () => {
    const err = new Error(
      'Failed query: insert into "messages" ("body") values ($1)\nparams: Ring meg på 99 99 99 99,ola@example.no',
    );
    (err as { cause?: unknown }).cause = { code: "23505", detail: "Key (email)=(ola@example.no) already exists." };
    const out = safeError(err);
    expect(out.code).toBe("23505");
    expect(JSON.stringify(out)).not.toMatch(/Ring meg|ola@example\.no|99 99/);
    expect(out.message).toContain("[redacted]");
  });

  it("keeps ordinary messages short and handles non-errors", () => {
    expect(safeError(new Error("x".repeat(1000))).message).toHaveLength(300);
    expect(safeError("boom")).toEqual({ name: "NonError", message: "non-error thrown" });
    expect(safeError(new Error("Kontakt ola@example.no")).message).toBe("Kontakt [email]");
  });
});
