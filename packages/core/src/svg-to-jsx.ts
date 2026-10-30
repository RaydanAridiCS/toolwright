/**
 * Turn an SVG into a React component. Attribute names are converted the way React expects (class to className,
 * stroke-width to strokeWidth, style strings to objects), editor-only markup is dropped, and the result is valid
 * JSX or TSX. Keep this file free of React, the DOM and the network.
 */
import { getAttr, parseSvg, type SvgElement, type SvgNode } from "./svg-xml";

export interface JsxOptions {
  /** Emit TypeScript (TSX). Default false. */
  typescript?: boolean;
  /** Name of the component. Must be a valid identifier that starts with a capital letter. Default "SvgIcon". */
  componentName?: string;
  /** Pass props (className, onClick, width…) through to the <svg>. Default true. */
  spreadProps?: boolean;
  /** Remove width and height so the SVG sizes itself from CSS or props. Default false. */
  removeDimensions?: boolean;
  /** Replace fill and stroke colours with currentColor so the icon takes the text colour. Default false. */
  currentColor?: boolean;
  /** Wrap the component in React.memo. Default false. */
  memo?: boolean;
  /** `export default` (default) or a named export. */
  exportStyle?: "default" | "named";
  /** Add `import * as React from "react"` for projects that do not use the automatic JSX runtime. Default false. */
  importReact?: boolean;
}

export interface JsxResult {
  code: string;
  /** Things that were dropped or changed that the user may want to know about. */
  notes: string[];
}

const IDENT = /^[A-Z][A-Za-z0-9_]*$/;

/** Attributes whose React name is not just camelCase of the SVG name. */
const SPECIAL: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  "xlink:href": "xlinkHref",
  "xlink:title": "xlinkTitle",
  "xlink:role": "xlinkRole",
  "xlink:show": "xlinkShow",
  "xlink:type": "xlinkType",
  "xml:space": "xmlSpace",
  "xml:lang": "xmlLang",
  "xmlns:xlink": "xmlnsXlink",
  "clip-path": "clipPath",
  "clip-rule": "clipRule",
  "fill-rule": "fillRule",
  "fill-opacity": "fillOpacity",
};

/** `stroke-width` to `strokeWidth`; data- and aria- attributes stay as they are. */
export function reactAttrName(name: string): string | null {
  if (SPECIAL[name]) return SPECIAL[name];
  if (/^(data|aria)-/.test(name)) return name;
  if (name.includes(":")) return /^xmlns$/.test(name) ? "xmlns" : null; // inkscape:, sodipodi:, … are dropped
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Convert a CSS style string to the key/value pairs of a React style object. */
export function parseStyle(css: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of css.split(/;(?![^(]*\))/)) {
    const i = part.indexOf(":");
    if (i === -1) continue;
    const prop = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!prop || !value) continue;
    let key: string;
    if (prop.startsWith("--")) key = prop;
    else if (/^-ms-/.test(prop)) key = `ms${prop.slice(4).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())}`;
    else key = prop.replace(/^-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/^(webkit|moz|o)(?=[A-Z])/, (m) => m.charAt(0).toUpperCase() + m.slice(1));
    out.push([key, value]);
  }
  return out;
}

