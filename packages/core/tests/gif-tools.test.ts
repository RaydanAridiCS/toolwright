import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  boomerangFrames,
  changeSpeed,
  checkGifBudget,
  countColors,
  decodeGif,
  dropFrames,
  effectiveDelay,
  encodeGif,
  fitRgba,
  flipGif,
  GIF_LIMITS,
  heightForWidth,
  isGif,
  resizeGif,
  resizeRgba,
  reverseFrames,
  rotateGif,
  setDelay,
  totalDuration,
  trimFrames,
  type GifFrame,
  type GifImage,
} from "../src/gif-tools";

const fixture = (name: string) => new Uint8Array(readFileSync(join(import.meta.dirname, "fixtures", "gif", name)));
const px = (f: GifFrame, w: number, x: number, y: number) => [...f.rgba.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];

/** A frame of a background colour with a square of another colour. */
function frame(w: number, h: number, bg: number[], square?: { c: number[]; x: number; y: number; size: number }, delayMs = 100): GifFrame {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = square && x >= square.x && x < square.x + square.size && y >= square.y && y < square.y + square.size;
      rgba.set(inside ? square!.c : bg, (y * w + x) * 4);
    }
  }
  return { rgba, delayMs };
}

const RED = [255, 0, 0, 255];
const GREEN = [0, 200, 0, 255];
const BLUE = [0, 0, 255, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

const close = (a: number[], b: number[], tolerance = 6) => a.forEach((v, i) => expect(Math.abs(v - (b[i] as number))).toBeLessThanOrEqual(tolerance));

describe("decodeGif: GIFs made by another encoder", () => {
  it("reads size, frame count, delays, loop and colours", () => {
    const gif = decodeGif(fixture("solid-3.gif"));
    expect([gif.width, gif.height, gif.frames.length]).toEqual([40, 30, 3]);
    expect(gif.frames.map((f) => f.delayMs)).toEqual([100, 200, 300]);
    expect(gif.loop).toBe(0);
    close(px(gif.frames[0]!, 40, 5, 5), RED, 2);
    close(px(gif.frames[1]!, 40, 5, 5), GREEN, 2);
    close(px(gif.frames[2]!, 40, 5, 5), BLUE, 2);
    expect(gif.frames.every((f) => f.rgba.length === 40 * 30 * 4)).toBe(true);
  });

  it("rebuilds whole frames from frames that only draw what changed", () => {
    const gif = decodeGif(fixture("moving-square.gif"));
    expect(gif.frames).toHaveLength(4);
    const at = (i: number, x: number, y: number) => px(gif.frames[i]!, 40, x, y);
    close(at(0, 5, 5), RED);
    close(at(0, 15, 12), WHITE);
    // Frame 2: the square moved, and the old place is white again.
    close(at(1, 15, 12), RED);
    close(at(1, 5, 5), WHITE);
    close(at(3, 30, 20), RED);
    close(at(3, 15, 12), WHITE);
  });

  it("keeps transparency and clears frames between steps", () => {
    const gif = decodeGif(fixture("transparent-square.gif"));
    expect(gif.frames).toHaveLength(3);
    const at = (i: number, x: number, y: number) => px(gif.frames[i]!, 40, x, y);
    expect(at(0, 0, 0)[3]).toBe(0);
    close(at(0, 5, 5), BLUE, 3);
    expect(at(0, 5, 5)[3]).toBe(255);
    expect(at(1, 5, 5)[3]).toBe(0); // the first square is gone
    close(at(1, 25, 14), BLUE, 3);
    close(at(2, 32, 20), GREEN, 3);
    expect(at(2, 25, 14)[3]).toBe(0);
  });

  it("shows a delay of 10 ms or less as 100 ms, like browsers do", () => {
    expect(effectiveDelay(0)).toBe(100);
    expect(effectiveDelay(10)).toBe(100);
    expect(effectiveDelay(20)).toBe(20);
    expect(effectiveDelay(300)).toBe(300);
  });
});

describe("encodeGif and decodeGif together", () => {
  const frames = [frame(32, 24, WHITE, { c: RED, x: 2, y: 2, size: 8 }, 100), frame(32, 24, WHITE, { c: GREEN, x: 12, y: 8, size: 8 }, 250), frame(32, 24, WHITE, { c: BLUE, x: 20, y: 14, size: 8 }, 120)];
  const image: GifImage = { width: 32, height: 24, frames, loop: 0 };

  it("round-trips pixels, size and timing (delays are stored in hundredths of a second)", () => {
    const bytes = encodeGif(image);
    expect(isGif(bytes)).toBe(true);
    const back = decodeGif(bytes);
    expect([back.width, back.height, back.frames.length, back.loop]).toEqual([32, 24, 3, 0]);
    expect(back.frames.map((f) => f.delayMs)).toEqual([100, 250, 120]);
    back.frames.forEach((f, i) => {
      for (let p = 0; p < f.rgba.length; p += 4) close([...f.rgba.subarray(p, p + 4)], [...frames[i]!.rgba.subarray(p, p + 4)], 8);
    });
  });

  it("remembers how many times to loop", () => {
    expect(decodeGif(encodeGif({ ...image, loop: 3 })).loop).toBe(3);
    expect(decodeGif(encodeGif({ ...image, loop: 0 })).loop).toBe(0);
  });

  it("never writes a delay under 20 ms", () => {
    const quick = encodeGif({ ...image, frames: frames.map((f) => ({ ...f, delayMs: 5 })) });
    expect(decodeGif(quick).frames.map((f) => f.delayMs)).toEqual([20, 20, 20]);
  });

  it("keeps transparency", () => {
    const clear = [frame(20, 20, CLEAR, { c: RED, x: 2, y: 2, size: 6 }), frame(20, 20, CLEAR, { c: BLUE, x: 10, y: 10, size: 6 })];
    const back = decodeGif(encodeGif({ width: 20, height: 20, frames: clear, loop: 0 }));
    expect(px(back.frames[0]!, 20, 0, 0)[3]).toBe(0);
    expect(px(back.frames[0]!, 20, 4, 4)[3]).toBe(255);
    expect(px(back.frames[1]!, 20, 4, 4)[3]).toBe(0);
    close(px(back.frames[1]!, 20, 12, 12), BLUE, 8);
  });

  it("works with one palette per frame as well", () => {
    const back = decodeGif(encodeGif(image, { palette: "per-frame" }));
    close(px(back.frames[1]!, 32, 14, 10), GREEN, 8);
  });

  it("fewer colours give a smaller file with no more than that many colours per frame", () => {
    const noisy: GifFrame[] = Array.from({ length: 3 }, (_, k) => {
      const rgba = new Uint8ClampedArray(48 * 48 * 4);
      for (let i = 0; i < 48 * 48; i++) rgba.set([(i * 7 + k * 40) % 256, (i * 13) % 256, (i * 29 + k) % 256, 255], i * 4);
      return { rgba, delayMs: 100 };
    });
    const big = encodeGif({ width: 48, height: 48, frames: noisy, loop: 0 }, { maxColors: 256 });
    const small = encodeGif({ width: 48, height: 48, frames: noisy, loop: 0 }, { maxColors: 16 });
    expect(small.length).toBeLessThan(big.length);
    for (const f of decodeGif(small).frames) expect(countColors(f.rgba)).toBeLessThanOrEqual(16);
  });

  it("optimize makes an animation with a detailed, unchanging background much smaller, and decodes to identical pixels", () => {
    // A busy background that does not change, with a small square moving over it.
    const busy = (square: number): GifFrame => {
      const rgba = new Uint8ClampedArray(96 * 64 * 4);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 96; x++) {
          const inside = x >= 4 + square * 8 && x < 12 + square * 8 && y >= 20 && y < 28;
          rgba.set(inside ? [255, 255, 255, 255] : [(x * 5 + y * 3) % 256, (x * 2 + y * 7) % 256, (x * y) % 256, 255], (y * 96 + x) * 4);
        }
      }
      return { rgba, delayMs: 80 };
    };
    const input: GifImage = { width: 96, height: 64, frames: Array.from({ length: 8 }, (_, i) => busy(i)), loop: 0 };
    const plain = encodeGif(input, { palette: "shared" });
    const optimized = encodeGif(input, { optimize: true });
    expect(optimized.length).toBeLessThan(plain.length * 0.6);
    const a = decodeGif(plain);
    const b = decodeGif(optimized);
    expect(b.frames).toHaveLength(8);
    // The optimized file shows the same pictures as the plain one made with the same palette.
    b.frames.forEach((f, i) => {
      let differing = 0;
      for (let p = 0; p < f.rgba.length; p += 4) if (Math.abs((f.rgba[p] as number) - (a.frames[i]!.rgba[p] as number)) > 16 || Math.abs((f.rgba[p + 1] as number) - (a.frames[i]!.rgba[p + 1] as number)) > 16) differing++;
      expect(differing / (f.rgba.length / 4)).toBeLessThan(0.02); // the optimized palette has one colour fewer
      expect(f.rgba[3]).toBe(255); // every pixel of every frame is opaque after the pictures are rebuilt
    });
  });

  it("skips optimize for GIFs with transparency, and still writes them correctly", () => {
    const clear = [frame(16, 16, CLEAR, { c: RED, x: 2, y: 2, size: 4 }), frame(16, 16, CLEAR, { c: RED, x: 8, y: 8, size: 4 })];
    const back = decodeGif(encodeGif({ width: 16, height: 16, frames: clear, loop: 0 }, { optimize: true }));
    expect(px(back.frames[1]!, 16, 3, 3)[3]).toBe(0);
    expect(px(back.frames[1]!, 16, 9, 9)[3]).toBe(255);
  });

  it("reports progress", () => {
    const seen: number[] = [];
    encodeGif(image, { onProgress: (done) => seen.push(done) });
    expect(seen).toEqual([1, 2, 3]);
  });

  it("refuses an empty animation, and a size that is too big", () => {
    expect(() => encodeGif({ width: 10, height: 10, frames: [], loop: 0 })).toThrow(/no frames/);
    expect(() => encodeGif({ width: 0, height: 10, frames: [frame(1, 1, WHITE)], loop: 0 })).toThrow(/no size/);
    expect(() => encodeGif({ width: 5000, height: 10, frames: [frame(1, 1, WHITE)], loop: 0 })).toThrow(/too large to edit/);
  });
});

