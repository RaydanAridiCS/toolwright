import { describe, expect, it } from "vitest";
import {
  ASPECTS,
  CROP_LIMITS,
  aspectRatio,
  checkSize,
  clampRect,
  cropMatrix,
  describeSize,
  fullRect,
  insideTilted,
  isNoTurn,
  mapPoint,
  moveRect,
  normalizeTurn,
  parseAspect,
  rectForAspect,
  rectWithoutCorners,
  resizeRect,
  turnMatrix,
  turnedSize,
  type Handle,
  type Rect,
  type Size,
} from "../src/image-crop";

const BOUNDS: Size = { width: 1000, height: 600 };
const inside = (r: Rect, b: Size) => r.x >= 0 && r.y >= 0 && r.x + r.width <= b.width && r.y + r.height <= b.height && r.width >= 1 && r.height >= 1;
const whole = (r: Rect) => [r.x, r.y, r.width, r.height].every(Number.isInteger);

describe("parseAspect", () => {
  it("reads pairs and plain ratios", () => {
    expect(parseAspect("16:9")).toBeCloseTo(16 / 9);
    expect(parseAspect("16/10")).toBeCloseTo(1.6);
    expect(parseAspect(" 4 x 3 ")).toBeCloseTo(4 / 3);
    expect(parseAspect("1.5")).toBe(1.5);
  });
  it("rejects nonsense, zero, negative and absurd shapes", () => {
    for (const bad of ["", "abc", "0", "0:5", "5:0", "-1", "1:-2", "1:2:3", "1e3", "1000:1", "1:1000", "NaN", "Infinity"]) expect(parseAspect(bad)).toBeNull();
  });
});

describe("aspectRatio", () => {
  it("covers every preset", () => {
    const size = { width: 300, height: 200 };
    expect(aspectRatio("free", size)).toBeNull();
    expect(aspectRatio("original", size)).toBeCloseTo(1.5);
    expect(aspectRatio("9:16", size)).toBeCloseTo(9 / 16);
    expect(aspectRatio("custom", size, "2:1")).toBe(2);
    expect(aspectRatio("custom", size, "bad")).toBeNull();
    for (const a of ASPECTS) expect(() => aspectRatio(a.id, size, "1:1")).not.toThrow();
  });
  it("does not divide by zero for an empty picture", () => {
    expect(aspectRatio("original", { width: 0, height: 0 })).toBeNull();
  });
});

