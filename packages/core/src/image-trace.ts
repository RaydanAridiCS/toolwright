/**
 * Turn a bitmap into SVG paths ("vectorizing" or tracing) with imagetracerjs. Works on raw RGBA pixels, so it can run
 * in a Web Worker. Tracing is only a good fit for logos, icons, line art and flat illustrations; photographs give
 * huge, lumpy results. Heavy: import this module only from the tool that needs it.
 * Keep this file free of React, the DOM and the network.
 */
// @ts-expect-error TS7016: imagetracerjs ships no type declarations
import ImageTracer from "imagetracerjs";
import { MAX_TRACE_PIXELS } from "./image-trace-limits";
import { parseSvg, removeAttr, serializeSvg, setAttr, getAttr, walkElements, type SvgElement } from "./svg-xml";

export { MAX_TRACE_PIXELS };

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type TraceMode = "color" | "black-white";

export interface TraceOptions {
  /** "color" finds a palette; "black-white" makes a two-colour tracing, best for logos and line art. Default "color". */
  mode?: TraceMode;
  /** Colours to use in colour mode, 2 to 64. Default 8. */
  colors?: number;
  /** Black-and-white cut-off, 0 to 255: pixels this bright or darker become black. Omit to choose it automatically. */
  threshold?: number;
  /** How closely curves follow the pixels: "smooth" (rounder, fewer points), "balanced" or "exact" (follows every step). Default "balanced". */
  detail?: "smooth" | "balanced" | "exact";
  /** Ignore specks smaller than this many pixels of outline, 0 to 100. Default 8. */
  ignoreSpecks?: number;
  /** Soften the picture first (a light blur) to remove noise, 0 to 5. Default 0. */
  soften?: number;
  /** Remove the background shape (the colour that fills the whole picture). Default false. */
  removeBackground?: boolean;
  /** Decimal places in coordinates, 0 to 3. Default 1. */
  precision?: number;
}

export interface TraceResult {
  svg: string;
  /** Number of <path> elements. */
  paths: number;
  /** Distinct colours in the result. */
  colors: number;
  bytes: number;
}


/** The grey level that best separates dark from light (Otsu's method), 0 to 255. */
export function otsuThreshold(data: Uint8ClampedArray): number {
  const hist = new Array<number>(256).fill(0);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] as number) < 128) continue;
    hist[Math.round(0.299 * (data[i] as number) + 0.587 * (data[i + 1] as number) + 0.114 * (data[i + 2] as number))]!++;
    total++;
  }
  if (total === 0) return 128;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * (hist[t] as number);
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t] as number;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * (hist[t] as number);
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

const DETAIL: Record<NonNullable<TraceOptions["detail"]>, { ltres: number; qtres: number }> = {
  smooth: { ltres: 3, qtres: 3 },
  balanced: { ltres: 1, qtres: 1 },
  exact: { ltres: 0.1, qtres: 0.1 },
};

/** Whole-picture rectangle paths such as "M 0 0 L 60 0 L 60 60 L 0 60 L 0 0 Z …" are the background. */
function isFullRectangle(d: string, width: number, height: number): boolean {
  return d.replace(/\s+/g, " ").startsWith(`M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} L 0 0 Z`);
}

const fillOf = (el: SvgElement) => getAttr(el, "fill") ?? "";

/** Trace a bitmap. Throws a readable error for pictures that are too large or settings that make no sense. */
export function traceImage(image: RgbaImage, options: TraceOptions = {}): TraceResult {
  const { mode = "color", colors = 8, threshold, detail = "balanced", ignoreSpecks = 8, soften = 0, removeBackground = false, precision = 1 } = options;
  const { width, height } = image;
  if (!(width > 0 && height > 0) || image.data.length !== width * height * 4) throw new Error("The picture has no pixels to trace.");
  if (width * height > MAX_TRACE_PIXELS) throw new Error(`This picture is ${width} × ${height}. Tracing is limited to about ${MAX_TRACE_PIXELS / 1e6} million pixels (around 1200 × 1200), so make it smaller first.`);
  if (!Number.isInteger(colors) || colors < 2 || colors > 64) throw new Error("Colours must be a whole number from 2 to 64.");
  if (!(ignoreSpecks >= 0 && ignoreSpecks <= 100)) throw new Error("Ignore specks must be between 0 and 100.");
  if (!(soften >= 0 && soften <= 5)) throw new Error("Soften must be between 0 and 5.");
  if (!Number.isInteger(precision) || precision < 0 || precision > 3) throw new Error("Precision must be a whole number from 0 to 3.");
  if (threshold !== undefined && !(threshold >= 0 && threshold <= 255)) throw new Error("The threshold must be between 0 and 255.");

  let data = image.data;
  const traceOptions: Record<string, unknown> = {
    ...DETAIL[detail],
    pathomit: ignoreSpecks,
    blurradius: soften,
    blurdelta: 20,
    roundcoords: precision,
    strokewidth: 1,
    viewbox: true,
    desc: false,
  };

  if (mode === "black-white") {
    data = new Uint8ClampedArray(image.data);
    const cut = threshold ?? otsuThreshold(data);
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] as number) < 128) {
        data.set([255, 255, 255, 0], i);
        continue;
      }
      const lum = 0.299 * (data[i] as number) + 0.587 * (data[i + 1] as number) + 0.114 * (data[i + 2] as number);
      // The cut-off is the brightest level that still counts as dark (that is how Otsu's method defines it).
      data.set(lum <= cut ? [0, 0, 0, 255] : [255, 255, 255, 255], i);
    }
    // The picture is already pure black and white, so sampling its two colours finds exactly those.
    Object.assign(traceOptions, { numberofcolors: 2, colorsampling: 2, mincolorratio: 0 });
  } else {
    Object.assign(traceOptions, { numberofcolors: colors, colorsampling: 2, colorquantcycles: 3, mincolorratio: 0 });
  }

  let raw: string;
  try {
    raw = ImageTracer.imagedataToSVG({ width, height, data }, traceOptions) as string;
  } catch {
    throw new Error("The picture could not be traced.");
  }

  // Tidy the result: drop invisible shapes and (on request) the background, and make sure it has a viewBox.
  const { nodes, root } = parseSvg(raw);
  const dropped = new Set<SvgElement>();
  const white = /^rgb\(255,\s*255,\s*255\)$/i;
  walkElements(nodes, (el) => {
    if (el.name !== "path") return;
    const opacity = Number(getAttr(el, "opacity") ?? 1);
    if (opacity === 0) dropped.add(el);
  });
  const paths = root.children.filter((c): c is SvgElement => c.type === "element" && c.name === "path");
  if (removeBackground && paths[0] && isFullRectangle(getAttr(paths[0], "d") ?? "", width, height)) {
    // In black-and-white mode the background is white; in colour mode it is whatever fills the whole picture.
    if (mode === "color" || white.test(fillOf(paths[0]))) dropped.add(paths[0]);
  }
  root.children = root.children.filter((c) => !(c.type === "element" && dropped.has(c)));
  removeAttr(root, "desc");
  if (!getAttr(root, "viewBox")) setAttr(root, "viewBox", `0 0 ${width} ${height}`);
  const svg = serializeSvg(nodes);
  const kept = root.children.filter((c) => c.type === "element" && c.name === "path") as SvgElement[];
  return { svg, paths: kept.length, colors: new Set(kept.map(fillOf)).size, bytes: new TextEncoder().encode(svg).length };
}
