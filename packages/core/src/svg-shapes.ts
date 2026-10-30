/**
 * Make SVG shapes from a few settings: organic blobs, layered waves, polygons and stars. Randomness comes from a
 * seed, so the same seed always draws the same shape (and a shape can be recreated or shared by its seed).
 * Keep this file free of React, the DOM and the network.
 */

/** A small, fast pseudo-random generator (mulberry32). Returns numbers from 0 up to but not including 1. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];

const r = (n: number) => Math.round(n * 100) / 100;
const pt = (p: Pt) => `${r(p[0])} ${r(p[1])}`;

/** A smooth closed curve through the points (Catmull-Rom converted to cubic Bézier segments). */
function smoothClosedPath(points: Pt[], tension = 1): string {
  const n = points.length;
  let d = `M${pt(points[0] as Pt)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n] as Pt;
    const p1 = points[i] as Pt;
    const p2 = points[(i + 1) % n] as Pt;
    const p3 = points[(i + 2) % n] as Pt;
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return `${d}Z`;
}

/* ----------------------------------------------------------------------------------------------- */
/* Blob                                                                                              */
/* ----------------------------------------------------------------------------------------------- */

export interface BlobOptions {
  seed: number;
  /** Width and height of the square the blob fits in. Default 400. */
  size?: number;
  /** Number of points the outline passes through, 3 to 24. More points give a lumpier shape. Default 8. */
  points?: number;
  /** How far the points move in and out, 0 (a circle) to 1 (very uneven). Default 0.5. */
  randomness?: number;
}

export function blobPath({ seed, size = 400, points = 8, randomness = 0.5 }: BlobOptions): string {
  if (!Number.isInteger(points) || points < 3 || points > 24) throw new Error("A blob needs a whole number of points from 3 to 24.");
  if (!(randomness >= 0 && randomness <= 1)) throw new Error("Randomness must be between 0 and 1.");
  if (!(size > 0)) throw new Error("The size must be more than 0.");
  const rand = seededRandom(seed);
  const half = size / 2;
  const pts: Pt[] = [];
  for (let i = 0; i < points; i++) {
    const angle = ((i + (rand() - 0.5) * 0.35 * randomness) / points) * Math.PI * 2;
    // Radii run from 100% down to (100 - 60 x randomness)% of the full radius, so the shape always stays inside the square.
    const radius = half * (1 - randomness * 0.6 * rand());
    pts.push([half + Math.cos(angle) * radius, half + Math.sin(angle) * radius]);
  }
  return smoothClosedPath(pts);
}

/* ----------------------------------------------------------------------------------------------- */
/* Wave                                                                                              */
/* ----------------------------------------------------------------------------------------------- */

export interface WaveOptions {
  width?: number;
  height?: number;
  /** Height of the crests as a fraction of the height, 0 to 1. Default 0.3. */
  amplitude?: number;
  /** Number of full waves across the width, 0.25 to 12. Default 2. */
  frequency?: number;
  /** Shift of the wave along the width, as a fraction of one wave (0 to 1). Default 0. */
  phase?: number;
  /** Layers drawn one behind the other, 1 to 6, each shifted a little. Default 1. */
  layers?: number;
  /** Fill the area below the line ("bottom") or above it ("top"). Default "bottom". */
  fill?: "bottom" | "top";
  /** Seed for the variation between layers. */
  seed?: number;
}

/** One path per layer, back to front. */
export function wavePaths({ width = 800, height = 200, amplitude = 0.3, frequency = 2, phase = 0, layers = 1, fill = "bottom", seed = 1 }: WaveOptions = {}): string[] {
  if (!(width > 0 && height > 0)) throw new Error("The width and height must be more than 0.");
  if (!(amplitude >= 0 && amplitude <= 1)) throw new Error("Amplitude must be between 0 and 1.");
  if (!(frequency >= 0.25 && frequency <= 12)) throw new Error("Frequency must be between 0.25 and 12 waves.");
  if (!Number.isInteger(layers) || layers < 1 || layers > 6) throw new Error("Layers must be a whole number from 1 to 6.");
  const rand = seededRandom(seed);
  const paths: string[] = [];
  const perWave = 12;
  const steps = Math.max(8, Math.ceil(frequency * perWave));
  for (let layer = 0; layer < layers; layer++) {
    const shift = layer === 0 ? phase : phase + (layer / layers) * 0.5 + rand() * 0.15;
    const amp = height * amplitude * (layer === 0 ? 1 : 0.55 + 0.45 * rand());
    // The line sits in the middle band; lower layers sit a little lower so the layers show.
    const base = height * (fill === "bottom" ? 0.5 + (0.25 * layer) / Math.max(1, layers) : 0.5 - (0.25 * layer) / Math.max(1, layers));
    const pts: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      pts.push([x, base + Math.sin(((i / steps) * frequency + shift) * Math.PI * 2) * amp * 0.5]);
    }
    // Catmull-Rom through the points, open at the ends.
    let d = `M${pt(pts[0] as Pt)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = (pts[i - 1] ?? pts[i]) as Pt;
      const p1 = pts[i] as Pt;
      const p2 = pts[i + 1] as Pt;
      const p3 = (pts[i + 2] ?? pts[i + 1]) as Pt;
      d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
    }
    d += fill === "bottom" ? `L${r(width)} ${r(height)}L0 ${r(height)}Z` : `L${r(width)} 0L0 0Z`;
    paths.push(d);
  }
  return paths;
}

