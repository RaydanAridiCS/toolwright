/**
 * Geometry for the Crop, Rotate & Flip tool. Everything here works on numbers; the browser draws the pixels.
 *
 * The model: the picture is first turned (flipped, rotated in quarter turns, then straightened by a small angle) into
 * a "turned picture". The crop box lives in the pixel space of that turned picture, which is also what the person
 * sees on screen. Keep this file free of React, the DOM and the network.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Turn {
  /** Quarter turns clockwise, 0 to 3. */
  quarters: 0 | 1 | 2 | 3;
  flipH: boolean;
  flipV: boolean;
  /** Extra turn in degrees (clockwise) for straightening a crooked photo, -45 to 45. */
  angle: number;
}

export const NO_TURN: Turn = { quarters: 0, flipH: false, flipV: false, angle: 0 };

export const ANGLE_RANGE = { min: -45, max: 45 } as const;

export const CROP_LIMITS = {
  /** Browsers refuse canvases wider or taller than this (Chrome and Firefox: 32,767; Safari less). */
  maxSide: 16_384,
  /** Above this many pixels some phones cannot draw (iOS Safari's canvas ceiling is about 16.7 million). */
  warnPixels: 16_000_000,
  /** The tool refuses pictures or results larger than this. */
  maxPixels: 100_000_000,
  minBox: 1,
} as const;

export class CropError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CropError";
  }
}

const finite = (n: number) => typeof n === "number" && Number.isFinite(n);

/* ----------------------------------------------------------------------------------------------- */
/* Aspect ratios                                                                                    */
/* ----------------------------------------------------------------------------------------------- */

export type AspectId = "free" | "original" | "1:1" | "4:3" | "3:2" | "16:9" | "3:4" | "2:3" | "9:16" | "custom";

export const ASPECTS: { id: AspectId; label: string }[] = [
  { id: "free", label: "Free" },
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "3:2", label: "3:2" },
  { id: "16:9", label: "16:9" },
  { id: "3:4", label: "3:4" },
  { id: "2:3", label: "2:3" },
  { id: "9:16", label: "9:16" },
  { id: "custom", label: "Custom" },
];

/**
 * Reads "16:10", "16/10", "16x10" or a plain ratio such as "1.6" and returns width ÷ height.
 * Returns `null` when the text is not a usable ratio (zero, negative, absurd or not a number).
 */
export function parseAspect(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const pair = /^(\d+(?:\.\d+)?)\s*[:/xX]\s*(\d+(?:\.\d+)?)$/.exec(t);
  let ratio: number;
  if (pair) ratio = Number(pair[1]) / Number(pair[2]);
  else if (/^\d+(?:\.\d+)?$/.test(t)) ratio = Number(t);
  else return null;
  if (!finite(ratio) || ratio <= 0 || ratio > 100 || ratio < 0.01) return null;
  return ratio;
}

/** Width ÷ height for a preset, or `null` for Free (and for Custom text that does not parse). */
export function aspectRatio(id: AspectId, size: Size, custom = ""): number | null {
  switch (id) {
    case "free":
      return null;
    case "original":
      return size.width > 0 && size.height > 0 ? size.width / size.height : null;
    case "custom":
      return parseAspect(custom);
    default: {
      const [w, h] = id.split(":").map(Number) as [number, number];
      return w / h;
    }
  }
}

/* ----------------------------------------------------------------------------------------------- */
/* Boxes                                                                                            */
/* ----------------------------------------------------------------------------------------------- */

export const fullRect = (size: Size): Rect => ({ x: 0, y: 0, width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) });

/**
 * Forces a box to whole pixels inside the picture. Anything that is not a number falls back to the whole picture,
 * a box that is too small grows to one pixel, and a box that hangs over an edge is pulled back inside.
 */
