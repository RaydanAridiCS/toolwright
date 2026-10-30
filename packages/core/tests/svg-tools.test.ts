import { describe, expect, it } from "vitest";
import { aspectHeight, fixSvg, formatSvg, lengthToPx, padBox, parseViewBox, setSvgSize, setSvgViewBox, svgInfo, viewBoxText } from "../src/svg-tools";
import { getAttr, parseSvg } from "../src/svg-xml";

const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><g><path d="M0 0h24v24H0z"/><circle cx="12" cy="12" r="5"/></g></svg>';

describe("parseViewBox and lengthToPx", () => {
  it("reads four numbers separated by spaces or commas", () => {
    expect(parseViewBox("0 0 24 24")).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(parseViewBox("-8,-8, 100.5 ,50")).toEqual({ x: -8, y: -8, width: 100.5, height: 50 });
    expect(parseViewBox("0 0 0 10")).toBeNull();
    expect(parseViewBox("0 0 10")).toBeNull();
    expect(parseViewBox("a b c d")).toBeNull();
    expect(parseViewBox(undefined)).toBeNull();
  });

  it("converts CSS lengths to pixels", () => {
    expect(lengthToPx("24")).toBe(24);
    expect(lengthToPx("24px")).toBe(24);
    expect(lengthToPx("1in")).toBe(96);
    expect(lengthToPx("25.4mm")).toBeCloseTo(96, 6);
    expect(lengthToPx("12pt")).toBeCloseTo(16, 6);
    expect(lengthToPx("100%")).toBeNull();
    expect(lengthToPx("auto")).toBeNull();
    expect(lengthToPx(undefined)).toBeNull();
  });

  it("writes a viewBox without noise", () => {
    expect(viewBoxText({ x: 0, y: -1.5, width: 24.0004, height: 10 })).toBe("0 -1.5 24 10");
  });
});

describe("svgInfo", () => {
  it("counts elements and tags, and finds no problem in a good file", () => {
    const info = svgInfo(GOOD);
    expect(info.elements).toBe(4);
    expect(info.tags).toEqual([{ name: "circle", count: 1 }, { name: "g", count: 1 }, { name: "path", count: 1 }, { name: "svg", count: 1 }]);
    expect(info.viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(info.hasNamespace).toBe(true);
    expect(info.issues).toEqual([]);
    expect(info.bytes).toBe(GOOD.length);
  });

  it("flags a missing namespace as an error that can be fixed", () => {
    const info = svgInfo('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
    expect(info.issues[0]).toMatchObject({ severity: "error", fix: "namespace" });
  });

  it("flags a missing viewBox, and offers a fix only when width and height can be used", () => {
    const withSize = svgInfo('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"/>');
    expect(withSize.issues.find((i) => /viewBox/.test(i.message))?.fix).toBe("viewbox");
    const percent = svgInfo('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"/>');
    expect(percent.issues.find((i) => /viewBox/.test(i.message))?.fix).toBeUndefined();
    const nothing = svgInfo('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(nothing.issues.some((i) => /no size at all/.test(i.message))).toBe(true);
  });

  it("warns about scripts, event handlers and outside references", () => {
    const risky = svgInfo(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>x()</script><rect onclick="y()" onload="z()" width="1" height="1"/><image href="https://example.com/a.png"/><style>@import "https://fonts.example.com/f.css"; .a{background:url(//cdn.example.com/b.png)}</style></svg>',
    );
    const messages = risky.issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/1 <script> element and 2 event handler attributes/);
    expect(messages).toMatch(/refers to 3 addresses outside the file/);
    expect(messages).toContain("https://example.com/a.png");
  });

  it("notes embedded bitmaps, text and size", () => {
    const info = svgInfo(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="data:image/png;base64,AAAA"/><text>Hi</text><!--${"x".repeat(120_000)}--></svg>`);
    const messages = info.issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/embeds 1 bitmap picture/);
    expect(messages).toMatch(/uses <text>/);
    expect(messages).toMatch(/Optimizer can usually shrink/);
  });

  it("throws a located error for text that is not an SVG", () => {
    expect(() => svgInfo("<svg><g></svg>")).toThrow(/closed by/);
  });
});

describe("formatSvg", () => {
  it("indents with spaces or a tab, and ends with a newline", () => {
    expect(formatSvg("<svg><g><path/></g></svg>")).toBe("<svg>\n  <g>\n    <path/>\n  </g>\n</svg>\n");
    expect(formatSvg("<svg><g/></svg>", "tab")).toBe("<svg>\n\t<g/>\n</svg>\n");
    expect(formatSvg("<svg><g/></svg>", 4)).toBe("<svg>\n    <g/>\n</svg>\n");
  });
});

describe("fixSvg", () => {
  it("adds the namespace and a viewBox from the size", () => {
    const r = fixSvg('<svg width="30" height="15"><rect width="30" height="15"/></svg>');
    expect(r.applied).toHaveLength(2);
    const { root } = parseSvg(r.svg);
    expect(getAttr(root, "xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(getAttr(root, "viewBox")).toBe("0 0 30 15");
    expect(r.svg.startsWith('<svg xmlns=')).toBe(true);
  });

  it("changes nothing when there is nothing to fix", () => {
    const r = fixSvg(GOOD);
    expect(r.applied).toEqual([]);
    expect(r.svg).toBe(GOOD);
  });

  it("does not invent a viewBox from percentages", () => {
    const r = fixSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"/>');
    expect(r.applied).toEqual([]);
  });

  it("does not duplicate a wrong xmlns", () => {
    const r = fixSvg('<svg xmlns="http://wrong" viewBox="0 0 1 1"/>');
    expect(r.svg.match(/xmlns=/g)).toHaveLength(1);
    expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});

describe("size and viewBox edits", () => {
  it("sets and removes width and height", () => {
    const sized = setSvgSize(GOOD, 100, 50);
    expect(getAttr(parseSvg(sized).root, "width")).toBe("100");
    expect(getAttr(parseSvg(sized).root, "viewBox")).toBe("0 0 24 24");
    const bare = parseSvg(setSvgSize(GOOD, null, null)).root;
    expect(getAttr(bare, "width")).toBeUndefined();
    expect(() => setSvgSize(GOOD, 0, 10)).toThrow(/width must be a number above 0/);
  });

  it("replaces the viewBox", () => {
    expect(getAttr(parseSvg(setSvgViewBox(GOOD, { x: -2, y: -2, width: 28, height: 28 })).root, "viewBox")).toBe("-2 -2 28 28");
    expect(() => setSvgViewBox(GOOD, { x: 0, y: 0, width: 0, height: 5 })).toThrow(/above 0/);
  });

  it("keeps the shape when the width changes", () => {
    expect(aspectHeight('<svg viewBox="0 0 200 100"/>', 50)).toBe(25);
    expect(aspectHeight('<svg width="10" height="40"/>', 5)).toBe(20);
    expect(aspectHeight("<svg/>", 5)).toBeNull();
  });

  it("pads a box on all sides", () => {
    expect(padBox({ x: 0, y: 0, width: 10, height: 20 }, 2)).toEqual({ x: -2, y: -2, width: 14, height: 24 });
  });
});
