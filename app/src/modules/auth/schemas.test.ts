import { describe, expect, it } from "vitest";
import { passwordSchema } from "./schemas";

describe("password rules (AUTH_MODEL §1, D-056)", () => {
  it("accepts 6 to 128 characters and nothing shorter or longer", () => {
    expect(passwordSchema.safeParse("12345").success).toBe(false);
    expect(passwordSchema.safeParse("hytte9").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });
});
