/**
 * Read, change and write animated GIFs. Frames are kept as full-size RGBA pictures, so every edit (reverse, speed,
 * resize, rotate, skip frames) is simple and exact, and writing a GIF is one step. Reading handles frames that only
 * cover part of the picture and the "restore" modes between frames. Keep this file free of React, the DOM and the network.
 *
 * Heavy: import this module only from the tools that need it.
 */
// @ts-expect-error TS7016: gifenc ships no type declarations
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { GifReader } from "omggif";

export interface GifFrame {
  /** Full-size RGBA pixels, width x height x 4. Transparent pixels have alpha 0. */
  rgba: Uint8ClampedArray;
  /** How long the frame is shown, in milliseconds. */
  delayMs: number;
}

export interface GifImage {
  width: number;
  height: number;
  frames: GifFrame[];
  /** 0 plays forever; any other number is how many times it repeats. */
  loop: number;
}

/** Limits that keep a tab from running out of memory. Pixel data is 4 bytes per pixel per frame. */
export const GIF_LIMITS = {
  maxFrames: 500,
  maxSide: 4000,
  /** Total pixels over all frames (width x height x frames). 60 million is about 240 MB of pixel data. */
  maxTotalPixels: 60_000_000,
  maxFileBytes: 100 * 1024 * 1024,
  /** Browsers show a delay of 10 ms or less as 100 ms, so shorter delays are not worth having. */
  minDelayMs: 20,
} as const;

/** The delay a browser really uses for a stored delay. */
export const effectiveDelay = (ms: number) => (ms <= 10 ? 100 : ms);

/** A readable reason a GIF of this size cannot be handled, or null. */
export function checkGifBudget(width: number, height: number, frames: number): string | null {
  if (width > GIF_LIMITS.maxSide || height > GIF_LIMITS.maxSide) return `The picture is ${width} × ${height}. Sizes above ${GIF_LIMITS.maxSide} pixels on a side are too large to edit in a browser tab.`;
  if (frames > GIF_LIMITS.maxFrames) return `The GIF has ${frames} frames. The limit is ${GIF_LIMITS.maxFrames}.`;
  const total = width * height * frames;
  if (total > GIF_LIMITS.maxTotalPixels) return `${width} × ${height} with ${frames} frames is ${Math.round(total / 1e6)} million pixels, and the limit is ${GIF_LIMITS.maxTotalPixels / 1e6} million. Make the GIF smaller or shorter first.`;
  return null;
}

export const isGif = (bytes: Uint8Array) => bytes.length > 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;

/** Read a GIF. Throws a readable error for files that are not GIFs, are damaged, or are too large to edit. */
export function decodeGif(bytes: Uint8Array): GifImage {
  if (!isGif(bytes)) throw new Error("This is not a GIF file.");
  if (bytes.length > GIF_LIMITS.maxFileBytes) throw new Error(`This GIF is ${Math.round(bytes.length / 1048576)} MB. The limit is ${GIF_LIMITS.maxFileBytes / 1048576} MB.`);
  let reader: GifReader;
  try {
    reader = new GifReader(bytes as unknown as Buffer);
  } catch {
    throw new Error("This GIF is damaged or cut short, so it cannot be read.");
  }
  const { width, height } = reader;
  const count = reader.numFrames();
  const problem = checkGifBudget(width, height, count);
  if (problem) throw new Error(problem);

  const canvas = new Uint8ClampedArray(width * height * 4);
  const frames: GifFrame[] = [];
  let restore: Uint8ClampedArray | null = null;
  let prev: { x: number; y: number; width: number; height: number; disposal: number } | null = null;

  for (let i = 0; i < count; i++) {
    const info = reader.frameInfo(i);
    // What the previous frame asked for before this one is drawn.
    if (prev) {
      if (prev.disposal === 2) {
        for (let y = prev.y; y < Math.min(height, prev.y + prev.height); y++) canvas.fill(0, (y * width + prev.x) * 4, (y * width + Math.min(width, prev.x + prev.width)) * 4);
      } else if (prev.disposal === 3 && restore) canvas.set(restore);
    }
    restore = info.disposal === 3 ? canvas.slice() : null;
    try {
      reader.decodeAndBlitFrameRGBA(i, canvas as unknown as Uint8Array);
    } catch {
      throw new Error(`Frame ${i + 1} of this GIF is damaged, so it cannot be read.`);
    }
    frames.push({ rgba: canvas.slice(), delayMs: effectiveDelay(info.delay * 10) });
    prev = { x: info.x, y: info.y, width: info.width, height: info.height, disposal: info.disposal };
  }
  return { width, height, frames, loop: reader.loopCount() ?? 0 };
}

