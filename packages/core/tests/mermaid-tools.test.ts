import { describe, expect, it } from "vitest";
import { checkDiagramText, cleanDiagramError, DIAGRAM_KINDS, DIAGRAM_SAMPLES, detectDiagram, diagramFileName, MAX_DIAGRAM_CHARS, pngSize, standaloneSvg, svgSize } from "../src/mermaid-tools";

describe("detectDiagram", () => {
  it("recognises each diagram type by its first word", () => {
    const cases: Record<string, string> = {
      "graph TD\n A-->B": "flowchart",
      "flowchart LR\n A-->B": "flowchart",
      "sequenceDiagram\n A->>B: hi": "sequence",
      "classDiagram\n class A": "class",
      "stateDiagram-v2\n [*] --> A": "state",
      "erDiagram\n A ||--o{ B : has": "er",
      "gantt\n title X": "gantt",
      'pie title X\n "a": 1': "pie",
      "journey\n title X": "journey",
      "gitGraph\n commit": "git",
      "mindmap\n root": "mindmap",
      "timeline\n 2020 : x": "timeline",
      "quadrantChart\n title X": "quadrant",
      "C4Context\n title X": "c4",
      "xychart-beta\n title X": "xychart",
      "sankey-beta\n a,b,1": "sankey",
      "architecture-beta\n group g": "architecture",
    };
    for (const [text, kind] of Object.entries(cases)) expect(detectDiagram(text).kind?.id, text).toBe(kind);
  });

  it("skips front matter, directives and comments before the diagram", () => {
    const info = detectDiagram('---\ntitle: "My flow"\nconfig:\n  theme: forest\n---\n%%{init: {"theme":"dark"}}%%\n%% a comment\n\nflowchart TD\n  A-->B');
    expect(info.kind?.id).toBe("flowchart");
    expect(info.title).toBe("My flow");
    expect(info.body.startsWith("flowchart TD")).toBe(true);
  });

  it("returns no kind for text that is not a diagram", () => {
    expect(detectDiagram("hello world").kind).toBeNull();
    expect(detectDiagram("").kind).toBeNull();
    expect(detectDiagram("%% only a comment").body).toBe("");
    expect(detectDiagram("---\ntitle: only a title\n---\n").body).toBe("");
  });

  it("is case sensitive like Mermaid itself", () => {
    expect(detectDiagram("Flowchart TD").kind).toBeNull();
    expect(detectDiagram("sequencediagram").kind).toBeNull();
  });
});

describe("checkDiagramText", () => {
  it("accepts a real diagram", () => {
    expect(checkDiagramText("flowchart TD\n A-->B")).toBeNull();
  });

  it("explains empty, title-only, unknown and oversized text", () => {
    expect(checkDiagramText("  ")).toMatch(/Write or paste/);
    expect(checkDiagramText("---\ntitle: x\n---")).toMatch(/only a title or comments/);
    expect(checkDiagramText("hello there")).toMatch(/“hello” is not a Mermaid diagram type/);
    expect(checkDiagramText(`flowchart TD\n${"A-->B\n".repeat(MAX_DIAGRAM_CHARS)}`)).toMatch(/The limit is 50,000/);
  });
});

describe("cleanDiagramError", () => {
  it("keeps the useful first lines, drops markup and stack frames", () => {
    const raw = "Parse error on line 3:\n...A --> \n-----------^\nExpecting 'SPACE', got 'EOF'\n    at Parser.parseError (mermaid.js:1:2)\n<b>x</b>";
    const out = cleanDiagramError(raw);
    expect(out).toContain("Parse error on line 3");
    expect(out).not.toContain("at Parser");
    expect(out).not.toContain("<b>");
  });

  it("limits length and has a fallback", () => {
    expect(cleanDiagramError("x".repeat(2000)).length).toBeLessThanOrEqual(601);
    expect(cleanDiagramError("")).toBe("The diagram could not be drawn.");
  });
});

