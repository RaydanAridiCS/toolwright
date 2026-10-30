import { describe, expect, it } from "vitest";
import {
  parsePath,
  pathBounds,
  pathInfo,
  pathLength,
  PathSyntaxError,
  reversePath,
  rotateMatrix,
  scaleMatrix,
  serializePath,
  toAbsolute,
  toCurves,
  toRelative,
  transformPath,
  translateMatrix,
  multiply,
  type Matrix,
  type PathSegment,
} from "../src/svg-path";

const CIRCLE = "M0 50A50 50 0 1 1 100 50A50 50 0 1 1 0 50Z";
const near = (a: number, b: number, digits = 4) => expect(a).toBeCloseTo(b, digits);
const same = (a: PathSegment[], b: PathSegment[]) => expect(a.map((s) => [s.cmd, ...s.args.map((n) => Math.round(n * 1e6) / 1e6)])).toEqual(b.map((s) => [s.cmd, ...s.args.map((n) => Math.round(n * 1e6) / 1e6)]));

/** Points along a path made of M, L, C, Z, to compare shapes without depending on how they are written. */
function sample(segs: PathSegment[], per = 12): [number, number][] {
  const pts: [number, number][] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { cmd, args } of toCurves(segs)) {
    if (cmd === "M") {
      cx = sx = args[0] as number;
      cy = sy = args[1] as number;
    } else if (cmd === "L") {
      for (let k = 1; k <= per; k++) pts.push([cx + ((args[0] as number) - cx) * (k / per), cy + ((args[1] as number) - cy) * (k / per)]);
      cx = args[0] as number;
      cy = args[1] as number;
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x, y] = args as number[] as [number, number, number, number, number, number];
      for (let k = 1; k <= per; k++) {
        const t = k / per;
        const u = 1 - t;
        pts.push([u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y]);
      }
      cx = x;
      cy = y;
    } else {
      cx = sx;
      cy = sy;
    }
  }
  return pts;
}

describe("parsePath", () => {
  it("reads every command with its numbers", () => {
    expect(parsePath("M10 20L30 40H50V60C1 2 3 4 5 6S7 8 9 10Q11 12 13 14T15 16A1 2 3 0 1 4 5Z")).toEqual([
      { cmd: "M", args: [10, 20] },
      { cmd: "L", args: [30, 40] },
      { cmd: "H", args: [50] },
      { cmd: "V", args: [60] },
      { cmd: "C", args: [1, 2, 3, 4, 5, 6] },
      { cmd: "S", args: [7, 8, 9, 10] },
      { cmd: "Q", args: [11, 12, 13, 14] },
      { cmd: "T", args: [15, 16] },
      { cmd: "A", args: [1, 2, 3, 0, 1, 4, 5] },
      { cmd: "Z", args: [] },
    ]);
  });

  it("understands implicit repeats: extra pairs after M are lines, after L more lines", () => {
    expect(parsePath("M0 0 10 10 20 0")).toEqual([
      { cmd: "M", args: [0, 0] },
      { cmd: "L", args: [10, 10] },
      { cmd: "L", args: [20, 0] },
    ]);
    expect(parsePath("m1 1 2 2").map((s) => s.cmd)).toEqual(["m", "l"]);
    expect(parsePath("M0 0l1 1 2 2h3 4").map((s) => s.cmd)).toEqual(["M", "l", "l", "h", "h"]);
  });

  it("reads compact numbers: signs, leading dots, exponents and no separators", () => {
    expect(parsePath("M1-2.5.5-1e-2 3E1 4").flatMap((s) => s.args)).toEqual([1, -2.5, 0.5, -0.01, 30, 4]);
    expect(parsePath("M 1,2 , 3 4")[1]?.args).toEqual([3, 4]);
  });

  it("reads arc flags written without separators", () => {
    expect(parsePath("M0 0a1 1 0 011 1")[1]).toEqual({ cmd: "a", args: [1, 1, 0, 0, 1, 1, 1] });
    expect(parsePath("M0 0a1 1 0 1 0-2 3")[1]?.args).toEqual([1, 1, 0, 1, 0, -2, 3]);
    expect(parsePath("M0 0A5 5 0 11.5 2")[1]?.args).toEqual([5, 5, 0, 1, 1, 0.5, 2]);
  });

  it("accepts an empty path and trailing space", () => {
    expect(parsePath("")).toEqual([]);
    expect(parsePath("  M0 0  ")).toHaveLength(1);
  });

  it("explains each kind of mistake", () => {
    expect(() => parsePath("L10 10")).toThrow(/must start with M/);
    expect(() => parsePath("10 10")).toThrow(/must start with a command/);
    expect(() => parsePath("M0 0 X5")).toThrow(/“X” is not a path command/);
    expect(() => parsePath("M0")).toThrow(/M needs 2 numbers but only 1 was found/);
    expect(() => parsePath("M0 0 C1 2 3 4")).toThrow(/C needs 6 numbers but only 4 were found/);
    expect(() => parsePath("M0 0 A1 1 0 2 1 5 5")).toThrow(/Arc flags must be 0 or 1/);
    expect(() => parsePath("M0 0 Z 5 5")).toThrow(/numbers after Z/);
    expect(() => parsePath("M0 0 L 5 #")).toThrow(PathSyntaxError);
  });
});