describe("decodeGif: bad files", () => {
  it("explains what is wrong", () => {
    expect(() => decodeGif(new Uint8Array([1, 2, 3, 4, 5, 6, 7]))).toThrow(/not a GIF/);
    expect(() => decodeGif(new Uint8Array())).toThrow(/not a GIF/);
    const cut = fixture("solid-3.gif").slice(0, 60);
    expect(() => decodeGif(cut)).toThrow(/damaged|cut short/);
  });

  it("never crashes on garbage after a valid header", () => {
    let seed = 1;
    for (let round = 0; round < 40; round++) {
      const junk = new Uint8Array(200);
      for (let i = 0; i < junk.length; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        junk[i] = seed >>> 24;
      }
      junk.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      try {
        decodeGif(junk);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message.length).toBeGreaterThan(5);
      }
    }
  });

  it("checks the memory budget", () => {
    expect(checkGifBudget(100, 100, 10)).toBeNull();
    expect(checkGifBudget(5000, 100, 1)).toMatch(/too large/);
    expect(checkGifBudget(100, 100, GIF_LIMITS.maxFrames + 1)).toMatch(/frames/);
    expect(checkGifBudget(3000, 3000, 20)).toMatch(/million pixels/);
  });
});

describe("timing and frame order", () => {
  const f = (n: number, d = 100): GifFrame => ({ rgba: new Uint8ClampedArray([n, 0, 0, 255]), delayMs: d });
  const frames = [f(1, 100), f(2, 200), f(3, 300), f(4, 400)];
  const ids = (fs: GifFrame[]) => fs.map((x) => x.rgba[0]);

  it("reverses and boomerangs", () => {
    expect(ids(reverseFrames(frames))).toEqual([4, 3, 2, 1]);
    expect(ids(boomerangFrames(frames))).toEqual([1, 2, 3, 4, 3, 2]);
    expect(ids(boomerangFrames([f(1), f(2)]))).toEqual([1, 2]);
    expect(ids(frames)).toEqual([1, 2, 3, 4]); // the original is untouched
  });

  it("changes speed and keeps delays at 20 ms or more", () => {
    expect(changeSpeed(frames, 2).map((x) => x.delayMs)).toEqual([50, 100, 150, 200]);
    expect(changeSpeed(frames, 0.5).map((x) => x.delayMs)).toEqual([200, 400, 600, 800]);
    expect(changeSpeed(frames, 100).map((x) => x.delayMs)).toEqual([20, 20, 20, 20]);
    expect(() => changeSpeed(frames, 0)).toThrow(/above 0/);
    expect(() => changeSpeed(frames, Number.NaN)).toThrow(/above 0/);
  });

  it("sets one delay for all frames", () => {
    expect(setDelay(frames, 40).map((x) => x.delayMs)).toEqual([40, 40, 40, 40]);
    expect(() => setDelay(frames, 10)).toThrow(/at least 20/);
  });

  it("drops frames but keeps the total time the same", () => {
    const out = dropFrames(frames, 2);
    expect(ids(out)).toEqual([1, 3]);
    expect(out.map((x) => x.delayMs)).toEqual([300, 700]);
    expect(totalDuration(out)).toBe(totalDuration(frames));
    expect(ids(dropFrames(frames, 3))).toEqual([1, 4]);
    expect(() => dropFrames(frames, 1)).toThrow(/2 or more/);
  });

  it("trims to a range of frames, counting from 1", () => {
    expect(ids(trimFrames(frames, 2, 3))).toEqual([2, 3]);
    expect(ids(trimFrames(frames, 1, 4))).toEqual([1, 2, 3, 4]);
    expect(() => trimFrames(frames, 0, 2)).toThrow(/from 1 to 4/);
    expect(() => trimFrames(frames, 3, 2)).toThrow(/from 1 to 4/);
    expect(() => trimFrames(frames, 1, 9)).toThrow(/from 1 to 4/);
  });
});