describe("clampRect", () => {
  it("keeps a good box as it is", () => {
    expect(clampRect({ x: 10, y: 20, width: 100, height: 50 }, BOUNDS)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });
  it("pulls a box that hangs over an edge back inside without changing its size", () => {
    expect(clampRect({ x: 950, y: 580, width: 100, height: 50 }, BOUNDS)).toEqual({ x: 900, y: 550, width: 100, height: 50 });
    expect(clampRect({ x: -40, y: -3, width: 100, height: 50 }, BOUNDS)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
  it("shrinks a box that is bigger than the picture", () => {
    expect(clampRect({ x: 0, y: 0, width: 5000, height: 5000 }, BOUNDS)).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
  });
  it("grows empty or negative boxes to one pixel", () => {
    expect(clampRect({ x: 5, y: 5, width: 0, height: -9 }, BOUNDS)).toEqual({ x: 5, y: 5, width: 1, height: 1 });
  });
  it("falls back to the whole picture for NaN and Infinity", () => {
    const all = { x: 0, y: 0, width: 1000, height: 600 };
    expect(clampRect({ x: NaN, y: 0, width: 5, height: 5 }, BOUNDS)).toEqual(all);
    expect(clampRect({ x: 0, y: 0, width: Infinity, height: 5 }, BOUNDS)).toEqual(all);
  });
  it("works on a 1 × 1 picture and rounds fractions", () => {
    expect(clampRect({ x: 0.4, y: 0.6, width: 3, height: 3 }, { width: 1, height: 1 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(whole(clampRect({ x: 0.5, y: 1.5, width: 10.4, height: 20.6 }, BOUNDS))).toBe(true);
  });
  it("copes with a degenerate picture size", () => {
    expect(clampRect({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe("rectForAspect", () => {
  it("returns the whole picture for Free", () => {
    expect(rectForAspect(BOUNDS, null)).toEqual(fullRect(BOUNDS));
  });
  it("makes the largest centred square", () => {
    expect(rectForAspect(BOUNDS, 1)).toEqual({ x: 200, y: 0, width: 600, height: 600 });
  });
  it("makes the largest 16:9 box in a tall picture", () => {
    const r = rectForAspect({ width: 600, height: 1000 }, 16 / 9);
    expect(r.width).toBe(600);
    expect(r.height).toBe(338);
    expect(r.y).toBe(331);
  });
  it("keeps the centre of the old box", () => {
    const r = rectForAspect(BOUNDS, 1, { x: 0, y: 0, width: 200, height: 200 });
    expect(r).toEqual({ x: 0, y: 0, width: 600, height: 600 });
  });
  it("stays inside for every preset and an extreme shape", () => {
    for (const ratio of [0.01, 0.5, 1, 1.5, 16 / 9, 100]) {
      const r = rectForAspect(BOUNDS, ratio);
      expect(inside(r, BOUNDS)).toBe(true);
    }
  });
  it("ignores a bad ratio", () => {
    expect(rectForAspect(BOUNDS, NaN)).toEqual(fullRect(BOUNDS));
    expect(rectForAspect(BOUNDS, -2)).toEqual(fullRect(BOUNDS));
  });
});

describe("moveRect", () => {
  it("moves and stops at the edges", () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(moveRect(r, 50, -30, BOUNDS)).toEqual({ x: 150, y: 70, width: 200, height: 100 });
    expect(moveRect(r, 5000, 5000, BOUNDS)).toEqual({ x: 800, y: 500, width: 200, height: 100 });
    expect(moveRect(r, -5000, -5000, BOUNDS)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });
  it("ignores NaN movement", () => {
    const r = { x: 100, y: 100, width: 200, height: 100 };
    expect(moveRect(r, NaN, 3, BOUNDS)).toEqual(r);
  });
});

describe("resizeRect without a fixed shape", () => {
  const r = { x: 200, y: 100, width: 300, height: 200 };
  it("moves only the edges that the handle touches", () => {
    expect(resizeRect(r, "e", 50, 999, BOUNDS)).toEqual({ x: 200, y: 100, width: 350, height: 200 });
    expect(resizeRect(r, "s", 999, 40, BOUNDS)).toEqual({ x: 200, y: 100, width: 300, height: 240 });
    expect(resizeRect(r, "w", -50, 0, BOUNDS)).toEqual({ x: 150, y: 100, width: 350, height: 200 });
    expect(resizeRect(r, "n", 0, -30, BOUNDS)).toEqual({ x: 200, y: 70, width: 300, height: 230 });
    expect(resizeRect(r, "se", 10, 20, BOUNDS)).toEqual({ x: 200, y: 100, width: 310, height: 220 });
    expect(resizeRect(r, "nw", 10, 20, BOUNDS)).toEqual({ x: 210, y: 120, width: 290, height: 180 });
  });
  it("stops at the picture edge and at the minimum size", () => {
    expect(resizeRect(r, "se", 9999, 9999, BOUNDS)).toEqual({ x: 200, y: 100, width: 800, height: 500 });
    expect(resizeRect(r, "nw", 9999, 9999, BOUNDS, null, 20)).toEqual({ x: 480, y: 280, width: 20, height: 20 });
    expect(resizeRect(r, "e", -9999, 0, BOUNDS, null, 20)).toEqual({ x: 200, y: 100, width: 20, height: 200 });
  });
  it("does not let the minimum size exceed a tiny picture", () => {
    const tiny = { width: 5, height: 5 };
    const out = resizeRect({ x: 0, y: 0, width: 5, height: 5 }, "se", -100, -100, tiny, null, 50);
    expect(inside(out, tiny)).toBe(true);
  });
  it("ignores NaN drags", () => {
    expect(resizeRect(r, "se", NaN, 1, BOUNDS)).toEqual(r);
  });
});

describe("resizeRect with a fixed shape", () => {
  const handles: Handle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  const ratio = 16 / 9;
  const start = { x: 300, y: 150, width: 320, height: 180 };

  it("keeps the shape, the picture bounds and whole pixels for any drag", () => {
    const drags = [-5000, -400, -37, -1, 0, 1, 23, 400, 5000];
    for (const handle of handles) {
      for (const dx of drags) {
        for (const dy of drags) {
          const out = resizeRect(start, handle, dx, dy, BOUNDS, ratio, 16);
          expect(inside(out, BOUNDS), `${handle} ${dx},${dy} -> ${JSON.stringify(out)}`).toBe(true);
          expect(whole(out)).toBe(true);
          // Shape holds within the rounding of whole pixels (one pixel on the short side).
          expect(Math.abs(out.width / out.height - ratio) * out.height, `${handle} ${dx},${dy} -> ${JSON.stringify(out)}`).toBeLessThan(1.6);
        }
      }
    }
  });

  it("keeps the opposite corner still when dragging a corner", () => {
    const out = resizeRect(start, "se", 80, 10, BOUNDS, ratio, 16);
    expect(out.x).toBe(300);
    expect(out.y).toBe(150);
    expect(out.width).toBeGreaterThan(start.width);
    const nw = resizeRect(start, "nw", -40, -10, BOUNDS, ratio, 16);
    expect(nw.x + nw.width).toBe(620);
    expect(nw.y + nw.height).toBe(330);
  });

  it("keeps the middle of the opposite side still when dragging a side", () => {
    const out = resizeRect(start, "e", 90, 0, BOUNDS, ratio, 16);
    expect(out.x).toBe(300);
    expect(out.width).toBe(410);
    expect(Math.abs(out.y + out.height / 2 - (start.y + start.height / 2))).toBeLessThanOrEqual(1);
    const north = resizeRect(start, "n", 0, -45, BOUNDS, ratio, 16);
    expect(north.y + north.height).toBe(330);
    expect(Math.abs(north.x + north.width / 2 - (start.x + start.width / 2))).toBeLessThanOrEqual(1);
  });

  it("works with tall and square shapes too", () => {
    for (const shape of [1, 9 / 16, 0.05, 20]) {
      const box = rectForAspect(BOUNDS, shape);
      for (const handle of handles) {
        const out = resizeRect(box, handle, 37, -53, BOUNDS, shape, 4);
        expect(inside(out, BOUNDS)).toBe(true);
      }
    }
  });
});

describe("normalizeTurn and turnedSize", () => {
  it("wraps quarter turns and clamps the angle", () => {
    expect(normalizeTurn({ quarters: 5 as never }).quarters).toBe(1);
    expect(normalizeTurn({ quarters: -1 as never }).quarters).toBe(3);
    expect(normalizeTurn({ angle: 200 }).angle).toBe(45);
    expect(normalizeTurn({ angle: -200 }).angle).toBe(-45);
    expect(normalizeTurn({ angle: NaN }).angle).toBe(0);
    expect(normalizeTurn({ quarters: NaN as never }).quarters).toBe(0);
    expect(isNoTurn(normalizeTurn())).toBe(true);
  });
  it("swaps width and height for odd quarter turns", () => {
    expect(turnedSize({ width: 300, height: 200 }, { quarters: 1 })).toEqual({ width: 200, height: 300 });
    expect(turnedSize({ width: 300, height: 200 }, { quarters: 2 })).toEqual({ width: 300, height: 200 });
    expect(turnedSize({ width: 300, height: 200 }, { flipH: true, flipV: true })).toEqual({ width: 300, height: 200 });
  });
  it("grows to the box that holds a tilted picture", () => {
    const t = turnedSize({ width: 100, height: 100 }, { angle: 45 });
    expect(t.width).toBe(142);
    expect(t.height).toBe(142);
    // The tilt is limited to 45 degrees.
    expect(turnedSize({ width: 100, height: 50 }, { angle: 90 })).toEqual(turnedSize({ width: 100, height: 50 }, { angle: 45 }));
  });
  it("is symmetric for left and right tilt", () => {
    expect(turnedSize({ width: 640, height: 480 }, { angle: 7 })).toEqual(turnedSize({ width: 640, height: 480 }, { angle: -7 }));
  });
  it("never returns zero for a 1 × 1 picture", () => {
    const t = turnedSize({ width: 1, height: 1 }, { angle: 30 });
    expect(t.width).toBeGreaterThanOrEqual(1);
    expect(t.height).toBeGreaterThanOrEqual(1);
  });
});

describe("turnMatrix", () => {
  const size = { width: 300, height: 200 };
  const corners = [
    [0, 0],
    [300, 0],
    [300, 200],
    [0, 200],
  ] as const;

  it("is the identity when nothing is changed", () => {
    expect(turnMatrix(size, {})).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("maps corners of a quarter turn exactly", () => {
    const m = turnMatrix(size, { quarters: 1 });
    // A clockwise quarter turn sends the top-left corner to the top-right of the new 200 × 300 picture.
    expect(mapPoint(m, 0, 0)).toEqual({ x: 200, y: 0 });
    expect(mapPoint(m, 300, 0)).toEqual({ x: 200, y: 300 });
    expect(mapPoint(m, 0, 200)).toEqual({ x: 0, y: 0 });
    expect(mapPoint(m, 300, 200)).toEqual({ x: 0, y: 300 });
  });

  it("maps a half turn and the flips", () => {
    expect(mapPoint(turnMatrix(size, { quarters: 2 }), 0, 0)).toEqual({ x: 300, y: 200 });
    expect(mapPoint(turnMatrix(size, { flipH: true }), 0, 0)).toEqual({ x: 300, y: 0 });
    expect(mapPoint(turnMatrix(size, { flipV: true }), 0, 0)).toEqual({ x: 0, y: 200 });
    // A horizontal flip plus a vertical flip is a half turn.
    const both = turnMatrix(size, { flipH: true, flipV: true });
    const half = turnMatrix(size, { quarters: 2 });
    for (const [x, y] of corners) expect(mapPoint(both, x, y)).toEqual(mapPoint(half, x, y));
  });

  it("flips before it turns", () => {
    // Mirror left-right, then a quarter turn: the top-left corner ends up bottom-right... of the turned picture's top edge.
    const m = turnMatrix(size, { flipH: true, quarters: 1 });
    expect(mapPoint(m, 300, 0)).toEqual({ x: 200, y: 0 }); // after the mirror this is the top-left, which a quarter turn sends to the top-right
  });

  it("keeps every corner inside the turned picture for any quarter, flip and angle", () => {
    for (const quarters of [0, 1, 2, 3] as const) {
      for (const flipH of [false, true]) {
        for (const flipV of [false, true]) {
          for (const angle of [-45, -17.5, 0, 3, 45]) {
            const turn = { quarters, flipH, flipV, angle };
            const out = turnedSize(size, turn);
            const m = turnMatrix(size, turn);
            for (const [x, y] of corners) {
              const p = mapPoint(m, x, y);
              expect(p.x).toBeGreaterThanOrEqual(-1e-6);
              expect(p.y).toBeGreaterThanOrEqual(-1e-6);
              expect(p.x).toBeLessThanOrEqual(out.width + 1e-6);
              expect(p.y).toBeLessThanOrEqual(out.height + 1e-6);
            }
            // The middle of the picture stays in the middle.
            const mid = mapPoint(m, 150, 100);
            expect(mid.x).toBeCloseTo(out.width / 2, 6);
            expect(mid.y).toBeCloseTo(out.height / 2, 6);
          }
        }
      }
    }
  });

  it("four quarter turns bring every corner back", () => {
    const m = turnMatrix(size, { quarters: 0 });
    const again = turnMatrix(size, { quarters: 4 as never });
    expect(again).toEqual(m);
  });

  it("is built from exact numbers for quarter turns (no 1e-16 noise)", () => {
    for (const quarters of [1, 2, 3] as const) {
      const m = turnMatrix(size, { quarters });
      for (const n of m) expect(Number.isInteger(n) || Math.abs(n - Math.round(n)) > 1e-3).toBe(true);
    }
  });
});

describe("cropMatrix", () => {
  it("moves the crop corner to the origin and scales", () => {
    const m = turnMatrix({ width: 300, height: 200 }, { quarters: 1 });
    const crop = { x: 20, y: 30, width: 100, height: 100 };
    const c = cropMatrix(m, crop);
    expect(mapPoint(c, 0, 0)).toEqual({ x: 200 - 20, y: -30 });
    const half = cropMatrix(m, crop, 0.5);
    expect(mapPoint(half, 0, 0)).toEqual({ x: (200 - 20) / 2, y: -15 });
  });
});

describe("insideTilted", () => {
  /** Is the upright w × h box, centred, fully inside the (W × H) picture tilted by `deg`? */
  function fits(W: number, H: number, deg: number, w: number, h: number, slack = 1e-6) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const px = (sx * w) / 2;
      const py = (sy * h) / 2;
      // Rotate the box corner back into the picture's own frame.
      const x = px * cos + py * sin;
      const y = -px * sin + py * cos;
      if (Math.abs(x) > W / 2 + slack || Math.abs(y) > H / 2 + slack) return false;
    }
    return true;
  }

  it("returns the whole picture when it is not tilted", () => {
    expect(insideTilted({ width: 400, height: 300 }, 0)).toEqual({ width: 400, height: 300 });
    expect(insideTilted({ width: 400, height: 300 }, NaN)).toEqual({ width: 400, height: 300 });
  });

  it("fits inside the tilted picture for many sizes and angles, and is close to the best possible", () => {
    for (const [W, H] of [
      [400, 300],
      [300, 400],
      [500, 500],
      [1000, 100],
      [100, 1000],
      [1, 1],
    ] as const) {
      for (const deg of [0.5, 1, 5, 10, 30, 44, 45, -12, -45]) {
        const best = insideTilted({ width: W, height: H }, deg);
        expect(fits(W, H, deg, best.width, best.height), `${W}x${H} @ ${deg}`).toBe(true);
        // A box a few percent larger on both sides must not fit (this guards against an answer that is too timid).
        expect(fits(W, H, deg, best.width * 1.02, best.height * 1.02), `${W}x${H} @ ${deg} could be larger`).toBe(false);
      }
    }
  });

  it("agrees with brute force on the area", () => {
    const W = 400;
    const H = 300;
    for (const deg of [3, 12, 25, 40]) {
      let bestArea = 0;
      for (let w = 20; w <= W; w += 4) {
        // For this width, find the tallest height that fits by bisection.
        let lo = 0;
        let hi = H;
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          if (fits(W, H, deg, w, mid)) lo = mid;
          else hi = mid;
        }
        bestArea = Math.max(bestArea, w * lo);
      }
      const got = insideTilted({ width: W, height: H }, deg);
      expect(got.width * got.height).toBeGreaterThanOrEqual(bestArea * 0.97);
    }
  });

  it("turns a picture on its side at 90 degrees", () => {
    const r = insideTilted({ width: 400, height: 300 }, 90);
    expect(r.width).toBeCloseTo(300, 4);
    expect(r.height).toBeCloseTo(400, 4);
  });
});

describe("rectWithoutCorners", () => {
  it("is the whole picture when not straightened", () => {
    expect(rectWithoutCorners({ width: 400, height: 300 }, {})).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });
  it("is centred and smaller than the turned picture when straightened", () => {
    const size = { width: 400, height: 300 };
    const turn = { angle: 10 };
    const turned = turnedSize(size, turn);
    const r = rectWithoutCorners(size, turn);
    expect(inside(r, turned)).toBe(true);
    expect(r.width).toBeLessThan(size.width);
    expect(Math.abs(r.x + r.width / 2 - turned.width / 2)).toBeLessThanOrEqual(1);
  });
  it("accounts for quarter turns", () => {
    const r = rectWithoutCorners({ width: 400, height: 300 }, { quarters: 1, angle: 5 });
    const turned = turnedSize({ width: 400, height: 300 }, { quarters: 1, angle: 5 });
    expect(inside(r, turned)).toBe(true);
    expect(r.height).toBeGreaterThan(r.width);
  });
  it("never has a corner that is empty after the real transform", () => {
    const size = { width: 640, height: 480 };
    for (const angle of [-30, -4, 2, 15, 45]) {
      const turn = { angle };
      const r = rectWithoutCorners(size, turn);
      const m = turnMatrix(size, turn);
      // Map the box corners back into the original and check they are inside it (inverse of an affine map).
      const det = m[0] * m[3] - m[1] * m[2];
      for (const [cx, cy] of [
        [r.x, r.y],
        [r.x + r.width, r.y],
        [r.x + r.width, r.y + r.height],
        [r.x, r.y + r.height],
      ] as const) {
        const px = cx - m[4];
        const py = cy - m[5];
        const sx = (m[3] * px - m[2] * py) / det;
        const sy = (-m[1] * px + m[0] * py) / det;
        expect(sx).toBeGreaterThanOrEqual(-0.5);
        expect(sy).toBeGreaterThanOrEqual(-0.5);
        expect(sx).toBeLessThanOrEqual(size.width + 0.5);
        expect(sy).toBeLessThanOrEqual(size.height + 0.5);
      }
    }
  });
});

describe("checkSize", () => {
  it("accepts ordinary pictures", () => {
    expect(checkSize({ width: 4000, height: 3000 })).toEqual({});
  });
  it("warns above the phone ceiling and refuses above the limits", () => {
    expect(checkSize({ width: 5000, height: 4000 }).warn).toMatch(/20 million pixels/);
    expect(checkSize({ width: 20000, height: 10 }).refuse).toMatch(/16,384/);
    expect(checkSize({ width: 12000, height: 12000 }).refuse).toMatch(/144 million pixels/);
    expect(checkSize({ width: 10_000, height: 10_000 }).refuse).toBeUndefined();
    expect(CROP_LIMITS.maxPixels).toBe(100_000_000);
  });
  it("refuses empty and non-numeric sizes", () => {
    expect(checkSize({ width: 0, height: 10 }).refuse).toBeDefined();
    expect(checkSize({ width: NaN, height: 10 }, "result").refuse).toMatch(/result/);
  });
});

describe("describeSize", () => {
  it("rounds to whole pixels", () => {
    expect(describeSize({ width: 100.4, height: 50.6 })).toBe("100 × 51");
  });
});