/* ----------------------------------------------------------------------------------------------- */
/* Writing                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export interface EncodeOptions {
  /** Colours per palette, 2 to 256. Fewer colours make a smaller file. Default 256. */
  maxColors?: number;
  /** One palette for the whole animation (smaller, steadier colours) or one per frame (more accurate). Default "shared". */
  palette?: "shared" | "per-frame";
  /**
   * Draw only what changes from one frame to the next, by making unchanged pixels transparent. Often much smaller.
   * Uses a shared palette, and is skipped for GIFs that already have transparency. Default false.
   */
  optimize?: boolean;
  /** Called after each frame with the number done. */
  onProgress?: (done: number, total: number) => void;
}

const ALPHA_CUT = 128;
const hasTransparency = (rgba: Uint8ClampedArray) => {
  for (let i = 3; i < rgba.length; i += 4) if ((rgba[i] as number) < ALPHA_CUT) return true;
  return false;
};

/** A sample of every frame's pixels, small enough to build one palette from quickly. */
function samplePixels(frames: GifFrame[], maxPixels = 600_000): Uint8ClampedArray {
  const total = frames.reduce((n, f) => n + f.rgba.length / 4, 0);
  const stride = Math.max(1, Math.floor(total / maxPixels));
  const out: number[] = [];
  let k = 0;
  for (const f of frames) {
    for (let p = 0; p < f.rgba.length; p += 4) {
      if (k++ % stride !== 0) continue;
      out.push(f.rgba[p] as number, f.rgba[p + 1] as number, f.rgba[p + 2] as number, f.rgba[p + 3] as number);
    }
  }
  return Uint8ClampedArray.from(out);
}

/** Write a GIF. */
export function encodeGif(image: GifImage, options: EncodeOptions = {}): Uint8Array {
  const { width, height, frames } = image;
  if (frames.length === 0) throw new Error("There are no frames to save.");
  if (!(width > 0 && height > 0)) throw new Error("The picture has no size.");
  const problem = checkGifBudget(width, height, frames.length);
  if (problem) throw new Error(problem);
  const maxColors = Math.min(256, Math.max(2, Math.round(options.maxColors ?? 256)));
  const alpha = frames.some((f) => hasTransparency(f.rgba));
  const optimize = !!options.optimize && !alpha;
  const shared = optimize || (options.palette ?? "shared") === "shared";
  const format = alpha ? "rgba4444" : "rgb565";
  const quantOptions = alpha ? { format, oneBitAlpha: true, clearAlpha: true } : { format };

  const encoder = GIFEncoder();
  let sharedPalette: number[][] | null = null;
  let transparentSlot = -1;
  if (shared) {
    // With "optimize" one palette entry is kept free to stand for "unchanged".
    sharedPalette = quantize(samplePixels(frames), optimize ? maxColors - 1 : maxColors, quantOptions) as number[][];
    if (optimize) {
      transparentSlot = sharedPalette.length;
      sharedPalette = [...sharedPalette, [0, 0, 0]];
    }
  }
  let previous: Uint8Array | null = null;

  frames.forEach((frame, i) => {
    const palette = sharedPalette ?? (quantize(frame.rgba, maxColors, quantOptions) as number[][]);
    let index: Uint8Array = applyPalette(frame.rgba, palette, format);
    let transparent = false;
    let transparentIndex = 0;
    if (alpha) {
      const slot = palette.findIndex((p) => p.length === 4 && p[3] === 0);
      if (slot >= 0) {
        transparent = true;
        transparentIndex = slot;
      }
    } else if (optimize) {
      const current = index;
      if (previous) {
        index = current.slice();
        for (let p = 0; p < index.length; p++) if (current[p] === previous[p]) index[p] = transparentSlot;
        transparent = true;
        transparentIndex = transparentSlot;
      }
      previous = current;
    }
    encoder.writeFrame(index, width, height, {
      // The first frame's palette is the global one; frames after it use it unless they bring their own.
      palette: shared ? (i === 0 ? sharedPalette : null) : palette,
      delay: Math.max(GIF_LIMITS.minDelayMs, Math.round(frame.delayMs)),
      transparent,
      transparentIndex,
      repeat: image.loop === 0 ? 0 : Math.max(1, image.loop),
      // Transparent GIFs must clear each frame; others are redrawn in full or only where they changed.
      dispose: alpha ? 2 : 1,
    });
    options.onProgress?.(i + 1, frames.length);
  });
  encoder.finish();
  return encoder.bytes();
}

