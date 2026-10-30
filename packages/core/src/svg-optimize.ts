/**
 * Shrink SVG files with SVGO (the standard SVG optimizer), with a short list of options a person can understand.
 * Heavy: import this module only from the tool that needs it. Keep this file free of React, the DOM and the network.
 */
import { optimize } from "svgo/browser";
import type { PluginConfig } from "svgo";
import { parseSvg, SvgSyntaxError } from "./svg-xml";

export interface OptimizeOptions {
  /** Digits kept after the decimal point in numbers and paths, 0 to 8. Default 3. */
  precision?: number;
  /** Run the optimizer repeatedly until nothing more shrinks. Default true. */
  multipass?: boolean;
  /** Keep <title> and <desc>, which screen readers use. Default true. */
  keepAccessibleText?: boolean;
  /** Remove width and height and rely on the viewBox, so the SVG scales to its container. Default false. */
  removeDimensions?: boolean;
  /** Keep id attributes as they are (needed if scripts or CSS refer to them). Default false: unused ids are removed and the rest shortened. */
  keepIds?: boolean;
  /** Remove <script> elements and on* event attributes. Default false. */
  removeScripts?: boolean;
  /** Remove embedded bitmap <image> elements. Default false. */
  removeRasterImages?: boolean;
  /** Lay the result out with indentation (bigger, easier to read). Default false. */
  prettify?: boolean;
}

export interface OptimizeResult {
  svg: string;
  /** Bytes (UTF-8) before and after. */
  before: number;
  after: number;
  /** Fraction saved; 0 when the file could not be made smaller. */
  savedFraction: number;
  /** True when the optimizer could not beat the original and the original is returned as it was. */
  unchanged: boolean;
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Optimize an SVG. Throws a readable error for text that is not a well-formed SVG. */
export function optimizeSvg(source: string, options: OptimizeOptions = {}): OptimizeResult {
  const { precision = 3, multipass = true, keepAccessibleText = true, removeDimensions = false, keepIds = false, removeScripts = false, removeRasterImages = false, prettify = false } = options;
  if (!Number.isInteger(precision) || precision < 0 || precision > 8) throw new Error("Precision must be a whole number from 0 to 8.");
  try {
    parseSvg(source);
  } catch (err) {
    if (err instanceof SvgSyntaxError) throw new Error(`Line ${err.line}: ${err.message}`);
    throw err;
  }

  const plugins: PluginConfig[] = [
    {
      name: "preset-default",
      params: {
        floatPrecision: precision,
        overrides: {
          // The viewBox is what lets an SVG scale. It stays.
          removeViewBox: false,
          ...(keepAccessibleText ? { removeTitle: false, removeDesc: false } : {}),
          ...(keepIds ? { cleanupIds: false } : {}),
        },
      },
    },
  ];
  if (!keepAccessibleText) plugins.push("removeTitle", { name: "removeDesc", params: { removeAny: true } });
  if (removeDimensions) plugins.push("removeDimensions");
  if (removeScripts) plugins.push("removeScripts");
  if (removeRasterImages) plugins.push("removeRasterImages");

  const before = bytes(source);
  let out: string;
  try {
    out = optimize(source, { multipass, plugins, js2svg: prettify ? { pretty: true, indent: 2 } : undefined }).data;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message.split("\n").filter(Boolean).slice(0, 2).join(" ") : "The SVG could not be optimized.");
  }
  const after = bytes(out);
  if (!prettify && after >= before) return { svg: source, before, after: before, savedFraction: 0, unchanged: true };
  return { svg: out, before, after, savedFraction: before > 0 ? Math.max(0, (before - after) / before) : 0, unchanged: false };
}
