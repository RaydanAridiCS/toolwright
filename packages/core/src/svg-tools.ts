/**
 * Look inside an SVG, find the problems that stop it displaying or scaling, and fix or reformat it.
 * Built on the small reader in svg-xml.ts. Keep this file free of React, the DOM and the network.
 */
import { getAttr, parseSvg, removeAttr, serializeSvg, setAttr, SvgSyntaxError, walkElements, type SvgElement } from "./svg-xml";

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type IssueSeverity = "error" | "warning" | "info";

export interface SvgIssue {
  severity: IssueSeverity;
  message: string;
  /** Which automatic fix deals with it, if any. */
  fix?: "namespace" | "viewbox";
}

export interface SvgInfo {
  bytes: number;
  elements: number;
  tags: { name: string; count: number }[];
  /** Width and height attributes as written, such as "24" or "48mm" or "100%". */
  width?: string;
  height?: string;
  viewBox: ViewBox | null;
  hasNamespace: boolean;
  issues: SvgIssue[];
}

/** Read a viewBox attribute. Null if it is missing or not four numbers with a positive size. */
export function parseViewBox(value: string | undefined): ViewBox | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = parts as [number, number, number, number];
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
export const viewBoxText = (b: ViewBox) => `${fmt(b.x)} ${fmt(b.y)} ${fmt(b.width)} ${fmt(b.height)}`;

/** A length such as "24", "24px" or "1.5in" in CSS pixels. Percentages and unknown units give null. */
export function lengthToPx(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^\s*(-?\d*\.?\d+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|rem)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  const factor: Record<string, number> = { px: 1, pt: 4 / 3, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, em: 16, rem: 16 };
  return n * (factor[(m[2] ?? "px").toLowerCase()] as number);
}

const EXTERNAL = /^\s*(?:https?:)?\/\//i;