describe("svgSize and standaloneSvg", () => {
  const drawn = '<svg id="mermaid-1" width="100%" xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 320.5 180" style="max-width: 320.5px;" role="graphics-document"><style>.a{fill:red}</style><g class="a"/></svg>';

  it("reads the size from the viewBox, or from width and height", () => {
    expect(svgSize(drawn)).toEqual({ x: -8, y: -8, width: 320.5, height: 180 });
    expect(svgSize('<svg width="200px" height="100"></svg>')).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(svgSize('<svg width="100%"></svg>')).toBeNull();
    expect(svgSize("not svg")).toBeNull();
    expect(svgSize('<svg viewBox="0 0 0 0"></svg>')).toBeNull();
  });

  it("gives the drawing a fixed size and removes the page-width styling", () => {
    const out = standaloneSvg(drawn);
    expect(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg width="321" height="180"')).toBe(true);
    expect(out).not.toContain('width="100%"');
    expect(out).not.toContain("max-width");
    expect(out).toContain('viewBox="-8 -8 320.5 180"');
    expect(out).toContain("<style>.a{fill:red}</style>");
  });

  it("adds the namespace when it is missing, and a background behind everything", () => {
    const out = standaloneSvg('<svg viewBox="0 0 10 10"><g/></svg>', { background: "#ffffff" });
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toMatch(/<svg[^>]*><rect x="0" y="0" width="10" height="10" fill="#ffffff"\/><g\/>/);
  });

  it("puts the background rectangle at the origin of an offset viewBox", () => {
    expect(standaloneSvg(drawn, { background: "#111" })).toContain('<rect x="-8" y="-8" width="320.5" height="180" fill="#111"/>');
  });

  it("does not let the background colour break out of the attribute", () => {
    const out = standaloneSvg('<svg viewBox="0 0 10 10"></svg>', { background: '"/><script>alert(1)</script>' });
    expect(out).not.toContain("<script");
  });

  it("refuses a drawing with no size", () => {
    expect(() => standaloneSvg("<svg></svg>")).toThrow(/no size/);
  });
});

describe("pngSize", () => {
  it("scales the drawing", () => {
    expect(pngSize(300, 200, 2)).toEqual({ width: 600, height: 400, scale: 2, capped: false });
  });

  it("lowers the scale for a huge drawing and says so", () => {
    const r = pngSize(8000, 6000, 3);
    expect(r.capped).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(16_000_000 * 1.001);
    expect(r.scale).toBeLessThan(3);
  });

  it("never returns zero", () => {
    expect(pngSize(1, 1, 0.01).width).toBe(1);
  });
});

describe("diagramFileName", () => {
  it("makes a safe name from the title, or the kind", () => {
    expect(diagramFileName("Sign-in flow (v2)!", null)).toBe("sign-in-flow-v2");
    expect(diagramFileName(undefined, DIAGRAM_KINDS[1] ?? null)).toBe("sequence-diagram");
    expect(diagramFileName("../../etc/passwd", null)).toBe("etc-passwd");
    expect(diagramFileName("日本語", null)).toBe("diagram");
    expect(diagramFileName(undefined, null)).toBe("diagram");
  });
});

describe("samples", () => {
  it("every sample is a recognised diagram of the type it says, within the size limit", () => {
    expect(DIAGRAM_SAMPLES.length).toBeGreaterThanOrEqual(10);
    for (const s of DIAGRAM_SAMPLES) {
      expect(checkDiagramText(s.code), s.id).toBeNull();
      expect(detectDiagram(s.code).kind?.id, s.id).toBe(s.kind);
    }
    expect(new Set(DIAGRAM_SAMPLES.map((s) => s.id)).size).toBe(DIAGRAM_SAMPLES.length);
  });

  it("the flowchart sample carries a title for the file name", () => {
    expect(detectDiagram(DIAGRAM_SAMPLES[0]!.code).title).toBe("Sign-in flow");
  });
});
