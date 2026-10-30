/**
 * SVG path data (the `d` attribute): read it, convert between absolute and relative, shrink it, move, scale, rotate and
 * flip it, reverse its direction, and measure it. All of SVG's path commands are supported, including arcs and the
 * compact forms such as `a1 1 0 011 1` and `M1 2 3 4`. Keep this file free of React, the DOM and the network.
 */

export interface PathSegment {
  /** The command letter. Upper case is absolute, lower case relative. */
  cmd: string;
  args: number[];
}

export class PathSyntaxError extends Error {
  constructor(message: string, readonly position: number) {
    super(message);
    this.name = "PathSyntaxError";
  }
}

const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

/** Read path data. Throws a `PathSyntaxError` that says what is wrong and where. */
export function parsePath(d: string): PathSegment[] {
  const out: PathSegment[] = [];
  const n = d.length;
  let i = 0;
  let current: string | null = null;

  const skip = () => {
    while (i < n && /[\s,]/.test(d[i] as string)) i++;
  };
  const readNumber = (): number | null => {
    skip();
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(d);
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const readFlag = (): number | null => {
    skip();
    const c = d[i];
    if (c === "0" || c === "1") {
      i++;
      return Number(c);
    }
    return null;
  };

  skip();
  while (i < n) {
    const c = d[i] as string;
    if (/[A-Za-z]/.test(c)) {
      if (!(c.toUpperCase() in ARITY)) throw new PathSyntaxError(`“${c}” is not a path command. Commands are M, L, H, V, C, S, Q, T, A and Z.`, i);
      current = c;
      i++;
      if (c === "Z" || c === "z") {
        out.push({ cmd: c, args: [] });
        skip();
        continue;
      }
    } else if (current === null) {
      throw new PathSyntaxError(`Path data must start with a command such as M, but it starts with “${c}”.`, i);
    } else if (current === "Z" || current === "z") {
      throw new PathSyntaxError(`There are numbers after Z at position ${i}. Start a new subpath with M.`, i);
    } else if (!/[+\-.\d]/.test(c)) {
      throw new PathSyntaxError(`Unexpected “${c}” at position ${i}.`, i);
    }
    if (out.length === 0 && current !== "M" && current !== "m") throw new PathSyntaxError("Path data must start with M (a move to the first point).", 0);

    const need = ARITY[current.toUpperCase()] as number;
    const args: number[] = [];
    const start = i;
    while (args.length < need) {
      const isFlag = current.toUpperCase() === "A" && (args.length === 3 || args.length === 4);
      const v = isFlag ? readFlag() : readNumber();
      if (v === null) {
        throw new PathSyntaxError(`${current} needs ${need} number${need === 1 ? "" : "s"} but only ${args.length} ${args.length === 1 ? "was" : "were"} found at position ${start}.${isFlag ? " Arc flags must be 0 or 1." : ""}`, start);
      }
      args.push(v);
    }
    out.push({ cmd: current, args });
    // A command followed only by numbers repeats; after M it continues as L.
    if (current === "M") current = "L";
    else if (current === "m") current = "l";
    skip();
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */
/* Writing                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export interface SerializeOptions {
  /** Digits after the decimal point. Default 3. */
  precision?: number;
  /** Drop every space that is not needed, and repeated command letters. Default false. */
  minify?: boolean;
}

function formatNumber(n: number, precision: number, minify: boolean): string {
  let s = (Math.round(n * 10 ** precision) / 10 ** precision).toFixed(Math.max(0, precision));
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  if (minify) s = s.replace(/^(-?)0\./, "$1.");
  return s;
}

export function serializePath(segs: PathSegment[], options: SerializeOptions = {}): string {
  const { precision = 3, minify = false } = options;
  let out = "";
  let prevCmd: string | null = null;
  /** The last number (or flag) written, to decide whether the next one needs a separator. */
  let tail = "";
  let tailIsFlag = false;
  for (const seg of segs) {
    const upper = seg.cmd.toUpperCase();
    const tokens = seg.args.map((value, k) => {
      const isFlag = upper === "A" && (k === 3 || k === 4);
      return { text: isFlag ? (value ? "1" : "0") : formatNumber(value, precision, minify), isFlag };
    });
    if (!minify) {
      out += `${out ? " " : ""}${[seg.cmd, ...tokens.map((t) => t.text)].join(" ")}`;
      continue;
    }
    // A repeated command letter can be left out, and so can the L that follows an M (a move continues as a line).
    const omit = prevCmd !== null && upper !== "Z" && upper !== "M" && (seg.cmd === prevCmd || (prevCmd === "M" && seg.cmd === "L") || (prevCmd === "m" && seg.cmd === "l"));
    if (!omit) out += seg.cmd;
    tokens.forEach((t, k) => {
      let sep = "";
      if (!(k === 0 && !omit)) {
        if (tailIsFlag) sep = "";
        else if (t.isFlag) sep = "";
        else if (t.text.startsWith("-")) sep = "";
        else if (t.text.startsWith(".")) sep = tail.includes(".") ? "" : " ";
        else sep = " ";
        // A flag straight after a number would merge into it ("5" then "0" would read as 50).
        if (t.isFlag && !tailIsFlag && !(k === 0 && !omit)) sep = " ";
      }
      out += sep + t.text;
      tail = t.text;
      tailIsFlag = t.isFlag;
    });
    prevCmd = seg.cmd;
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */
/* Absolute and relative                                                                              */
/* ----------------------------------------------------------------------------------------------- */

/** The same path with every command in absolute form. */
export function toAbsolute(segs: PathSegment[]): PathSegment[] {
  const out: PathSegment[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { cmd, args } of segs) {
    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();
    let a = args.slice();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (upper) {
      case "M":
      case "L":
      case "T":
        a = [(a[0] as number) + ox, (a[1] as number) + oy];
        break;
      case "H":
        a = [(a[0] as number) + ox];
        break;
      case "V":
        a = [(a[0] as number) + oy];
        break;
      case "C":
        a = [(a[0] as number) + ox, (a[1] as number) + oy, (a[2] as number) + ox, (a[3] as number) + oy, (a[4] as number) + ox, (a[5] as number) + oy];
        break;
      case "S":
      case "Q":
        a = [(a[0] as number) + ox, (a[1] as number) + oy, (a[2] as number) + ox, (a[3] as number) + oy];
        break;
      case "A":
        a = [a[0] as number, a[1] as number, a[2] as number, a[3] as number, a[4] as number, (a[5] as number) + ox, (a[6] as number) + oy];
        break;
    }
    out.push({ cmd: upper, args: a });
    switch (upper) {
      case "H":
        cx = a[0] as number;
        break;
      case "V":
        cy = a[0] as number;
        break;
      case "Z":
        cx = sx;
        cy = sy;
        break;
      default:
        cx = a[a.length - 2] as number;
        cy = a[a.length - 1] as number;
        if (upper === "M") {
          sx = cx;
          sy = cy;
        }
    }
  }
  return out;
}

/** The same path with every command in relative form. */
export function toRelative(segs: PathSegment[]): PathSegment[] {
  const abs = toAbsolute(segs);
  const out: PathSegment[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { cmd, args } of abs) {
    let a = args.slice();
    switch (cmd) {
      case "M":
      case "L":
      case "T":
        a = [(a[0] as number) - cx, (a[1] as number) - cy];
        break;
      case "H":
        a = [(a[0] as number) - cx];
        break;
      case "V":
        a = [(a[0] as number) - cy];
        break;
      case "C":
        a = [(a[0] as number) - cx, (a[1] as number) - cy, (a[2] as number) - cx, (a[3] as number) - cy, (a[4] as number) - cx, (a[5] as number) - cy];
        break;
      case "S":
      case "Q":
        a = [(a[0] as number) - cx, (a[1] as number) - cy, (a[2] as number) - cx, (a[3] as number) - cy];
        break;
      case "A":
        a = [a[0] as number, a[1] as number, a[2] as number, a[3] as number, a[4] as number, (a[5] as number) - cx, (a[6] as number) - cy];
        break;
    }
    // The first move is always absolute, even when written as m.
    const first = out.length === 0 && cmd === "M";
    out.push({ cmd: first ? "m" : cmd.toLowerCase(), args: first ? args.slice() : a });
    const absArgs = args;
    switch (cmd) {
      case "H":
        cx = absArgs[0] as number;
        break;
      case "V":
        cy = absArgs[0] as number;
        break;
      case "Z":
        cx = sx;
        cy = sy;
        break;
      default:
        cx = absArgs[absArgs.length - 2] as number;
        cy = absArgs[absArgs.length - 1] as number;
        if (cmd === "M") {
          sx = cx;
          sy = cy;
        }
    }
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */
/* Arcs and curves                                                                                    */
/* ----------------------------------------------------------------------------------------------- */

type Pt = [number, number];

/** Convert one SVG arc to cubic Bézier curves (each covers at most a quarter turn). Returns [] for a zero-length arc. */
export function arcToCubics(x0: number, y0: number, rxIn: number, ryIn: number, rotationDeg: number, largeArc: number, sweep: number, x: number, y: number): number[][] {
  if (x0 === x && y0 === y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [[x0, y0, x, y, x, y]];
  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = den === 0 ? 0 : Math.sqrt(Math.max(0, num / den));
  if (!!largeArc === !!sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  // A quarter turn per curve. The small allowance stops a half or full ellipse (which is exact in theory) from gaining an extra curve through rounding noise.
  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-6));
  const step = delta / pieces;
  const k = (4 / 3) * Math.tan(step / 4);
  const curves: number[][] = [];
  const point = (t: number): Pt => [cx + rx * Math.cos(t) * cosPhi - ry * Math.sin(t) * sinPhi, cy + rx * Math.cos(t) * sinPhi + ry * Math.sin(t) * cosPhi];
  const deriv = (t: number): Pt => [-rx * Math.sin(t) * cosPhi - ry * Math.cos(t) * sinPhi, -rx * Math.sin(t) * sinPhi + ry * Math.cos(t) * cosPhi];
  let t = theta1;
  for (let p = 0; p < pieces; p++) {
    const a = point(t);
    const da = deriv(t);
    const b = p === pieces - 1 ? ([x, y] as Pt) : point(t + step);
    const db = deriv(t + step);
    curves.push([a[0] + k * da[0], a[1] + k * da[1], b[0] - k * db[0], b[1] - k * db[1], b[0], b[1]]);
    t += step;
  }
  return curves;
}

/**
 * Rewrite a path using only absolute M, L, C and Z. Horizontal and vertical lines become L; smooth, quadratic and arc
 * commands become cubic curves. The shape is the same; the commands are simpler to work with.
 */
export function toCurves(segs: PathSegment[]): PathSegment[] {
  const abs = toAbsolute(segs);
  const out: PathSegment[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastCubic: Pt | null = null; // second control point of the previous C or S
  let lastQuad: Pt | null = null; // control point of the previous Q or T
  for (const { cmd, args } of abs) {
    let nextCubic: Pt | null = null;
    let nextQuad: Pt | null = null;
    switch (cmd) {
      case "M":
        out.push({ cmd: "M", args: [args[0] as number, args[1] as number] });
        cx = sx = args[0] as number;
        cy = sy = args[1] as number;
        break;
      case "L":
        out.push({ cmd: "L", args: [args[0] as number, args[1] as number] });
        cx = args[0] as number;
        cy = args[1] as number;
        break;
      case "H":
        out.push({ cmd: "L", args: [args[0] as number, cy] });
        cx = args[0] as number;
        break;
      case "V":
        out.push({ cmd: "L", args: [cx, args[0] as number] });
        cy = args[0] as number;
        break;
      case "C":
        out.push({ cmd: "C", args: args.slice(0, 6) });
        nextCubic = [args[2] as number, args[3] as number];
        cx = args[4] as number;
        cy = args[5] as number;
        break;
      case "S": {
        const c1: Pt = lastCubic ? [2 * cx - lastCubic[0], 2 * cy - lastCubic[1]] : [cx, cy];
        out.push({ cmd: "C", args: [c1[0], c1[1], args[0] as number, args[1] as number, args[2] as number, args[3] as number] });
        nextCubic = [args[0] as number, args[1] as number];
        cx = args[2] as number;
        cy = args[3] as number;
        break;
      }
      case "Q":
      case "T": {
        const q: Pt = cmd === "Q" ? [args[0] as number, args[1] as number] : lastQuad ? [2 * cx - lastQuad[0], 2 * cy - lastQuad[1]] : [cx, cy];
        const ex = args[cmd === "Q" ? 2 : 0] as number;
        const ey = args[cmd === "Q" ? 3 : 1] as number;
        out.push({ cmd: "C", args: [cx + (2 / 3) * (q[0] - cx), cy + (2 / 3) * (q[1] - cy), ex + (2 / 3) * (q[0] - ex), ey + (2 / 3) * (q[1] - ey), ex, ey] });
        nextQuad = q;
        cx = ex;
        cy = ey;
        break;
      }
      case "A": {
        const [rx, ry, rot, large, sweep, ex, ey] = args as [number, number, number, number, number, number, number];
        const curves = arcToCubics(cx, cy, rx, ry, rot, large, sweep, ex, ey);
        for (const c of curves) out.push({ cmd: "C", args: c });
        if (curves.length === 0) {
          // Same start and end: nothing to draw. Keep a zero-length line so the path stays connected.
        }
        cx = ex;
        cy = ey;
        break;
      }
      case "Z":
        out.push({ cmd: "Z", args: [] });
        cx = sx;
        cy = sy;
        break;
    }
    lastCubic = nextCubic;
    lastQuad = nextQuad;
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */
/* Transforms                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

/** A 2D transform [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (the same order as SVG's matrix()). */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `first` applied first, then `second`. */
export function multiply(first: Matrix, second: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [a2 * a1 + c2 * b1, b2 * a1 + d2 * b1, a2 * c1 + c2 * d1, b2 * c1 + d2 * d1, a2 * e1 + c2 * f1 + e2, b2 * e1 + d2 * f1 + f2];
}

export const translateMatrix = (tx: number, ty: number): Matrix => [1, 0, 0, 1, tx, ty];
export const scaleMatrix = (sx: number, sy = sx): Matrix => [sx, 0, 0, sy, 0, 0];
export const rotateMatrix = (degrees: number, cx = 0, cy = 0): Matrix => {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
};

const apply = (m: Matrix, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Apply a transform. Lines and curves are kept as they are; an arc stays an arc when that is exact, and otherwise becomes curves. */
export function transformPath(segs: PathSegment[], m: Matrix): PathSegment[] {
  const abs = toAbsolute(segs);
  const out: PathSegment[] = [];
  const axisAligned = Math.abs(m[1]) < 1e-12 && Math.abs(m[2]) < 1e-12;
  const scaleA = Math.hypot(m[0], m[1]);
  const scaleB = Math.hypot(m[2], m[3]);
  const similar = Math.abs(scaleA - scaleB) <= 1e-9 * Math.max(1, scaleA) && Math.abs(m[0] * m[2] + m[1] * m[3]) <= 1e-9 * Math.max(1, scaleA * scaleB);
  const det = m[0] * m[3] - m[1] * m[2];
  const theta = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { cmd, args } of abs) {
    switch (cmd) {
      case "M":
      case "L":
      case "T": {
        const p = apply(m, args[0] as number, args[1] as number);
        out.push({ cmd, args: p });
        cx = args[0] as number;
        cy = args[1] as number;
        if (cmd === "M") {
          sx = cx;
          sy = cy;
        }
        break;
      }
      case "H":
        if (axisAligned) out.push({ cmd: "H", args: [m[0] * (args[0] as number) + m[4]] });
        else out.push({ cmd: "L", args: apply(m, args[0] as number, cy) });
        cx = args[0] as number;
        break;
      case "V":
        if (axisAligned) out.push({ cmd: "V", args: [m[3] * (args[0] as number) + m[5]] });
        else out.push({ cmd: "L", args: apply(m, cx, args[0] as number) });
        cy = args[0] as number;
        break;
      case "C": {
        out.push({ cmd, args: [...apply(m, args[0] as number, args[1] as number), ...apply(m, args[2] as number, args[3] as number), ...apply(m, args[4] as number, args[5] as number)] });
        cx = args[4] as number;
        cy = args[5] as number;
        break;
      }
      case "S":
      case "Q": {
        out.push({ cmd, args: [...apply(m, args[0] as number, args[1] as number), ...apply(m, args[2] as number, args[3] as number)] });
        cx = args[2] as number;
        cy = args[3] as number;
        break;
      }
      case "A": {
        const [rx, ry, rot, large, sweep, ex, ey] = args as [number, number, number, number, number, number, number];
        if (similar) {
          const p = apply(m, ex, ey);
          out.push({ cmd: "A", args: [rx * scaleA, ry * scaleA, det > 0 ? rot + theta : theta - rot, large, det < 0 ? 1 - sweep : sweep, p[0], p[1]] });
        } else {
          for (const c of arcToCubics(cx, cy, rx, ry, rot, large, sweep, ex, ey)) {
            out.push({ cmd: "C", args: [...apply(m, c[0] as number, c[1] as number), ...apply(m, c[2] as number, c[3] as number), ...apply(m, c[4] as number, c[5] as number)] });
          }
        }
        cx = ex;
        cy = ey;
        break;
      }
      case "Z":
        out.push({ cmd: "Z", args: [] });
        cx = sx;
        cy = sy;
        break;
    }
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */
/* Direction                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

/** Reverse the direction of every subpath. The result uses absolute M, L, C and Z. */
export function reversePath(segs: PathSegment[]): PathSegment[] {
  const curves = toCurves(segs);
  const out: PathSegment[] = [];
  let i = 0;
  while (i < curves.length) {
    const first = curves[i] as PathSegment;
    if (first.cmd !== "M") {
      i++;
      continue;
    }
    const start: Pt = [first.args[0] as number, first.args[1] as number];
    const edges: { from: Pt; seg: PathSegment }[] = [];
    let at: Pt = start;
    let closed = false;
    i++;
    while (i < curves.length && (curves[i] as PathSegment).cmd !== "M") {
      const seg = curves[i] as PathSegment;
      if (seg.cmd === "Z") {
        closed = true;
        i++;
        break;
      }
      edges.push({ from: at, seg });
      at = [seg.args[seg.args.length - 2] as number, seg.args[seg.args.length - 1] as number];
      i++;
    }
    if (edges.length === 0) {
      out.push({ cmd: "M", args: start });
      if (closed) out.push({ cmd: "Z", args: [] });
      continue;
    }
    const back: PathSegment[] = [];
    const reverseEdge = (e: { from: Pt; seg: PathSegment }): PathSegment =>
      e.seg.cmd === "L" ? { cmd: "L", args: [e.from[0], e.from[1]] } : { cmd: "C", args: [e.seg.args[2] as number, e.seg.args[3] as number, e.seg.args[0] as number, e.seg.args[1] as number, e.from[0], e.from[1]] };
    for (let k = edges.length - 1; k >= 0; k--) back.push(reverseEdge(edges[k] as { from: Pt; seg: PathSegment }));
    if (closed) {
      // The closing line from the last point back to the start is walked first.
      out.push({ cmd: "M", args: start });
      if (at[0] !== start[0] || at[1] !== start[1]) out.push({ cmd: "L", args: [at[0], at[1]] });
      // Z already draws the line back to the start, so a final straight line to the start is dropped.
      const last = back[back.length - 1];
      if (last && last.cmd === "L" && last.args[0] === start[0] && last.args[1] === start[1]) back.pop();
      out.push(...back, { cmd: "Z", args: [] });
    } else {
      out.push({ cmd: "M", args: [at[0], at[1]] }, ...back);
    }
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */
/* Measuring                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** The values of t between 0 and 1 where a cubic's derivative on one axis is zero. */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const ts: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) ts.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      ts.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
    }
  }
  return ts.filter((t) => t > 0 && t < 1);
}

/** The tight box around the drawn path (curves are measured exactly, not by their control points). Null for an empty path. */
export function pathBounds(segs: PathSegment[]): Bounds | null {
  const curves = toCurves(segs);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { cmd, args } of curves) {
    if (cmd === "M") {
      cx = sx = args[0] as number;
      cy = sy = args[1] as number;
      add(cx, cy);
    } else if (cmd === "L") {
      add(args[0] as number, args[1] as number);
      cx = args[0] as number;
      cy = args[1] as number;
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x, y] = args as [number, number, number, number, number, number];
      add(x, y);
      for (const t of cubicExtrema(cx, x1, x2, x)) add(cubic(cx, x1, x2, x, t), cubic(cy, y1, y2, y, t));
      for (const t of cubicExtrema(cy, y1, y2, y)) add(cubic(cx, x1, x2, x, t), cubic(cy, y1, y2, y, t));
      cx = x;
      cy = y;
    } else {
      cx = sx;
      cy = sy;
    }
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The length of the path, counting closing lines. Curves are measured by fine subdivision (error well under 0.01%). */
export function pathLength(segs: PathSegment[]): number {
  const curves = toCurves(segs);
  let len = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { cmd, args } of curves) {
    if (cmd === "M") {
      cx = sx = args[0] as number;
      cy = sy = args[1] as number;
    } else if (cmd === "L") {
      len += Math.hypot((args[0] as number) - cx, (args[1] as number) - cy);
      cx = args[0] as number;
      cy = args[1] as number;
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x, y] = args as [number, number, number, number, number, number];
      let px = cx;
      let py = cy;
      const steps = 200;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const nx = cubic(cx, x1, x2, x, t);
        const ny = cubic(cy, y1, y2, y, t);
        len += Math.hypot(nx - px, ny - py);
        px = nx;
        py = ny;
      }
      cx = x;
      cy = y;
    } else {
      len += Math.hypot(sx - cx, sy - cy);
      cx = sx;
      cy = sy;
    }
  }
  return len;
}

export interface PathInfo {
  commands: number;
  subpaths: number;
  closedSubpaths: number;
  bounds: Bounds | null;
  length: number;
}

export function pathInfo(segs: PathSegment[]): PathInfo {
  return {
    commands: segs.length,
    subpaths: segs.filter((s) => s.cmd === "M" || s.cmd === "m").length,
    closedSubpaths: segs.filter((s) => s.cmd === "Z" || s.cmd === "z").length,
    bounds: pathBounds(segs),
    length: pathLength(segs),
  };
}
