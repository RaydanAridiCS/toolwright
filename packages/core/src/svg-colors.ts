/**
 * Find and change the colours used in an SVG: fill, stroke, gradient stops and the other colour properties, written
 * as attributes, in style="…" or in a <style> block. Keep this file free of React, the DOM and the network.
 */
import { hslToRgb, parseColor, rgbToHex, rgbToHsl, type RGBA } from "./color";
import { parseSvg, serializeSvg, walkElements, type SvgElement } from "./svg-xml";

/** The properties that take a colour. `color` is what currentColor refers to. */
export const COLOR_PROPERTIES = ["fill", "stroke", "stop-color", "flood-color", "lighting-color", "color"] as const;

const PROP_GROUP = COLOR_PROPERTIES.join("|");
/** A declaration such as `fill: red` in CSS. The lookbehind keeps `background-color` and `border-color` out. */
const DECLARATION = new RegExp(`(?<![\\w-])(${PROP_GROUP})(\\s*:\\s*)([^;}"\\n]+)`, "gi");

export interface ColorUse {
  /** Lower-case hex, with alpha only when it is not fully opaque. This is the key used to replace the colour. */
  hex: string;
  count: number;
}

export interface ColorReport {
  colors: ColorUse[];
  /** Times currentColor is used, and `none`. */
  currentColor: number;
  none: number;
}

/** One key for a colour however it was written: red, #F00, rgb(255,0,0). */
export function colorKey(rgba: RGBA): string {
  return rgbToHex({ ...rgba, a: Math.round(rgba.a * 1000) / 1000 }, rgba.a < 1).toLowerCase();
}

const SKIP = /^(?:none|inherit|initial|unset|transparent|context-fill|context-stroke)$/i;

/** Read a colour value. Null for none, currentColor, url(...) references and anything that is not a colour. */
function read(value: string): RGBA | null {
  const v = value.replace(/\s*!important\s*$/i, "").trim();
  if (!v || SKIP.test(v) || /^currentcolor$/i.test(v) || /^url\(/i.test(v)) return null;
  return parseColor(v);
}

type Rewrite = (rgba: RGBA, original: string, property: string) => string | null;

/** Apply `rewrite` to every colour in the file. Returns the nodes changed and how many replacements were made. */
function rewriteColors(source: string, rewrite: Rewrite, extra?: { currentColor?: (property: string, value: string) => string | null }): { svg: string; changed: number } {
  const { nodes } = parseSvg(source);
  let changed = 0;

  const fixValue = (property: string, value: string): string => {
    const color = read(value);
    if (color) {
      const next = rewrite(color, value, property);
      if (next !== null && next !== value) {
        changed++;
        return next;
      }
    } else if (extra?.currentColor) {
      const next = extra.currentColor(property, value);
      if (next !== null && next !== value) {
        changed++;
        return next;
      }
    }
    return value;
  };
  const fixCss = (css: string) =>
    css.replace(DECLARATION, (_m, prop: string, colon: string, value: string) => {
      const trailing = /\s*$/.exec(value)?.[0] ?? "";
      return `${prop}${colon}${fixValue(prop.toLowerCase(), value.trimEnd())}${trailing}`;
    });

  walkElements(nodes, (el: SvgElement) => {
    for (const attr of el.attrs) {
      if ((COLOR_PROPERTIES as readonly string[]).includes(attr.name)) attr.value = fixValue(attr.name, attr.value);
      else if (attr.name === "style") attr.value = fixCss(attr.value);
    }
    if (el.name === "style") {
      for (const child of el.children) if (child.type === "text" || child.type === "cdata") child.value = fixCss(child.value);
    }
  });
  return { svg: changed ? serializeSvg(nodes) : source, changed };
}

/** List the colours used, most used first. */
export function findColors(source: string): ColorReport {
  const counts = new Map<string, number>();
  let currentColor = 0;
  let none = 0;
  const seeValue = (value: string) => {
    const v = value.replace(/\s*!important\s*$/i, "").trim();
    if (/^currentcolor$/i.test(v)) currentColor++;
    else if (/^none$/i.test(v)) none++;
    else {
      const c = read(v);
      if (c) counts.set(colorKey(c), (counts.get(colorKey(c)) ?? 0) + 1);
    }
  };
  const { nodes } = parseSvg(source);
  const seeCss = (css: string) => {
    for (const m of css.matchAll(DECLARATION)) seeValue((m[3] as string).trim());
  };
  walkElements(nodes, (el) => {
    for (const attr of el.attrs) {
      if ((COLOR_PROPERTIES as readonly string[]).includes(attr.name)) seeValue(attr.value);
      else if (attr.name === "style") seeCss(attr.value);
    }
    if (el.name === "style") for (const c of el.children) if (c.type === "text" || c.type === "cdata") seeCss(c.value);
  });
  return { colors: [...counts].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex)), currentColor, none };
}