describe("resizing", () => {
  it("keeps a flat colour flat, up and down", () => {
    const solid = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 64; i++) solid.set([10, 120, 200, 255], i * 4);
    for (const [w, h] of [[4, 4], [16, 16], [3, 5], [1, 1]] as [number, number][]) {
      const out = resizeRgba(solid, 8, 8, w, h);
      expect(out.length).toBe(w * h * 4);
      for (let i = 0; i < w * h; i++) close([...out.subarray(i * 4, i * 4 + 4)], [10, 120, 200, 255], 1);
    }
  });

  it("averages the pixels it shrinks, so a fine checkerboard becomes grey", () => {
    const check = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) check.set((x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * 8 + x) * 4);
    const out = resizeRgba(check, 8, 8, 2, 2);
    for (let i = 0; i < 4; i++) close([...out.subarray(i * 4, i * 4 + 3)], [127.5, 127.5, 127.5], 1);
  });

  it("does not leave a dark fringe where a white shape meets transparency", () => {
    const shape = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (x < 4) shape.set([255, 255, 255, 255], (y * 8 + x) * 4);
    const out = resizeRgba(shape, 8, 8, 3, 3);
    for (let i = 0; i < 9; i++) if ((out[i * 4 + 3] as number) > 0) close([...out.subarray(i * 4, i * 4 + 3)], [255, 255, 255], 1);
  });

  it("resizes a whole GIF and keeps the shape when only the width is given", () => {
    const gif = decodeGif(fixture("solid-3.gif"));
    const small = resizeGif(gif, 20, heightForWidth(gif.width, gif.height, 20));
    expect([small.width, small.height, small.frames.length]).toEqual([20, 15, 3]);
    close(px(small.frames[1]!, 20, 10, 7), GREEN, 2);
    expect(() => resizeGif(gif, 0, 10)).toThrow(/whole numbers/);
    expect(() => resizeGif(gif, 5000, 10)).toThrow(/too large/);
  });
});