export function clampRect(rect: Rect, bounds: Size): Rect {
  const bw = Math.max(1, Math.round(bounds.width));
  const bh = Math.max(1, Math.round(bounds.height));
  if (![rect.x, rect.y, rect.width, rect.height].every(finite)) return fullRect({ width: bw, height: bh });
  const width = Math.min(bw, Math.max(CROP_LIMITS.minBox, Math.round(rect.width)));
  const height = Math.min(bh, Math.max(CROP_LIMITS.minBox, Math.round(rect.height)));
  const x = Math.min(bw - width, Math.max(0, Math.round(rect.x)));
  const y = Math.min(bh - height, Math.max(0, Math.round(rect.y)));
  return { x, y, width, height };
}

/** The largest box with this shape that fits inside the picture, kept around the middle of `around` when given. */
export function rectForAspect(bounds: Size, ratio: number | null, around?: Rect): Rect {
  const bw = Math.max(1, Math.round(bounds.width));
  const bh = Math.max(1, Math.round(bounds.height));
  if (ratio === null || !finite(ratio) || ratio <= 0) return around ? clampRect(around, bounds) : fullRect(bounds);
  let width = bw;
  let height = Math.round(width / ratio);
  if (height > bh) {
    height = bh;
    width = Math.round(height * ratio);
  }
  width = Math.min(bw, Math.max(1, width));
  height = Math.min(bh, Math.max(1, height));
  const cx = around ? around.x + around.width / 2 : bw / 2;
  const cy = around ? around.y + around.height / 2 : bh / 2;
  return clampRect({ x: cx - width / 2, y: cy - height / 2, width, height }, bounds);
}

export function moveRect(rect: Rect, dx: number, dy: number, bounds: Size): Rect {
  if (!finite(dx) || !finite(dy)) return clampRect(rect, bounds);
  return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, bounds);
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Drags one handle of the box by (dx, dy), in picture pixels. The box stays inside the picture, never gets smaller
 * than `minSize`, and, when `ratio` is set, keeps its shape (corner handles keep the opposite corner still; side
 * handles keep the middle of the opposite side still).
 */
export function resizeRect(rect: Rect, handle: Handle, dx: number, dy: number, bounds: Size, ratio: number | null = null, minSize = 8): Rect {
  const start = clampRect(rect, bounds);
  if (!finite(dx) || !finite(dy)) return start;
  const bw = Math.max(1, Math.round(bounds.width));
  const bh = Math.max(1, Math.round(bounds.height));
  const min = Math.max(1, Math.min(Math.round(minSize), bw, bh));
  const hasW = handle.includes("w");
  const hasE = handle.includes("e");
  const hasN = handle.includes("n");
  const hasS = handle.includes("s");

  let left = start.x + (hasW ? dx : 0);
  let right = start.x + start.width + (hasE ? dx : 0);
  let top = start.y + (hasN ? dy : 0);
  let bottom = start.y + start.height + (hasS ? dy : 0);

  if (ratio === null || !finite(ratio) || ratio <= 0) {
    left = Math.max(0, Math.min(left, start.x + start.width - min));
    right = Math.min(bw, Math.max(right, start.x + min));
    top = Math.max(0, Math.min(top, start.y + start.height - min));
    bottom = Math.min(bh, Math.max(bottom, start.y + min));
    // Handles that do not move an edge must not move it here either.
    if (!hasW && !hasE) {
      left = start.x;
      right = start.x + start.width;
    }
    if (!hasN && !hasS) {
      top = start.y;
      bottom = start.y + start.height;
    }
    return clampRect({ x: left, y: top, width: right - left, height: bottom - top }, bounds);
  }

  // Fixed shape: the anchor is the opposite corner (or the middle of the opposite side).
  const corner = (hasW || hasE) && (hasN || hasS);
  const anchorX = hasW ? start.x + start.width : hasE ? start.x : start.x + start.width / 2;
  const anchorY = hasN ? start.y + start.height : hasS ? start.y : start.y + start.height / 2;
  const dirX = hasW ? -1 : hasE ? 1 : 0;
  const dirY = hasN ? -1 : hasS ? 1 : 0;

  // How much room there is from the anchor in the drag direction.
  const roomX = dirX === 0 ? Math.min(anchorX, bw - anchorX) * 2 : dirX < 0 ? anchorX : bw - anchorX;
  const roomY = dirY === 0 ? Math.min(anchorY, bh - anchorY) * 2 : dirY < 0 ? anchorY : bh - anchorY;

  let width: number;
  let height: number;
  if (corner) {
    const wantW = start.width + dirX * dx;
    const wantH = start.height + dirY * dy;
    // Follow whichever axis the pointer moved further in relative terms.
    const byW = wantW / start.width;
    const byH = wantH / start.height;
    width = byW >= byH ? wantW : wantH * ratio;
    height = width / ratio;
  } else if (dirX !== 0) {
    width = start.width + dirX * dx;
    height = width / ratio;
  } else {
    height = start.height + dirY * dy;
    width = height * ratio;
  }

  const minW = Math.max(min, min * ratio);
  const minH = minW / ratio;
  const maxW = Math.min(roomX, roomY * ratio);
  width = Math.max(Math.min(minW, maxW), Math.min(width, maxW));
  height = width / ratio;
  if (height < minH && maxW >= minW) {
    height = minH;
    width = height * ratio;
  }

  // Whole pixels first, so the anchor stays exactly where it was instead of drifting by a rounding step.
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const nx = dirX < 0 ? anchorX - width : dirX > 0 ? anchorX : anchorX - width / 2;
  const ny = dirY < 0 ? anchorY - height : dirY > 0 ? anchorY : anchorY - height / 2;
  return clampRect({ x: nx, y: ny, width, height }, bounds);
}

