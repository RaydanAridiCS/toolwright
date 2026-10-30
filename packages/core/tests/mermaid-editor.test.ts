import { describe, expect, it } from "vitest";
import { mermaidEditor } from "../src/mermaid-editor";

describe("mermaidEditor", () => {
  it("returns the input unchanged by default", () => {
    expect(mermaidEditor("hello")).toBe("hello");
  });

  it("applies options", () => {
    expect(mermaidEditor("hello", { uppercase: true })).toBe("HELLO");
  });

  it("handles empty input", () => {
    expect(mermaidEditor("")).toBe("");
  });

  // Add the edge cases that matter for this tool: unicode, very long input, malformed input, etc.
});