/* ----------------------------------------------------------------------------------------------- */
/* Editing                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export const reverseFrames = (frames: GifFrame[]): GifFrame[] => [...frames].reverse();

/** Forward, then back again, without showing the first and last frames twice. */
export function boomerangFrames(frames: GifFrame[]): GifFrame[] {
  if (frames.length < 3) return frames.slice();
  return [...frames, ...frames.slice(1, -1).reverse()];
}

/** Play faster (factor above 1) or slower (below 1). Delays are kept at 20 ms or more. */
export function changeSpeed(frames: GifFrame[], factor: number): GifFrame[] {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new Error("The speed must be a number above 0.");
  return frames.map((f) => ({ ...f, delayMs: Math.max(GIF_LIMITS.minDelayMs, Math.round(f.delayMs / factor)) }));
}

/** Give every frame the same delay. */
export function setDelay(frames: GifFrame[], delayMs: number): GifFrame[] {
  if (!(delayMs >= GIF_LIMITS.minDelayMs)) throw new Error(`The delay must be at least ${GIF_LIMITS.minDelayMs} milliseconds. Browsers cannot show frames faster than that.`);
  return frames.map((f) => ({ ...f, delayMs: Math.round(delayMs) }));
}

/** Keep one frame in every `n`, adding the delays of the dropped ones to the kept frame so the timing stays the same. */
export function dropFrames(frames: GifFrame[], n: number): GifFrame[] {
  if (!Number.isInteger(n) || n < 2) throw new Error("Keep one frame in every 2 or more.");
  const out: GifFrame[] = [];
  for (let i = 0; i < frames.length; i += n) {
    const group = frames.slice(i, i + n);
    out.push({ rgba: (group[0] as GifFrame).rgba, delayMs: group.reduce((t, f) => t + f.delayMs, 0) });
  }
  return out;
}

/** Frames `from` to `to`, counting from 1 and including both ends. */
export function trimFrames(frames: GifFrame[], from: number, to: number): GifFrame[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > frames.length || from > to) throw new Error(`Choose frames from 1 to ${frames.length}, with the first number not above the second.`);
  return frames.slice(from - 1, to);
}

/** Total playing time of one loop. */
export const totalDuration = (frames: GifFrame[]) => frames.reduce((t, f) => t + f.delayMs, 0);

/**
 * Resize one RGBA picture. Shrinking averages the pixels each new pixel covers (so thin lines do not vanish); enlarging
 * is smooth (bilinear). Colour is weighted by transparency so see-through edges do not pick up a dark fringe.
 */
export function resizeRgba(src: Uint8ClampedArray, width: number, height: number, newWidth: number, newHeight: number): Uint8ClampedArray {
  if (newWidth === width && newHeight === height) return src.slice();
  const out = new Uint8ClampedArray(newWidth * newHeight * 4);
  const sx = width / newWidth;
  const sy = height / newHeight;
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weight = 0;
      if (sx > 1 || sy > 1) {
        // Average every source pixel the new pixel covers, with partial pixels at the edges.
        const x0 = x * sx;
        const x1 = (x + 1) * sx;
        const y0 = y * sy;
        const y1 = (y + 1) * sy;
        for (let py = Math.floor(y0); py < Math.min(height, Math.ceil(y1)); py++) {
          const wy = Math.min(y1, py + 1) - Math.max(y0, py);
          for (let px = Math.floor(x0); px < Math.min(width, Math.ceil(x1)); px++) {
            const w = (Math.min(x1, px + 1) - Math.max(x0, px)) * wy;
            const i = (py * width + px) * 4;
            const pa = (src[i + 3] as number) / 255;
            r += (src[i] as number) * pa * w;
            g += (src[i + 1] as number) * pa * w;
            b += (src[i + 2] as number) * pa * w;
            a += pa * w;
            weight += w;
          }
        }
      } else {
        const fx = Math.max(0, Math.min(width - 1, (x + 0.5) * sx - 0.5));
        const fy = Math.max(0, Math.min(height - 1, (y + 0.5) * sy - 0.5));
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(width - 1, x0 + 1);
        const y1 = Math.min(height - 1, y0 + 1);
        const tx = fx - x0;
        const ty = fy - y0;
        for (const [px, py, w] of [
          [x0, y0, (1 - tx) * (1 - ty)],
          [x1, y0, tx * (1 - ty)],
          [x0, y1, (1 - tx) * ty],
          [x1, y1, tx * ty],
        ] as [number, number, number][]) {
          const i = (py * width + px) * 4;
          const pa = (src[i + 3] as number) / 255;
          r += (src[i] as number) * pa * w;
          g += (src[i + 1] as number) * pa * w;
          b += (src[i + 2] as number) * pa * w;
          a += pa * w;
          weight += w;
        }
      }
      const o = (y * newWidth + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = weight > 0 ? (a / weight) * 255 : 0;
    }
  }
  return out;
}