describe("serializePath", () => {
  it("writes readable and minified forms", () => {
    const segs = parsePath("M 12.000 2 L 2 22 h 20 z");
    expect(serializePath(segs)).toBe("M 12 2 L 2 22 h 20 z");
    expect(serializePath(segs, { minify: true })).toBe("M12 2 2 22h20z");
  });

  it("rounds to the precision and never writes -0", () => {
    expect(serializePath([{ cmd: "M", args: [1.23456, -0.0004] }], { precision: 2 })).toBe("M 1.23 0");
    expect(serializePath([{ cmd: "M", args: [0.5, -0.5] }, { cmd: "L", args: [1.5, 2] }], { minify: true })).toBe("M.5-.5 1.5 2");
  });

  it("separates numbers only where needed", () => {
    expect(serializePath(parsePath("M1 2L3 -4L.5 .25"), { minify: true })).toBe("M1 2 3-4 .5.25");
  });

  it("writes arc flags without separators, and still reads back identically", () => {
    const d = "M0 0a1 1 0 011 1a2 2 0 100 4";
    const out = serializePath(parsePath(d), { minify: true });
    // The repeated "a" is left out: more numbers after an arc are another arc.
    expect(out).toBe("M0 0a1 1 0 011 1 2 2 0 100 4");
    same(parsePath(out), parsePath(d));
  });

  it("round-trips whatever the input looks like", () => {
    for (const d of ["M0 0 10 10 20 0z", CIRCLE, "m1.5-2.5.5.5c1 2 3 4 5 6s1 1 2 2q1 1 2 2t3 3", "M10 20H30V40Z"]) {
      same(parsePath(serializePath(parsePath(d), { minify: true, precision: 6 })), parsePath(d));
      same(parsePath(serializePath(parsePath(d), { precision: 6 })), parsePath(d));
    }
  });

  it("is shorter when minified", () => {
    expect(serializePath(parsePath(CIRCLE), { minify: true }).length).toBeLessThan(serializePath(parsePath(CIRCLE)).length);
  });
});

describe("absolute and relative", () => {
  const D = "m10 10l5 0 0 5h-5v-5z m20 20c1 1 2 2 3 3s2 2 4 4q1 1 2 2t3 3a2 2 0 0 1 4 4z";

  it("converts to absolute positions", () => {
    expect(toAbsolute(parsePath("m10 10l5 0 0 5h-5v-5z"))).toEqual([
      { cmd: "M", args: [10, 10] },
      { cmd: "L", args: [15, 10] },
      { cmd: "L", args: [15, 15] },
      { cmd: "H", args: [10] },
      { cmd: "V", args: [10] },
      { cmd: "Z", args: [] },
    ]);
  });

  it("a relative move after Z starts from the start of the closed subpath", () => {
    const abs = toAbsolute(parsePath("M10 10 L20 10 z m5 5 l1 1"));
    expect(abs[3]).toEqual({ cmd: "M", args: [15, 15] });
    expect(abs[4]).toEqual({ cmd: "L", args: [16, 16] });
  });

  it("absolute then relative then absolute gives the same path", () => {
    const abs = toAbsolute(parsePath(D));
    same(toAbsolute(toRelative(abs)), abs);
    same(toAbsolute(toRelative(parsePath(D))), abs);
  });

  it("keeps the first move absolute and writes everything else lower case", () => {
    const rel = toRelative(parsePath("M10 10L15 15L20 10"));
    expect(rel).toEqual([
      { cmd: "m", args: [10, 10] },
      { cmd: "l", args: [5, 5] },
      { cmd: "l", args: [5, -5] },
    ]);
    expect(serializePath(rel, { minify: true })).toBe("m10 10 5 5 5-5");
  });
});

