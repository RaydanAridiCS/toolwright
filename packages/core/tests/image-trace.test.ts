import { describe, expect, it } from "vitest";
import { MAX_TRACE_PIXELS, otsuThreshold, traceImage, type RgbaImage } from "../src/image-trace";
import { getAttr, parseSvg } from "../src/svg-xml";

/** An image built from a function that returns the colour of each pixel. */
function image(w: number, h: number, colour: (x: number, y: number) => number[]): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(colour(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
}

const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const circle = image(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 20 ? BLACK : WHITE));
const fills = (svg: string) => parseSvg(svg).root.children.filter((c) => c.type === "element" && c.name === "path").map((p) => getAttr(p as never, "fill"));

describe("otsuThreshold", () => {
  it("finds the gap between dark and light pixels", () => {
    const t = otsuThreshold(image(20, 20, (x) => (x < 10 ? [40, 40, 40, 255] : [210, 210, 210, 255])).data);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(210);
  });

  it("ignores transparent pixels, and has a default for an empty picture", () => {
    expect(otsuThreshold(image(4, 4, () => [0, 0, 0, 0]).data)).toBe(128);
    const mixed = image(20, 20, (x) => (x < 5 ? [0, 0, 0, 0] : x < 12 ? [20, 20, 20, 255] : [230, 230, 230, 255]));
    expect(otsuThreshold(mixed.data)).toBeGreaterThanOrEqual(20);
  });
});

describe("traceImage: black and white", () => {
  it("traces a circle as two paths, and can drop the background", () => {
    const r = traceImage(circle, { mode: "black-white" });
    expect(r.paths).toBe(2);
    expect(new Set(fills(r.svg))).toEqual(new Set(["rgb(0,0,0)", "rgb(255,255,255)"]));
    const noBackground = traceImage(circle, { mode: "black-white", removeBackground: true });
    expect(noBackground.paths).toBe(1);
    expect(fills(noBackground.svg)).toEqual(["rgb(0,0,0)"]);
  });

  it("produces a valid SVG with the picture's size as its viewBox", () => {
    const { root } = parseSvg(traceImage(circle, { mode: "black-white" }).svg);
    expect(getAttr(root, "viewBox")).toBe("0 0 60 60");
    expect(getAttr(root, "xmlns")).toBe("http://www.w3.org/2000/svg");
  });

  it("chooses the cut-off itself, and honours one you give", () => {
    // A mid-grey square on white: dark enough to be black at a high threshold, white at a low one.
    const grey = image(40, 40, (x, y) => (x > 10 && x < 30 && y > 10 && y < 30 ? [140, 140, 140, 255] : WHITE));
    expect(traceImage(grey, { mode: "black-white", threshold: 200 }).paths).toBe(2);
    expect(traceImage(grey, { mode: "black-white", threshold: 50 }).paths).toBe(1);
  });

  it("treats transparent pixels as background, so a logo on a see-through canvas has no background shape", () => {
    const logo = image(40, 40, (x, y) => (Math.hypot(x - 20, y - 20) < 12 ? BLACK : [0, 0, 0, 0]));
    const r = traceImage(logo, { mode: "black-white" });
    expect(r.paths).toBeLessThanOrEqual(2);
    expect(fills(traceImage(logo, { mode: "black-white", removeBackground: true }).svg)).toEqual(["rgb(0,0,0)"]);
  });

  it("is repeatable", () => {
    expect(traceImage(circle, { mode: "black-white" }).svg).toBe(traceImage(circle, { mode: "black-white" }).svg);
  });
});

describe("traceImage: colour", () => {
  const flag = image(60, 30, (x) => (x < 20 ? [220, 30, 30, 255] : x < 40 ? [30, 160, 60, 255] : [30, 60, 200, 255]));

  it("finds the colours of flat artwork", () => {
    const r = traceImage(flag, { colors: 3 });
    expect(r.colors).toBe(3);
    const joined = fills(r.svg).join(" ");
    expect(joined).toMatch(/rgb\((?:2[0-3]\d|21\d),\s*\d+,\s*\d+\)/); // a red
    expect(r.paths).toBeGreaterThanOrEqual(3);
  });

  it("never uses more colours than asked for", () => {
    const busy = image(40, 40, (x, y) => [(x * 6) % 256, (y * 6) % 256, ((x + y) * 3) % 256, 255]);
    for (const n of [2, 4, 8]) expect(traceImage(busy, { colors: n }).colors).toBeLessThanOrEqual(n);
  });

  it("detail changes the number of path commands: exact follows more steps than smooth", () => {
    const wobbly = image(80, 80, (x, y) => (Math.hypot(x - 40 + Math.sin(y / 3) * 3, y - 40) < 25 ? BLACK : WHITE));
    const smooth = traceImage(wobbly, { mode: "black-white", detail: "smooth" });
    const exact = traceImage(wobbly, { mode: "black-white", detail: "exact" });
    expect(exact.bytes).toBeGreaterThan(smooth.bytes);
  });

  it("ignoring specks removes tiny shapes", () => {
    const specks = image(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 15 || (x === 5 && y === 5) || (x === 50 && y === 8) ? BLACK : WHITE));
    const keep = traceImage(specks, { mode: "black-white", ignoreSpecks: 0 });
    const ignore = traceImage(specks, { mode: "black-white", ignoreSpecks: 30 });
    expect(ignore.paths).toBeLessThanOrEqual(keep.paths);
    expect(ignore.bytes).toBeLessThan(keep.bytes);
  });

  it("precision shortens the coordinates", () => {
    const wobbly = image(80, 80, (x, y) => (Math.hypot(x - 40, y - 40) < 25 ? BLACK : WHITE));
    expect(traceImage(wobbly, { mode: "black-white", precision: 0 }).bytes).toBeLessThanOrEqual(traceImage(wobbly, { mode: "black-white", precision: 3 }).bytes);
  });
});

describe("traceImage: limits and errors", () => {
  it("refuses a picture that is too large, and one with no pixels", () => {
    expect(() => traceImage({ width: 2000, height: 1000, data: new Uint8ClampedArray(2000 * 1000 * 4) })).toThrow(/limited to about 1.5 million pixels/);
    expect(() => traceImage({ width: 0, height: 5, data: new Uint8ClampedArray() })).toThrow(/no pixels/);
    expect(() => traceImage({ width: 4, height: 4, data: new Uint8ClampedArray(10) })).toThrow(/no pixels/);
    expect(MAX_TRACE_PIXELS).toBeGreaterThan(1_000_000);
  });

  it("rejects settings outside their range", () => {
    expect(() => traceImage(circle, { colors: 1 })).toThrow(/2 to 64/);
    expect(() => traceImage(circle, { colors: 3.5 })).toThrow(/whole number/);
    expect(() => traceImage(circle, { ignoreSpecks: 500 })).toThrow(/Ignore specks/);
    expect(() => traceImage(circle, { soften: 9 })).toThrow(/Soften/);
    expect(() => traceImage(circle, { precision: 5 })).toThrow(/Precision/);
    expect(() => traceImage(circle, { threshold: 300 })).toThrow(/threshold/);
  });

  it("traces a moderately large picture in reasonable time", () => {
    const big = image(500, 400, (x, y) => (Math.hypot(x - 250, y - 200) < 150 || (x > 20 && x < 80 && y > 20 && y < 80) ? BLACK : WHITE));
    const t0 = Date.now();
    const r = traceImage(big, { mode: "black-white" });
    expect(r.paths).toBeGreaterThanOrEqual(2);
    expect(Date.now() - t0).toBeLessThan(10_000);
  });
});