/** Everything the file refers to outside itself: links, images, stylesheets. */
function externalRefs(root: SvgElement): string[] {
  const found = new Set<string>();
  walkElements([root], (el) => {
    for (const a of el.attrs) {
      if ((a.name === "href" || a.name === "xlink:href" || a.name === "src") && EXTERNAL.test(a.value)) found.add(a.value.trim());
      for (const m of a.value.matchAll(/url\(\s*["']?\s*((?:https?:)?\/\/[^)"']+)/gi)) found.add(m[1] as string);
    }
    if (el.name === "style") {
      for (const c of el.children) {
        if (c.type !== "text" && c.type !== "cdata") continue;
        for (const m of c.value.matchAll(/(?:url\(\s*["']?|@import\s+["'])\s*((?:https?:)?\/\/[^)"';\s]+)/gi)) found.add(m[1] as string);
      }
    }
  });
  return [...found];
}

/** Count what is in an SVG and list the problems that matter. Throws `SvgSyntaxError` for text that cannot be read. */
export function svgInfo(source: string): SvgInfo {
  const { root } = parseSvg(source);
  const counts = new Map<string, number>();
  let elements = 0;
  let scripts = 0;
  let handlers = 0;
  let rasters = 0;
  let text = 0;
  walkElements([root], (el) => {
    elements++;
    counts.set(el.name, (counts.get(el.name) ?? 0) + 1);
    if (el.name === "script") scripts++;
    if (el.name === "text") text++;
    handlers += el.attrs.filter((a) => /^on/i.test(a.name)).length;
    if (el.name === "image" && /^data:image\/(?:png|jpe?g|gif|webp)/i.test(getAttr(el, "href") ?? getAttr(el, "xlink:href") ?? "")) rasters++;
  });
  const width = getAttr(root, "width");
  const height = getAttr(root, "height");
  const viewBox = parseViewBox(getAttr(root, "viewBox"));
  const hasNamespace = getAttr(root, "xmlns") === "http://www.w3.org/2000/svg";
  const bytes = new TextEncoder().encode(source).length;
  const refs = externalRefs(root);

  const issues: SvgIssue[] = [];
  if (!hasNamespace) issues.push({ severity: "error", message: 'The <svg> has no xmlns="http://www.w3.org/2000/svg". Browsers will not draw it when it is opened as a file or used in an <img>.', fix: "namespace" });
  if (!viewBox) {
    const px = lengthToPx(width) && lengthToPx(height);
    issues.push({
      severity: "warning",
      message: "There is no viewBox, so the drawing cannot scale to fit a container: it always draws at its fixed width and height.",
      fix: px ? "viewbox" : undefined,
    });
  }
  if (!width && !height && !viewBox) issues.push({ severity: "error", message: "The SVG has no size at all (no width, height or viewBox), so it may not display." });
  if (scripts > 0 || handlers > 0) issues.push({ severity: "warning", message: `It contains ${scripts ? `${scripts} <script> element${scripts === 1 ? "" : "s"}` : ""}${scripts && handlers ? " and " : ""}${handlers ? `${handlers} event handler attribute${handlers === 1 ? "" : "s"}` : ""}. That is risky if the file comes from someone else. The SVG Sanitizer removes it.` });
  if (refs.length > 0) issues.push({ severity: "warning", message: `It refers to ${refs.length} address${refs.length === 1 ? "" : "es"} outside the file (${refs.slice(0, 2).join(", ")}${refs.length > 2 ? ", …" : ""}). These do not load in an <img>, and loading them elsewhere reveals who views the SVG.` });
  if (rasters > 0) issues.push({ severity: "info", message: `It embeds ${rasters} bitmap picture${rasters === 1 ? "" : "s"}, which makes the file large and is not really a vector. The Image to SVG tool can trace a bitmap.` });
  if (text > 0) issues.push({ severity: "info", message: "It uses <text>. If the font is not installed where the SVG is viewed, a different font is used. Convert text to outlines in your design app for a fixed look." });
  if (bytes > 100_000) issues.push({ severity: "info", message: `The file is ${Math.round(bytes / 1024)} KB. The SVG Optimizer can usually shrink it a lot.` });

  return {
    bytes,
    elements,
    tags: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    width,
    height,
    viewBox,
    hasNamespace,
    issues,
  };
}

/** Lay the SVG out with indentation. */
export function formatSvg(source: string, indent: number | "tab" = 2): string {
  const { nodes } = parseSvg(source);
  return `${serializeSvg(nodes, { indent: indent === "tab" ? "\t" : " ".repeat(indent) })}\n`;
}

export interface FixResult {
  svg: string;
  /** What was changed, in plain words. */
  applied: string[];
}

/** Add the namespace and a viewBox (from width and height) when they are missing. */
export function fixSvg(source: string): FixResult {
  const { nodes, root } = parseSvg(source);
  const applied: string[] = [];
  if (getAttr(root, "xmlns") !== "http://www.w3.org/2000/svg") {
    root.attrs.unshift({ name: "xmlns", value: "http://www.w3.org/2000/svg" });
    root.attrs = root.attrs.filter((a, i) => !(a.name === "xmlns" && i > 0));
    applied.push('Added xmlns="http://www.w3.org/2000/svg".');
  }
  if (!parseViewBox(getAttr(root, "viewBox"))) {
    const w = lengthToPx(getAttr(root, "width"));
    const h = lengthToPx(getAttr(root, "height"));
    if (w && h && w > 0 && h > 0) {
      setAttr(root, "viewBox", `0 0 ${fmt(w)} ${fmt(h)}`);
      applied.push(`Added viewBox="0 0 ${fmt(w)} ${fmt(h)}" from the width and height.`);
    }
  }
  return { svg: applied.length ? serializeSvg(nodes) : source, applied };
}

/** Set the width and height attributes (in pixels). Pass null to remove one. The viewBox is left alone. */
export function setSvgSize(source: string, width: number | null, height: number | null): string {
  const { nodes, root } = parseSvg(source);
  for (const [name, value] of [["width", width], ["height", height]] as const) {
    if (value === null) removeAttr(root, name);
    else if (value > 0 && Number.isFinite(value)) setAttr(root, name, fmt(value));
    else throw new Error(`The ${name} must be a number above 0.`);
  }
  return serializeSvg(nodes);
}

/** Replace the viewBox. */
export function setSvgViewBox(source: string, box: ViewBox): string {
  if (!(box.width > 0 && box.height > 0) || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) throw new Error("The viewBox needs a width and height above 0.");
  const { nodes, root } = parseSvg(source);
  setAttr(root, "viewBox", viewBoxText(box));
  return serializeSvg(nodes);
}

/** The height that keeps the shape when the width changes, from the viewBox (or width and height). Null if unknown. */
export function aspectHeight(source: string, newWidth: number): number | null {
  const { root } = parseSvg(source);
  const vb = parseViewBox(getAttr(root, "viewBox"));
  const ratio = vb ? vb.height / vb.width : (() => {
    const w = lengthToPx(getAttr(root, "width"));
    const h = lengthToPx(getAttr(root, "height"));
    return w && h ? h / w : null;
  })();
  return ratio === null ? null : Math.round(newWidth * ratio * 1000) / 1000;
}

/** Grow a box on every side. */
export function padBox(box: ViewBox, padding: number): ViewBox {
  return { x: box.x - padding, y: box.y - padding, width: box.width + padding * 2, height: box.height + padding * 2 };
}

export { SvgSyntaxError };
