import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./page";

describe("safeRedirectPath (no open redirects after sign-in)", () => {
  it("accepts same-site paths", () => {
    expect(safeRedirectPath("/ny-annonse")).toBe("/ny-annonse");
    expect(safeRedirectPath("/en/annonse/abc?lagret=1#x")).toBe("/en/annonse/abc?lagret=1#x");
  });
  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://evil.example",
    "evil",
    "",
    "/ /x",
  ])("rejects %j", (v) => expect(safeRedirectPath(v)).toBeUndefined());
});