/** Resize every frame. */
export function resizeGif(image: GifImage, newWidth: number, newHeight: number): GifImage {
  if (!Number.isInteger(newWidth) || !Number.isInteger(newHeight) || newWidth < 1 || newHeight < 1) throw new Error("The new size must be whole numbers of 1 pixel or more.");
  const problem = checkGifBudget(newWidth, newHeight, image.frames.length);
  if (problem) throw new Error(problem);
  return { ...image, width: newWidth, height: newHeight, frames: image.frames.map((f) => ({ ...f, rgba: resizeRgba(f.rgba, image.width, image.height, newWidth, newHeight) })) };
}

/** The new height when the width changes, keeping the shape. */
export const heightForWidth = (width: number, height: number, newWidth: number) => Math.max(1, Math.round((height * newWidth) / width));

/** Turn every frame by 90, 180 or 270 degrees clockwise. */
export function rotateGif(image: GifImage, degrees: 90 | 180 | 270): GifImage {
  const { width, height } = image;
  const swap = degrees !== 180;
  const nw = swap ? height : width;
  const nh = swap ? width : height;
  const frames = image.frames.map((f) => {
    const out = new Uint8ClampedArray(f.rgba.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [nx, ny] = degrees === 90 ? [height - 1 - y, x] : degrees === 180 ? [width - 1 - x, height - 1 - y] : [y, width - 1 - x];
        out.set(f.rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (ny * nw + nx) * 4);
      }
    }
    return { ...f, rgba: out };
  });
  return { ...image, width: nw, height: nh, frames };
}

/** Mirror every frame left to right ("horizontal") or top to bottom ("vertical"). */
export function flipGif(image: GifImage, direction: "horizontal" | "vertical"): GifImage {
  const { width, height } = image;
  const frames = image.frames.map((f) => {
    const out = new Uint8ClampedArray(f.rgba.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = direction === "horizontal" ? width - 1 - x : x;
        const ny = direction === "vertical" ? height - 1 - y : y;
        out.set(f.rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (ny * width + nx) * 4);
      }
    }
    return { ...f, rgba: out };
  });
  return { ...image, frames };
}

/** Put a picture of any size on a canvas of the given size, scaled to fit (or fill) and centred, over a background. */
export function fitRgba(src: Uint8ClampedArray, width: number, height: number, newWidth: number, newHeight: number, mode: "contain" | "cover" | "stretch", background: [number, number, number, number]): Uint8ClampedArray {
  if (mode === "stretch") return resizeRgba(src, width, height, newWidth, newHeight);
  const scale = mode === "contain" ? Math.min(newWidth / width, newHeight / height) : Math.max(newWidth / width, newHeight / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const scaled = resizeRgba(src, width, height, w, h);
  const out = new Uint8ClampedArray(newWidth * newHeight * 4);
  for (let i = 0; i < out.length; i += 4) out.set(background, i);
  const ox = Math.round((newWidth - w) / 2);
  const oy = Math.round((newHeight - h) / 2);
  for (let y = 0; y < h; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= newHeight) continue;
    for (let x = 0; x < w; x++) {
      const tx = x + ox;
      if (tx < 0 || tx >= newWidth) continue;
      const s = (y * w + x) * 4;
      const a = (scaled[s + 3] as number) / 255;
      const o = (ty * newWidth + tx) * 4;
      // Draw over the background, blending by transparency.
      const ba = (out[o + 3] as number) / 255;
      const outA = a + ba * (1 - a);
      for (let c = 0; c < 3; c++) out[o + c] = outA > 0 ? ((scaled[s + c] as number) * a + (out[o + c] as number) * ba * (1 - a)) / outA : 0;
      out[o + 3] = outA * 255;
    }
  }
  return out;
}

/** Number of distinct colours (ignoring transparent pixels) in a frame, up to a limit. Useful for deciding how far to reduce. */
export function countColors(rgba: Uint8ClampedArray, limit = 257): number {
  const seen = new Set<number>();
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] as number) < ALPHA_CUT) continue;
    seen.add(((rgba[i] as number) << 16) | ((rgba[i + 1] as number) << 8) | (rgba[i + 2] as number));
    if (seen.size >= limit) break;
  }
  return seen.size;
}
