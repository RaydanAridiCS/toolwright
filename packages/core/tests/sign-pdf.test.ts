import { describe, expect, it } from "vitest";
import { signPdf } from "../src/sign-pdf";

describe("signPdf", () => {
  it("returns the input unchanged by default", () => {
    expect(signPdf("hello")).toBe("hello");
  });

  it("applies options", () => {
    expect(signPdf("hello", { uppercase: true })).toBe("HELLO");
  });

  it("handles empty input", () => {
    expect(signPdf("")).toBe("");
  });

  // Add the edge cases that matter for this tool: unicode, very long input, malformed input, etc.
});