describe("toCurves", () => {
  it("uses only M, L, C and Z, with the same shape", () => {
    const curves = toCurves(parsePath("M0 0H10V10Q15 15 20 10T30 10S40 0 50 10A5 5 0 0 1 60 10Z"));
    expect(new Set(curves.map((s) => s.cmd))).toEqual(new Set(["M", "L", "C", "Z"]));
    expect(pathBounds(curves)!.width).toBeGreaterThan(55);
  });

  it("turns a full circle into four quarter curves per half, and measures like a circle", () => {
    const curves = toCurves(parsePath(CIRCLE));
    expect(curves.filter((s) => s.cmd === "C").length).toBe(4);
    const b = pathBounds(curves)!;
    near(b.x, 0);
    near(b.y, 0);
    near(b.width, 100);
    near(b.height, 100);
    // Four cubic curves approximate a circle to about 0.03%.
    expect(Math.abs(pathLength(parsePath(CIRCLE)) - 2 * Math.PI * 50)).toBeLessThan(0.1);
  });

  it("an arc with a zero radius is a straight line, and a zero-length arc disappears", () => {
    expect(toCurves(parsePath("M0 0A0 5 0 0 1 10 0")).map((s) => s.cmd)).toEqual(["M", "C"]);
    expect(pathLength(parsePath("M0 0A0 5 0 0 1 10 0"))).toBeCloseTo(10, 6);
    expect(toCurves(parsePath("M5 5A3 3 0 0 1 5 5")).map((s) => s.cmd)).toEqual(["M"]);
  });

  it("scales up radii that are too small to reach the end point", () => {
    const b = pathBounds(parsePath("M0 0A1 1 0 0 1 100 0"))!;
    near(b.width, 100, 3);
    near(b.height, 50, 2);
  });
});

describe("measuring", () => {
  it("measures a rectangle", () => {
    const segs = parsePath("M10 20h30v40h-30z");
    expect(pathBounds(segs)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    near(pathLength(segs), 140, 6);
  });

  it("finds the true extremes of curves, not their control points", () => {
    // A cubic that bulges to y = 75 although its control points are at y = 100.
    const b = pathBounds(parsePath("M0 0C0 100 100 100 100 0"))!;
    near(b.y, 0);
    near(b.height, 75);
    near(b.width, 100);
  });

  it("returns null bounds and zero length for an empty path", () => {
    expect(pathBounds([])).toBeNull();
    expect(pathLength([])).toBe(0);
  });

  it("summarises a path", () => {
    expect(pathInfo(parsePath("M0 0h10v10z M20 20h5"))).toMatchObject({ commands: 6, subpaths: 2, closedSubpaths: 1 });
  });
});

describe("transformPath", () => {
  const SHAPES: Record<string, string> = {
    lines: "M10 10L50 10V40H20Z",
    curves: "M10 10C20 0 40 0 50 10S70 30 80 10Q90 0 100 20T120 20",
    arcs: "M10 50A20 10 30 0 1 60 50A20 10 30 1 0 10 50Z",
    mixed: "m10 10 l20 5 a8 5 15 1 1 20 10 c5 5 10 5 15 0 z",
  };
  const MATRICES: Record<string, Matrix> = {
    translate: translateMatrix(15, -7),
    scale: scaleMatrix(2.5),
    "non-uniform scale": scaleMatrix(2, 0.5),
    rotate: rotateMatrix(37),
    "flip x": [-1, 0, 0, 1, 100, 0],
    "flip y": [1, 0, 0, -1, 0, 100],
    "rotate and flip": multiply(rotateMatrix(-20, 10, 10), [1, 0, 0, -1, 0, 0]),
    skew: [1, 0.3, 0.2, 1, 0, 0],
  };

  for (const [shapeName, d] of Object.entries(SHAPES)) {
    for (const [matrixName, m] of Object.entries(MATRICES)) {
      it(`${shapeName}: ${matrixName} gives the same shape as moving every point`, () => {
        const segs = parsePath(d);
        const moved = sample(transformPath(segs, m));
        const expected = sample(segs).map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as [number, number]);
        expect(moved.length).toBe(expected.length);
        moved.forEach((p, i) => {
          expect(p[0]).toBeCloseTo(expected[i]![0], 4);
          expect(p[1]).toBeCloseTo(expected[i]![1], 4);
        });
      });
    }
  }

  it("keeps arcs as arcs for a uniform scale or a rotation, and horizontal lines as H for a plain scale", () => {
    expect(transformPath(parsePath(SHAPES.arcs!), rotateMatrix(30)).some((s) => s.cmd === "A")).toBe(true);
    expect(transformPath(parsePath(SHAPES.arcs!), scaleMatrix(2, 0.5)).some((s) => s.cmd === "A")).toBe(false);
    expect(transformPath(parsePath("M0 0H10V10"), scaleMatrix(2)).map((s) => s.cmd)).toEqual(["M", "H", "V"]);
    expect(transformPath(parsePath("M0 0H10"), rotateMatrix(45)).map((s) => s.cmd)).toEqual(["M", "L"]);
  });

  it("scaling by 2 doubles the length, rotating keeps it", () => {
    const segs = parsePath(SHAPES.mixed!);
    // Arcs are measured as curves, so allow the small approximation error (about 0.01%).
    expect(pathLength(transformPath(segs, scaleMatrix(2))) / (pathLength(segs) * 2)).toBeCloseTo(1, 3);
    expect(pathLength(transformPath(segs, rotateMatrix(73, 5, 5))) / pathLength(segs)).toBeCloseTo(1, 3);
  });

  it("rotating a rectangle by 90 degrees swaps its width and height", () => {
    const b = pathBounds(transformPath(parsePath("M0 0h40v10h-40z"), rotateMatrix(90)))!;
    near(b.width, 10);
    near(b.height, 40);
  });

  it("combines transforms in the order given", () => {
    const m = multiply(scaleMatrix(2), translateMatrix(10, 0)); // scale first, then move
    expect(transformPath(parsePath("M1 1"), m)[0]?.args).toEqual([12, 2]);
  });
});