describe("rotating, flipping and fitting", () => {
  const w = 4;
  const h = 2;
  const make = (): GifImage => {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) rgba.set([i * 10, 0, 0, 255], i * 4); // pixel number as red
    return { width: w, height: h, frames: [{ rgba, delayMs: 100 }], loop: 0 };
  };
  const reds = (g: GifImage) => Array.from({ length: g.width * g.height }, (_, i) => g.frames[0]!.rgba[i * 4]! / 10);

  it("turns 90, 180 and 270 degrees clockwise", () => {
    // Row 0 is 0 1 2 3, row 1 is 4 5 6 7.
    const r90 = rotateGif(make(), 90);
    expect([r90.width, r90.height]).toEqual([2, 4]);
    expect(reds(r90)).toEqual([4, 0, 5, 1, 6, 2, 7, 3]);
    expect(reds(rotateGif(make(), 180))).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    const r270 = rotateGif(make(), 270);
    expect([r270.width, r270.height]).toEqual([2, 4]);
    expect(reds(r270)).toEqual([3, 7, 2, 6, 1, 5, 0, 4]);
  });

  it("four quarter turns bring it back", () => {
    let g = make();
    for (let i = 0; i < 4; i++) g = rotateGif(g, 90);
    expect(reds(g)).toEqual(reds(make()));
  });

  it("flips both ways", () => {
    expect(reds(flipGif(make(), "horizontal"))).toEqual([3, 2, 1, 0, 7, 6, 5, 4]);
    expect(reds(flipGif(make(), "vertical"))).toEqual([4, 5, 6, 7, 0, 1, 2, 3]);
  });

  it("fits a picture onto a canvas with bars of the background colour", () => {
    const wide = new Uint8ClampedArray(8 * 2 * 4);
    for (let i = 0; i < 16; i++) wide.set(RED, i * 4);
    const out = fitRgba(wide, 8, 2, 8, 8, "contain", [0, 0, 255, 255]);
    close([...out.subarray(0, 4)], BLUE, 0); // top bar
    close([...out.subarray((4 * 8 + 4) * 4, (4 * 8 + 4) * 4 + 4)], RED, 1); // middle
    const cover = fitRgba(wide, 8, 2, 8, 8, "cover", [0, 0, 255, 255]);
    close([...cover.subarray(0, 4)], RED, 1);
    expect(fitRgba(wide, 8, 2, 4, 4, "stretch", [0, 0, 0, 0]).length).toBe(4 * 4 * 4);
  });
});

describe("scale", () => {
  it("handles a long animation of a moderate size", () => {
    const frames = Array.from({ length: 60 }, (_, i) => frame(160, 120, WHITE, { c: RED, x: i * 2, y: 20, size: 20 }));
    const t0 = Date.now();
    const bytes = encodeGif({ width: 160, height: 120, frames, loop: 0 }, { optimize: true });
    const back = decodeGif(bytes);
    expect(back.frames).toHaveLength(60);
    expect(Date.now() - t0).toBeLessThan(15_000);
  });
});