/** Write a colour the way it should appear in the file: the short hex form when possible, rgba() when it has transparency. */
export function writeColor(rgba: RGBA): string {
  if (rgba.a < 1) return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${Math.round(rgba.a * 1000) / 1000})`;
  const hex = rgbToHex(rgba).toLowerCase();
  return /^#(.)\1(.)\2(.)\3$/.test(hex) ? `#${hex[1]}${hex[3]}${hex[5]}` : hex;
}

/**
 * Replace colours. `map` goes from a colour key (see `findColors`) to the new colour as CSS text. A colour that was
 * semi-transparent keeps its transparency when the new colour has none.
 */
export function replaceColors(source: string, map: Record<string, string>): { svg: string; changed: number } {
  const wanted = new Map<string, RGBA>();
  for (const [from, to] of Object.entries(map)) {
    const target = parseColor(to);
    if (!target) throw new Error(`“${to}” is not a colour. Use a name such as red, or a code such as #ff0000.`);
    const key = parseColor(from);
    wanted.set(key ? colorKey(key) : from.toLowerCase(), target);
  }
  return rewriteColors(source, (color) => {
    const target = wanted.get(colorKey(color));
    if (!target) return null;
    return writeColor(target.a === 1 && color.a < 1 ? { ...target, a: color.a } : target);
  });
}

export type ColorOperation = "invert" | "grayscale" | "lighten" | "darken";

/** Change every colour in the same way. `amount` (0 to 1) is used by lighten and darken. */
export function transformColors(source: string, operation: ColorOperation, amount = 0.2): { svg: string; changed: number } {
  return rewriteColors(source, (c) => {
    switch (operation) {
      case "invert":
        return writeColor({ ...c, r: 255 - c.r, g: 255 - c.g, b: 255 - c.b });
      case "grayscale": {
        const y = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        return writeColor({ ...c, r: y, g: y, b: y });
      }
      default: {
        const hsl = rgbToHsl(c);
        const l = Math.min(100, Math.max(0, hsl.l + (operation === "lighten" ? 1 : -1) * amount * 100));
        return writeColor({ ...hslToRgb({ ...hsl, l }), a: c.a });
      }
    }
  });
}

export interface CurrentColorOptions {
  fills?: boolean;
  strokes?: boolean;
}

/**
 * Make fills and strokes follow the text colour (currentColor), so the icon can be recoloured from CSS.
 * `none` and gradients are left alone.
 */
export function useCurrentColor(source: string, options: CurrentColorOptions = {}): { svg: string; changed: number } {
  const { fills = true, strokes = true } = options;
  return rewriteColors(source, (_c, _o, property) => ((property === "fill" && fills) || (property === "stroke" && strokes) ? "currentColor" : null));
}

/** Set one colour for every fill and stroke that has a colour. */
export function setSingleColor(source: string, color: string): { svg: string; changed: number } {
  const target = parseColor(color);
  if (!target) throw new Error(`“${color}” is not a colour. Use a name such as red, or a code such as #ff0000.`);
  return rewriteColors(source, (_c, _o, property) => (property === "fill" || property === "stroke" ? writeColor(target) : null));
}
