import { describe, expect, it } from "vitest";
import { findColors, replaceColors, setSingleColor, transformColors, useCurrentColor, writeColor } from "../src/svg-colors";
import { parseColor } from "../src/color";

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" fill="none" stroke="currentColor">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#F00"/><stop offset="1" style="stop-color: rgb(0, 0, 255); stop-opacity:1"/></linearGradient>
  <style>.a{fill:red;background-color:#123456;border-color:blue} .b{stroke:#00ff00 !important;color:#abc}</style></defs>
  <rect id="r" width="5" height="5" fill="#ff0000"/>
  <circle cx="5" cy="5" r="2" fill="Red" stroke="rgba(0,0,0,.5)"/>
  <path d="M0 0" fill="url(#g)" style="fill: #FF0000; stroke:none"/>
  <text fill="transparent">fill="blue" is only text here</text>
</svg>`;

describe("findColors", () => {
  it("lists every colour however it is written, counted by value, most used first", () => {
    const r = findColors(ICON);
    expect(r.colors.find((c) => c.hex === "#ff0000")?.count).toBe(5); // #F00, red, #ff0000, Red, #FF0000
    expect(r.colors.map((c) => c.hex)).toContain("#0000ff");
    expect(r.colors.map((c) => c.hex)).toContain("#00ff00");
    expect(r.colors.map((c) => c.hex)).toContain("#aabbcc");
    expect(r.colors.map((c) => c.hex)).toContain("#00000080");
    expect(r.colors[0]?.hex).toBe("#ff0000");
  });

  it("does not count background-color, border-color, text content, gradient references, none or transparent", () => {
    const hexes = findColors(ICON).colors.map((c) => c.hex);
    expect(hexes).not.toContain("#123456");
    expect(hexes.filter((h) => h === "#0000ff").length).toBe(1); // blue in border-color and in text are ignored; only the stop-color counts
    expect(findColors(ICON).none).toBe(2);
    expect(findColors(ICON).currentColor).toBe(1);
  });

  it("returns nothing for an SVG with no colours", () => {
    expect(findColors('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')).toEqual({ colors: [], currentColor: 0, none: 0 });
  });
});

describe("replaceColors", () => {
  it("changes every use of a colour: attributes, style attributes and <style> blocks", () => {
    const { svg, changed } = replaceColors(ICON, { "#ff0000": "#0b6b55" });
    expect(changed).toBe(5);
    expect(findColors(svg).colors.find((c) => c.hex === "#ff0000")).toBeUndefined();
    expect(findColors(svg).colors.find((c) => c.hex === "#0b6b55")?.count).toBe(5);
    expect(svg).toContain("fill:#0b6b55");
    expect(svg).toContain("background-color:#123456"); // untouched
  });

  it("accepts the colour to replace in any form, and names or codes as the new colour", () => {
    expect(replaceColors(ICON, { red: "blue" }).changed).toBe(5);
    expect(replaceColors(ICON, { "rgb(0,0,255)": "#fff" }).svg).toContain("stop-color: #fff");
  });

  it("keeps transparency when the replacement is opaque", () => {
    const { svg } = replaceColors('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="rgba(0,0,0,.5)"/></svg>', { "#00000080": "#ff0000" });
    expect(svg).toContain('fill="rgba(255, 0, 0, 0.5)"');
  });

  it("returns the original text when nothing matched", () => {
    const r = replaceColors(ICON, { "#123123": "#000000" });
    expect(r.changed).toBe(0);
    expect(r.svg).toBe(ICON);
  });

  it("rejects a replacement that is not a colour", () => {
    expect(() => replaceColors(ICON, { red: "banana" })).toThrow(/“banana” is not a colour/);
  });

  it("leaves everything else in the file as it was", () => {
    const out = replaceColors(ICON, { "#ff0000": "#000000" }).svg;
    expect(out).toContain('<circle cx="5" cy="5" r="2"');
    expect(out).toContain("only text here");
    expect(out).toContain('id="g"');
  });
});

describe("transformColors", () => {
  it("inverts, turns to grey, lightens and darkens", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#ff0000"/><rect fill="#336699"/></svg>';
    expect(transformColors(svg, "invert").svg).toContain('fill="#0ff"');
    expect(transformColors(svg, "invert").svg).toContain('fill="#c96"'); // #cc9966 in its short form
    const grey = findColors(transformColors(svg, "grayscale").svg).colors.map((c) => parseColor(c.hex)!);
    for (const c of grey) expect(c.r === c.g && c.g === c.b).toBe(true);
    const lighter = parseColor(findColors(transformColors(svg, "lighten", 0.2).svg).colors.find((c) => c.hex !== "#ff0000")!.hex)!;
    expect(lighter.b).toBeGreaterThan(0x99);
    const darker = parseColor(findColors(transformColors(svg, "darken", 0.2).svg).colors.find((c) => c.hex !== "#ff0000")!.hex)!;
    expect(darker.b).toBeLessThan(0x99);
  });

  it("keeps none, currentColor and gradient references as they are", () => {
    const out = transformColors(ICON, "invert").svg;
    expect(out).toContain('fill="none"');
    expect(out).toContain('stroke="currentColor"');
    expect(out).toContain('fill="url(#g)"');
  });
});

describe("useCurrentColor and setSingleColor", () => {
  it("makes fills and strokes follow the text colour, but not gradient stops", () => {
    const { svg, changed } = useCurrentColor(ICON);
    expect(changed).toBeGreaterThan(3);
    expect(findColors(svg).colors.map((c) => c.hex)).toEqual(expect.arrayContaining(["#0000ff"])); // the stop-color
    expect(svg).toContain('fill="currentColor"');
    expect(svg).not.toContain('fill="#ff0000"');
  });

  it("can do fills only, or strokes only", () => {
    const only = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red" stroke="blue"/></svg>';
    expect(useCurrentColor(only, { strokes: false }).svg).toContain('stroke="blue"');
    expect(useCurrentColor(only, { fills: false }).svg).toContain('fill="red"');
  });

  it("sets one colour on every fill and stroke", () => {
    const r = setSingleColor('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red" stroke="#00f"/><stop stop-color="red"/></svg>', "#111");
    expect(r.svg).toContain('fill="#111"');
    expect(r.svg).toContain('stroke="#111"');
    expect(r.svg).toContain('stop-color="red"');
    expect(() => setSingleColor("<svg/>", "nope")).toThrow(/not a colour/);
  });
});

describe("writeColor", () => {
  it("uses the shortest hex, and rgba() for transparency", () => {
    expect(writeColor({ r: 255, g: 0, b: 0, a: 1 })).toBe("#f00");
    expect(writeColor({ r: 11, g: 107, b: 85, a: 1 })).toBe("#0b6b55");
    expect(writeColor({ r: 0, g: 0, b: 0, a: 0.5 })).toBe("rgba(0, 0, 0, 0.5)");
  });
});