/* ----------------------------------------------------------------------------------------------- */
/* Polygon and star                                                                                  */
/* ----------------------------------------------------------------------------------------------- */

export interface PolygonOptions {
  /** Number of sides, 3 to 24. Default 6. */
  sides?: number;
  size?: number;
  /** Turn in degrees. Default 0 puts the first corner at the top. */
  rotation?: number;
}

export function polygonPath({ sides = 6, size = 400, rotation = 0 }: PolygonOptions = {}): string {
  if (!Number.isInteger(sides) || sides < 3 || sides > 24) throw new Error("A polygon needs a whole number of sides from 3 to 24.");
  const half = size / 2;
  const pts: Pt[] = Array.from({ length: sides }, (_, i) => {
    const a = ((i / sides) * 360 + rotation - 90) * (Math.PI / 180);
    return [half + Math.cos(a) * half, half + Math.sin(a) * half];
  });
  return `M${pts.map(pt).join("L")}Z`;
}

export interface StarOptions {
  /** Number of points, 3 to 24. Default 5. */
  points?: number;
  size?: number;
  /** Radius of the inner corners as a fraction of the outer radius, 0.1 to 0.95. Default 0.5. */
  innerRatio?: number;
  rotation?: number;
}

export function starPath({ points = 5, size = 400, innerRatio = 0.5, rotation = 0 }: StarOptions = {}): string {
  if (!Number.isInteger(points) || points < 3 || points > 24) throw new Error("A star needs a whole number of points from 3 to 24.");
  if (!(innerRatio >= 0.1 && innerRatio <= 0.95)) throw new Error("The inner ratio must be between 0.1 and 0.95.");
  const half = size / 2;
  const pts: Pt[] = Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? half : half * innerRatio;
    const a = ((i / (points * 2)) * 360 + rotation - 90) * (Math.PI / 180);
    return [half + Math.cos(a) * radius, half + Math.sin(a) * radius];
  });
  return `M${pts.map(pt).join("L")}Z`;
}

/* ----------------------------------------------------------------------------------------------- */
/* Putting it in a file                                                                              */
/* ----------------------------------------------------------------------------------------------- */

export interface SvgLayer {
  d: string;
  fill: string;
  opacity?: number;
}

const attr = (s: string) => s.replace(/[^A-Za-z0-9#(),.%\s-]/g, "");

/** A complete SVG file with the given layers, drawn back to front. */
export function shapeSvg(width: number, height: number, layers: SvgLayer[], background?: string): string {
  const w = r(width);
  const h = r(height);
  const rect = background ? `<rect width="${w}" height="${h}" fill="${attr(background)}"/>` : "";
  const paths = layers.map((l) => `<path d="${l.d}" fill="${attr(l.fill)}"${l.opacity !== undefined && l.opacity < 1 ? ` fill-opacity="${r(l.opacity)}"` : ""}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${rect}${paths}</svg>`;
}
