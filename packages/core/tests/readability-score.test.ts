import { describe, expect, it } from "vitest";
import { readabilityScore } from "../src/readability-score";

describe("readabilityScore", () => {
  it("returns the input unchanged by default", () => {
    expect(readabilityScore("hello")).toBe("hello");
  });

  it("applies options", () => {
    expect(readabilityScore("hello", { uppercase: true })).toBe("HELLO");
  });

  it("handles empty input", () => {
    expect(readabilityScore("")).toBe("");
  });

  // Add the edge cases that matter for this tool: unicode, very long input, malformed input, etc.
});
