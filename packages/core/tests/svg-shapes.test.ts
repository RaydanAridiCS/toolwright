import { describe, expect, it } from "vitest";
import { blobPath, polygonPath, seededRandom, shapeSvg, starPath, wavePaths } from "../src/svg-shapes";
import { parsePath, pathBounds } from "../src/svg-path";
import { parseSvg } from "../src/svg-xml";

describe("seededRandom", () => {
  it("gives the same numbers for the same seed, and different ones for another", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(seededRandom(43)()).not.toBe(first[0]);
  });

  it("stays in 0 to 1 and is evenly spread", () => {
    const next = seededRandom(7);
    const values = Array.from({ length: 20_000 }, next);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });
});

describe("blobPath", () => {
  it("is a closed, valid path made of curves", () => {
    const segs = parsePath(blobPath({ seed: 1 }));
    expect(segs[0]?.cmd).toBe("M");
    expect(segs.filter((s) => s.cmd === "C")).toHaveLength(8);
    expect(segs[segs.length - 1]?.cmd).toBe("Z");
  });

  it("is the same for the same seed and different for another", () => {
    expect(blobPath({ seed: 5 })).toBe(blobPath({ seed: 5 }));
    expect(blobPath({ seed: 5 })).not.toBe(blobPath({ seed: 6 }));
  });

  it("stays inside its square, whatever the seed", () => {
    for (let seed = 0; seed < 60; seed++) {
      const b = pathBounds(parsePath(blobPath({ seed, size: 300, points: 10, randomness: 1 })))!;
      expect(b.x).toBeGreaterThanOrEqual(-3);
      expect(b.y).toBeGreaterThanOrEqual(-3);
      expect(b.x + b.width).toBeLessThanOrEqual(303);
      expect(b.y + b.height).toBeLessThanOrEqual(303);
    }
  });

  it("with no randomness is close to a circle", () => {
    const b = pathBounds(parsePath(blobPath({ seed: 9, size: 400, points: 12, randomness: 0 })))!;
    expect(b.width).toBeGreaterThan(395);
    expect(b.width).toBeLessThan(405);
    expect(Math.abs(b.width - b.height)).toBeLessThan(5);
  });

  it("the number of points sets the number of curves", () => {
    expect(parsePath(blobPath({ seed: 1, points: 5 })).filter((s) => s.cmd === "C")).toHaveLength(5);
    expect(parsePath(blobPath({ seed: 1, points: 20 })).filter((s) => s.cmd === "C")).toHaveLength(20);
  });

  it("rejects settings that make no sense", () => {
    expect(() => blobPath({ seed: 1, points: 2 })).toThrow(/3 to 24/);
    expect(() => blobPath({ seed: 1, points: 4.5 })).toThrow(/whole number/);
    expect(() => blobPath({ seed: 1, randomness: 2 })).toThrow(/between 0 and 1/);
    expect(() => blobPath({ seed: 1, size: 0 })).toThrow(/more than 0/);
  });
});

describe("wavePaths", () => {
  it("draws one closed shape per layer, joined to the bottom edge", () => {
    const paths = wavePaths({ width: 800, height: 200, layers: 3 });
    expect(paths).toHaveLength(3);
    for (const d of paths) {
      const segs = parsePath(d);
      expect(segs[0]).toMatchObject({ cmd: "M", args: [0, expect.any(Number)] });
      expect(segs[segs.length - 1]?.cmd).toBe("Z");
      const b = pathBounds(segs)!;
      expect(b.x).toBe(0);
      expect(b.x + b.width).toBeCloseTo(800, 1);
      expect(b.y + b.height).toBeCloseTo(200, 1);
    }
  });

  it("can fill the area above the line instead", () => {
    const b = pathBounds(parsePath(wavePaths({ fill: "top" })[0] as string))!;
    expect(b.y).toBeCloseTo(0, 1);
  });

  it("higher amplitude makes taller crests, and zero is a flat line", () => {
    const top = (a: number) => pathBounds(parsePath(wavePaths({ amplitude: a })[0] as string))!.y;
    expect(top(0.9)).toBeLessThan(top(0.2));
    expect(top(0)).toBeCloseTo(100, 1);
  });

  it("frequency sets how many waves there are", () => {
    const curves = (f: number) => parsePath(wavePaths({ frequency: f })[0] as string).filter((s) => s.cmd === "C").length;
    expect(curves(8)).toBeGreaterThan(curves(1));
  });

  it("is repeatable by seed, and layers differ from each other", () => {
    expect(wavePaths({ layers: 3, seed: 4 })).toEqual(wavePaths({ layers: 3, seed: 4 }));
    const [a, b] = wavePaths({ layers: 2, seed: 4 });
    expect(a).not.toBe(b);
  });

  it("rejects settings that make no sense", () => {
    expect(() => wavePaths({ width: 0 })).toThrow(/more than 0/);
    expect(() => wavePaths({ amplitude: 1.5 })).toThrow(/Amplitude/);
    expect(() => wavePaths({ frequency: 0 })).toThrow(/Frequency/);
    expect(() => wavePaths({ layers: 9 })).toThrow(/Layers/);
  });
});