const jsString = (s: string) => JSON.stringify(s);
const isColor = (v: string) => v.trim() !== "" && !/^(none|currentcolor|inherit|transparent|url\()/i.test(v.trim());

function attrCode(el: SvgElement, name: string, value: string, opts: Required<Pick<JsxOptions, "currentColor">>, notes: Set<string>): string | null {
  const key = reactAttrName(name);
  if (key === null) {
    notes.add(`Removed editor attribute ${name}.`);
    return null;
  }
  if (name === "style") {
    const pairs = parseStyle(value).map(([k, v]) => {
      const colour = opts.currentColor && /^(fill|stroke)$/.test(k) && isColor(v);
      return `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : jsString(k)}: ${jsString(colour ? "currentColor" : v)}`;
    });
    return pairs.length ? `style={{ ${pairs.join(", ")} }}` : null;
  }
  let v = value;
  if (opts.currentColor && (name === "fill" || name === "stroke") && isColor(v)) v = "currentColor";
  void el;
  // JSX decodes entities in attribute strings, so values are written as they are; a quote needs a JavaScript string.
  return v.includes('"') || v.includes("\\") || /[\r\n]/.test(v) ? `${key}={${jsString(v)}}` : `${key}="${v}"`;
}

const hasText = (el: SvgElement) => el.children.some((c) => (c.type === "text" && c.value.trim()) || c.type === "cdata");

function childrenCode(el: SvgElement, depth: number, pad: string, opts: JsxOptions, notes: Set<string>, inText: boolean): string[] {
  const lines: string[] = [];
  for (const node of el.children) {
    for (const line of nodeCode(node, depth, pad, opts, notes, inText || el.name === "text")) lines.push(line);
  }
  return lines;
}

/** Text that is safe inside JSX: braces and angle brackets are written as expressions. */
const jsxText = (s: string) => s.replace(/[{}<>]/g, (c) => `{${jsString(c)}}`);

function nodeCode(node: SvgNode, depth: number, pad: string, opts: JsxOptions, notes: Set<string>, inText: boolean): string[] {
  const indent = pad.repeat(depth);
  if (node.type === "comment" || node.type === "pi" || node.type === "doctype") return [];
  if (node.type === "text") {
    if (!node.value.trim() && !inText) return [];
    return [inText ? jsxText(node.value) : `${indent}${jsxText(node.value.trim())}`];
  }
  if (node.type === "cdata") return [inText ? jsxText(node.value) : `${indent}{${jsString(node.value)}}`];
  if (node.type !== "element") return [];
  if (node.name.includes(":")) {
    notes.add(`Removed editor element <${node.name}>.`);
    return [];
  }
  const attrs = node.attrs.map((a) => attrCode(node, a.name, a.value, { currentColor: !!opts.currentColor }, notes)).filter((a): a is string => a !== null);
  const open = `<${node.name}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
  if (node.children.length === 0) return [`${indent}${open} />`];

  // <style> and <script> hold code, which must be a JavaScript string in JSX.
  if (node.name === "style" || node.name === "script") {
    const code = node.children.map((c) => (c.type === "text" || c.type === "cdata" ? c.value : "")).join("").trim();
    if (node.name === "script") notes.add("The SVG contains a <script>. It is kept as a string, but check that you want it in your component.");
    return [`${indent}${open}>{${jsString(code)}}</${node.name}>`];
  }
  // Text content (inside <text>, <title> and similar) is written on one line so spaces survive.
  if (inText || node.name === "text" || hasText(node)) {
    const inner = childrenCode(node, 0, pad, opts, notes, true).join("");
    return [`${indent}${open}>${inner}</${node.name}>`];
  }
  const inner = childrenCode(node, depth + 1, pad, opts, notes, false);
  if (inner.length === 0) return [`${indent}${open} />`];
  return [`${indent}${open}>`, ...inner, `${indent}</${node.name}>`];
}

/** Convert an SVG file to a React component. Throws a readable error for invalid SVG or a bad component name. */
export function svgToJsx(source: string, options: JsxOptions = {}): JsxResult {
  const { typescript = false, componentName = "SvgIcon", spreadProps = true, removeDimensions = false, currentColor = false, memo = false, exportStyle = "default", importReact = false } = options;
  if (!IDENT.test(componentName)) throw new Error("The component name must start with a capital letter and use only letters, digits and underscores, for example SvgIcon.");

  const { root } = parseSvg(source);
  const notes = new Set<string>();
  const clone: SvgElement = { ...root, attrs: root.attrs.filter((a) => !(removeDimensions && (a.name === "width" || a.name === "height"))) };
  const body = nodeCode(clone, 2, "  ", { currentColor }, notes, false);
  if (spreadProps && body.length) {
    const first = body[0] as string;
    body[0] = first.endsWith(" />") ? `${first.slice(0, -3)} {...props} />` : `${first.slice(0, -1)} {...props}>`;
  }
  if (!getAttr(root, "xmlns")) notes.add('The SVG had no xmlns. React does not need it for inline SVG, so none was added.');

  const imports: string[] = [];
  if (importReact) imports.push('import * as React from "react";');
  else if (typescript && spreadProps) imports.push('import type { SVGProps } from "react";');
  if (memo) imports.push(importReact ? "" : 'import { memo } from "react";');
  const importLines = imports.filter(Boolean);

  const propsType = typescript && spreadProps ? `props: ${importReact ? "React.SVGProps" : "SVGProps"}<SVGSVGElement>` : "";
  const signature = spreadProps ? `(${propsType || "props"})` : "()";
  const lines: string[] = [];
  if (importLines.length) lines.push(...importLines, "");
  const declare = exportStyle === "named" && !memo ? "export const" : "const";
  lines.push(`${declare} ${componentName} = ${signature} => (`, ...body, ");", "");
  const wrapped = memo ? `${importReact ? "React.memo" : "memo"}(${componentName})` : componentName;
  if (exportStyle === "default") lines.push(`export default ${wrapped};`);
  else if (memo) lines.push(`export const Memo${componentName} = ${wrapped};`);
  return { code: `${lines.join("\n").trimEnd()}\n`, notes: [...notes] };
}