describe("reversePath", () => {
  it("walks an open path backwards", () => {
    same(reversePath(parsePath("M0 0L10 0L10 10")), parsePath("M10 10L10 0L0 0"));
  });

  it("reverses curves by swapping their control points", () => {
    same(reversePath(parsePath("M0 0C1 2 3 4 5 6")), parsePath("M5 6C3 4 1 2 0 0"));
  });

  it("keeps a closed path closed, starting from the same point", () => {
    same(reversePath(parsePath("M0 0L10 0L10 10Z")), parsePath("M0 0L10 10L10 0Z"));
    same(reversePath(parsePath("M0 0L10 0L10 10L0 0Z")), parsePath("M0 0L10 10L10 0Z"));
  });

  it("reverses each subpath separately", () => {
    const out = reversePath(parsePath("M0 0L1 1M5 5L6 6"));
    same(out, parsePath("M1 1L0 0M6 6L5 5"));
  });

  it("reversing twice gives the shape back, and does not change its size", () => {
    for (const d of ["M10 10C20 0 40 0 50 10S70 30 80 10Q90 0 100 20T120 20", "M10 50A20 10 30 0 1 60 50A20 10 30 1 0 10 50Z", "M0 0h10v10h-10z"]) {
      const segs = parsePath(d);
      const twice = reversePath(reversePath(segs));
      same(twice, toCurves(segs));
      near(pathLength(reversePath(segs)), pathLength(segs), 6);
      const a = pathBounds(segs)!;
      const b = pathBounds(reversePath(segs))!;
      near(a.width, b.width, 6);
      near(a.height, b.height, 6);
    }
  });

  it("the reversed path visits the same points in the opposite order", () => {
    const segs = parsePath("M0 0C10 0 10 10 20 10L30 10");
    const forward = sample(segs, 8);
    const backward = sample(reversePath(segs), 8);
    expect(backward[backward.length - 1]![0]).toBeCloseTo(0, 6);
    expect(backward[0]![0]).toBeGreaterThan(25);
    expect(forward.length).toBe(backward.length);
  });
});

describe("large paths", () => {
  it("handles tens of thousands of commands quickly", () => {
    const d = `M0 0${"l1 1 2-1 -2 .5".repeat(30_000)}`;
    const t0 = Date.now();
    const segs = parsePath(d);
    toRelative(toAbsolute(segs));
    pathBounds(segs);
    serializePath(segs, { minify: true });
    expect(segs.length).toBeGreaterThan(60_000);
    expect(Date.now() - t0).toBeLessThan(4000);
  });
});