/* ----------------------------------------------------------------------------------------------- */
/* Turning                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

export function normalizeTurn(turn: Partial<Turn> = {}): Turn {
  const q = Number.isFinite(turn.quarters) ? ((Math.round(turn.quarters as number) % 4) + 4) % 4 : 0;
  const angle = finite(turn.angle as number) ? Math.min(ANGLE_RANGE.max, Math.max(ANGLE_RANGE.min, turn.angle as number)) : 0;
  return { quarters: q as Turn["quarters"], flipH: Boolean(turn.flipH), flipV: Boolean(turn.flipV), angle };
}

export const isNoTurn = (turn: Turn) => turn.quarters === 0 && !turn.flipH && !turn.flipV && turn.angle === 0;

/** Clockwise degrees applied in total. */
function totalDegrees(turn: Turn): number {
  return turn.quarters * 90 + turn.angle;
}

/** Size of the turned picture: a straightened picture grows to the box that holds the tilted original. */
export function turnedSize(size: Size, turnInput: Partial<Turn>): Size {
  const turn = normalizeTurn(turnInput);
  const w = Math.max(1, size.width);
  const h = Math.max(1, size.height);
  const swapped = turn.quarters % 2 === 1;
  const sw = swapped ? h : w;
  const sh = swapped ? w : h;
  if (turn.angle === 0) return { width: Math.round(sw), height: Math.round(sh) };
  const rad = (Math.abs(turn.angle) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Round away tiny floating-point noise before taking the ceiling, so 100 does not become 101.
  const snap = (n: number) => Math.ceil(Math.round(n * 1e6) / 1e6);
  return { width: snap(sw * cos + sh * sin), height: snap(sw * sin + sh * cos) };
}

export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/**
 * The canvas transform (a, b, c, d, e, f, as in `ctx.setTransform`) that draws the original picture, at its own
 * size, into the turned picture. Order: flip across the original's own axes, then turn clockwise, then centre.
 */
export function turnMatrix(size: Size, turnInput: Partial<Turn>): Matrix {
  const turn = normalizeTurn(turnInput);
  const out = turnedSize(size, turn);
  const rad = (totalDegrees(turn) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Quarter turns are exact, not "almost 0": avoid sin(π) ≈ 1.2e-16 leaking into the matrix.
  const exact = (n: number) => (Math.abs(n) < 1e-12 ? 0 : Math.abs(n - 1) < 1e-12 ? 1 : Math.abs(n + 1) < 1e-12 ? -1 : n);
  const move: Matrix = [1, 0, 0, 1, out.width / 2, out.height / 2];
  const rotate: Matrix = [exact(cos), exact(sin), exact(-sin), exact(cos), 0, 0];
  const flip: Matrix = [turn.flipH ? -1 : 1, 0, 0, turn.flipV ? -1 : 1, 0, 0];
  const centre: Matrix = [1, 0, 0, 1, -size.width / 2, -size.height / 2];
  return multiply(multiply(multiply(move, rotate), flip), centre);
}

/** Where a point of the original picture lands in the turned picture. */
export function mapPoint(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** The same matrix after cutting the box `crop` out of the turned picture and scaling by `scale`. */
export function cropMatrix(m: Matrix, crop: Rect, scale = 1): Matrix {
  return multiply([scale, 0, 0, scale, -crop.x * scale, -crop.y * scale], m);
}

/**
 * The biggest upright box that fits inside the original once it has been tilted by `angle` degrees, as `{width, height}`
 * for a picture of this size. Used for "remove the empty corners" after straightening.
 */
export function insideTilted(size: Size, angle: number): Size {
  const w = Math.max(1, size.width);
  const h = Math.max(1, size.height);
  if (!finite(angle) || Math.abs(angle) < 1e-9) return { width: w, height: h };
  const rad = (Math.min(Math.abs(angle), 90) * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const widthIsLonger = w >= h;
  const longSide = widthIsLonger ? w : h;
  const shortSide = widthIsLonger ? h : w;
  if (shortSide <= 2 * sin * cos * longSide || Math.abs(sin - cos) < 1e-10) {
    // The tilted picture is narrow enough that the best box touches only two of its sides.
    const x = 0.5 * shortSide;
    return widthIsLonger ? { width: x / sin, height: x / cos } : { width: x / cos, height: x / sin };
  }
  const cos2 = cos * cos - sin * sin;
  return { width: (w * cos - h * sin) / cos2, height: (h * cos - w * sin) / cos2 };
}

/** A centred box inside the turned picture that contains no empty corner, for the current straighten angle. */
export function rectWithoutCorners(size: Size, turnInput: Partial<Turn>): Rect {
  const turn = normalizeTurn(turnInput);
  const turned = turnedSize(size, turn);
  if (turn.angle === 0) return fullRect(turned);
  const swapped = turn.quarters % 2 === 1;
  const source = swapped ? { width: size.height, height: size.width } : size;
  const inner = insideTilted(source, turn.angle);
  const width = Math.max(1, Math.floor(inner.width - 1e-6));
  const height = Math.max(1, Math.floor(inner.height - 1e-6));
  return clampRect({ x: (turned.width - width) / 2, y: (turned.height - height) / 2, width, height }, turned);
}

/* ----------------------------------------------------------------------------------------------- */
/* Limits                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export interface SizeCheck {
  refuse?: string;
  warn?: string;
}

/** Checks a picture or result size against what browsers can draw. */
export function checkSize(size: Size, what: "picture" | "result" = "picture"): SizeCheck {
  const { width, height } = size;
  if (!(finite(width) && finite(height) && width >= 1 && height >= 1)) return { refuse: `The ${what} has no size.` };
  if (width > CROP_LIMITS.maxSide || height > CROP_LIMITS.maxSide) {
    return { refuse: `The ${what} is ${Math.round(width)} × ${Math.round(height)} pixels. Browsers cannot draw more than ${CROP_LIMITS.maxSide.toLocaleString("en-US")} pixels on one side.` };
  }
  const pixels = width * height;
  if (pixels > CROP_LIMITS.maxPixels) {
    return { refuse: `The ${what} has ${(pixels / 1e6).toFixed(0)} million pixels. The limit here is ${CROP_LIMITS.maxPixels / 1e6} million, so a normal browser tab does not run out of memory.` };
  }
  if (pixels > CROP_LIMITS.warnPixels) return { warn: `This ${what} has ${(pixels / 1e6).toFixed(0)} million pixels. Some phones cannot save pictures this large.` };
  return {};
}

/** Whole-pixel size of a crop after clamping, as text such as "1200 × 800". */
export function describeSize(size: Size): string {
  return `${Math.round(size.width)} × ${Math.round(size.height)}`;
}