describe("polygonPath and starPath", () => {
  it("puts the corners of a polygon on a circle, first one at the top", () => {
    const segs = parsePath(polygonPath({ sides: 6, size: 200 }));
    expect(segs).toHaveLength(7); // M, 5 L, Z
    expect(segs[0]?.args[0]).toBeCloseTo(100, 1);
    expect(segs[0]?.args[1]).toBeCloseTo(0, 1);
    for (const s of segs.slice(0, 6)) expect(Math.hypot((s.args[0] as number) - 100, (s.args[1] as number) - 100)).toBeCloseTo(100, 1);
  });

  it("a square turned by 45 degrees has horizontal and vertical sides", () => {
    const segs = parsePath(polygonPath({ sides: 4, size: 100, rotation: 45 }));
    // The first side runs from the top right corner down to the bottom right one: vertical, so the x values match.
    expect(segs[0]?.args[0]).toBeCloseTo(segs[1]?.args[0] as number, 1);
    expect(segs[1]?.args[1]).toBeCloseTo(segs[2]?.args[1] as number, 1);
  });

  it("a star alternates outer and inner corners", () => {
    const segs = parsePath(starPath({ points: 5, size: 200, innerRatio: 0.4 }));
    const radii = segs.slice(0, 10).map((s) => Math.hypot((s.args[0] as number) - 100, (s.args[1] as number) - 100));
    radii.forEach((rad, i) => expect(rad).toBeCloseTo(i % 2 === 0 ? 100 : 40, 1));
  });

  it("rejects bad counts and ratios", () => {
    expect(() => polygonPath({ sides: 2 })).toThrow(/3 to 24/);
    expect(() => starPath({ points: 30 })).toThrow(/3 to 24/);
    expect(() => starPath({ innerRatio: 1 })).toThrow(/0.1 and 0.95/);
  });
});

describe("shapeSvg", () => {
  it("builds a valid, complete SVG with layers, opacity and a background", () => {
    const svg = shapeSvg(800, 200, [{ d: "M0 0L10 10Z", fill: "#0b6b55" }, { d: "M0 0L5 5Z", fill: "rgb(1,2,3)", opacity: 0.5 }], "#fff");
    const { root, nodes } = parseSvg(svg);
    expect(root.attrs.find((a) => a.name === "viewBox")?.value).toBe("0 0 800 200");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect width="800" height="200" fill="#fff"/>');
    expect(svg).toContain('fill-opacity="0.5"');
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("cannot be broken out of by a colour value", () => {
    const svg = shapeSvg(10, 10, [{ d: "M0 0Z", fill: '"/><script>alert(1)</script>' }]);
    expect(svg).not.toContain("<script");
    expect(() => parseSvg(svg)).not.toThrow();
  });

  it("round trip: a generated blob is valid inside a file, and parses as one path", () => {
    const svg = shapeSvg(400, 400, [{ d: blobPath({ seed: 3 }), fill: "#0b6b55" }]);
    const { root } = parseSvg(svg);
    expect(root.children.filter((c) => c.type === "element" && c.name === "path")).toHaveLength(1);
  });
});
