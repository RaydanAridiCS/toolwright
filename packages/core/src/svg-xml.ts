/**
 * A small, forgiving XML reader and writer for SVG files. It keeps text and attribute values exactly as written
 * (entities are not decoded), so reading and writing a file does not change what it says. Parsing is iterative, so
 * very deep nesting cannot overflow the stack. Keep this file free of React, the DOM and the network.
 */

export interface SvgAttr {
  name: string;
  /** The value as written in the file, with entities such as &amp; left alone. */
  value: string;
}

export interface SvgElement {
  type: "element";
  name: string;
  attrs: SvgAttr[];
  children: SvgNode[];
  /** Written as <tag/> in the source. */
  selfClosing: boolean;
  /** Line the tag starts on, counting from 1. */
  line: number;
}

export interface SvgText {
  type: "text";
  value: string;
}

export interface SvgComment {
  type: "comment";
  value: string;
}

/** CDATA sections, the doctype, and processing instructions such as <?xml ...?>. */
export interface SvgOther {
  type: "cdata" | "doctype" | "pi";
  value: string;
}

export type SvgNode = SvgElement | SvgText | SvgComment | SvgOther;

export class SvgSyntaxError extends Error {
  constructor(message: string, readonly line: number) {
    super(message);
    this.name = "SvgSyntaxError";
  }
}

export interface SvgDocument {
  nodes: SvgNode[];
  root: SvgElement;
}

const NAME_END = /[\s=/>"'<]/;

/** Read an SVG file. Throws an `SvgSyntaxError` that names the line of the first problem. */
export function parseSvg(source: string): SvgDocument {
  const text = source.replace(/^\uFEFF/, "");
  const n = text.length;
  const top: SvgNode[] = [];
  const stack: SvgElement[] = [];
  let i = 0;
  let line = 1;

  const advance = (to: number) => {
    for (let k = i; k < to; k++) if (text.charCodeAt(k) === 10) line++;
    i = to;
  };
  const append = (node: SvgNode) => {
    const parent = stack[stack.length - 1];
    (parent ? parent.children : top).push(node);
  };

  while (i < n) {
    if (text[i] !== "<") {
      let j = text.indexOf("<", i);
      if (j === -1) j = n;
      const value = text.slice(i, j);
      if (stack.length === 0 && value.trim()) throw new SvgSyntaxError("There is text outside the <svg> element. An SVG file should contain only the <svg> element and its content.", line);
      append({ type: "text", value });
      advance(j);
    } else if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) throw new SvgSyntaxError("A comment is never closed. It needs a closing -->.", line);
      append({ type: "comment", value: text.slice(i + 4, end) });
      advance(end + 3);
    } else if (text.startsWith("<![CDATA[", i)) {
      const end = text.indexOf("]]>", i + 9);
      if (end === -1) throw new SvgSyntaxError("A CDATA section is never closed. It needs a closing ]]>.", line);
      append({ type: "cdata", value: text.slice(i + 9, end) });
      advance(end + 3);
    } else if (text.startsWith("<?", i)) {
      const end = text.indexOf("?>", i + 2);
      if (end === -1) throw new SvgSyntaxError("A <? … ?> declaration is never closed.", line);
      append({ type: "pi", value: text.slice(i + 2, end) });
      advance(end + 2);
    } else if (text.startsWith("<!", i)) {
      // <!DOCTYPE …>, possibly with an internal subset in [ ].
      let depth = 0;
      let j = i + 2;
      for (; j < n; j++) {
        const c = text[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      if (j >= n) throw new SvgSyntaxError("A <!DOCTYPE …> declaration is never closed.", line);
      append({ type: "doctype", value: text.slice(i + 2, j) });
      advance(j + 1);
    } else if (text[i + 1] === "/") {
      const end = text.indexOf(">", i);
      if (end === -1) throw new SvgSyntaxError("A closing tag is never finished. It needs a >.", line);
      const name = text.slice(i + 2, end).trim();
      const open = stack.pop();
      if (!open) throw new SvgSyntaxError(`There is a closing </${name}> with no matching opening tag.`, line);
      if (open.name !== name) throw new SvgSyntaxError(`<${open.name}> on line ${open.line} is closed by </${name}>. Expected </${open.name}>.`, line);
      advance(end + 1);
    } else {
      const startLine = line;
      let j = i + 1;
      let nameEnd = j;
      while (nameEnd < n && !NAME_END.test(text[nameEnd] as string)) nameEnd++;
      const name = text.slice(j, nameEnd);
      if (!name) throw new SvgSyntaxError("A < is not followed by a tag name. To write a < inside text, use &lt;.", line);
      j = nameEnd;
      const attrs: SvgAttr[] = [];
      let selfClosing = false;
      for (;;) {
        while (j < n && /\s/.test(text[j] as string)) j++;
        if (j >= n) throw new SvgSyntaxError(`The <${name}> tag is never finished. It needs a >.`, startLine);
        if (text[j] === ">") {
          j++;
          break;
        }
        if (text[j] === "/" && text[j + 1] === ">") {
          selfClosing = true;
          j += 2;
          break;
        }
        let k = j;
        while (k < n && !NAME_END.test(text[k] as string)) k++;
        if (k === j) throw new SvgSyntaxError(`Unexpected “${text[j]}” inside the <${name}> tag.`, startLine + (text.slice(i, j).match(/\n/g)?.length ?? 0));
        const attr = text.slice(j, k);
        j = k;
        while (j < n && /\s/.test(text[j] as string)) j++;
        let value = "";
        if (text[j] === "=") {
          j++;
          while (j < n && /\s/.test(text[j] as string)) j++;
          const quote = text[j];
          if (quote === '"' || quote === "'") {
            const close = text.indexOf(quote, j + 1);
            if (close === -1) throw new SvgSyntaxError(`The value of ${attr} in <${name}> has no closing quote.`, startLine);
            value = text.slice(j + 1, close);
            j = close + 1;
          } else {
            let v = j;
            while (v < n && !/[\s>]/.test(text[v] as string) && !(text[v] === "/" && text[v + 1] === ">")) v++;
            value = text.slice(j, v);
            j = v;
          }
        }
        attrs.push({ name: attr, value });
      }
      const element: SvgElement = { type: "element", name, attrs, children: [], selfClosing, line: startLine };
      if (stack.length === 0 && top.some((t) => t.type === "element")) throw new SvgSyntaxError("There is more than one top-level element. An SVG file has a single <svg> root.", startLine);
      append(element);
      if (!selfClosing) stack.push(element);
      advance(j);
    }
  }

  const unclosed = stack[stack.length - 1];
  if (unclosed) throw new SvgSyntaxError(`<${unclosed.name}> on line ${unclosed.line} is never closed. It needs a closing </${unclosed.name}>.`, unclosed.line);
  const root = top.find((t): t is SvgElement => t.type === "element");
  if (!root) throw new SvgSyntaxError("No <svg> element found. Paste the SVG code, starting with <svg ...>.", 1);
  if (root.name !== "svg") throw new SvgSyntaxError(`The top element is <${root.name}>, not <svg>. This does not look like an SVG file.`, root.line);
  return { nodes: top, root };
}

/* ----------------------------------------------------------------------------------------------- */
/* Writing                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

const INLINE_TEXT = new Set(["text", "tspan", "textPath", "title", "desc", "style", "script", "a"]);

export interface SerializeOptions {
  /** Indentation for pretty output ("  ", "\t"…). Null or omitted keeps the whitespace as it was. */
  indent?: string | null;
  /** The quote around attribute values. Default double quotes. */
  quote?: '"' | "'";
}

function attrsText(el: SvgElement, quote: '"' | "'" = '"'): string {
  const entity = quote === '"' ? "&quot;" : "&apos;";
  return el.attrs.map((a) => ` ${a.name}=${quote}${a.value.split(quote).join(entity)}${quote}`).join("");
}

const isBlank = (n: SvgNode) => n.type === "text" && !n.value.trim();

function writeNode(node: SvgNode, out: string[], opts: SerializeOptions, depth: number, inlineMode: boolean): void {
  if (depth > 5000) throw new RangeError("nested too deeply");
  const pretty = opts.indent != null && !inlineMode;
  const pad = pretty ? opts.indent!.repeat(depth) : "";
  const nl = pretty ? "\n" : "";
  switch (node.type) {
    case "text":
      out.push(inlineMode || opts.indent == null ? node.value : node.value.trim());
      return;
    case "comment":
      out.push(`${pad}<!--${node.value}-->${nl}`);
      return;
    case "cdata":
      out.push(`${pad}<![CDATA[${node.value}]]>${nl}`);
      return;
    case "doctype":
      out.push(`<!${node.value}>${nl || ""}`);
      return;
    case "pi":
      out.push(`<?${node.value}?>${nl || ""}`);
      return;
    case "element": {
      const open = `<${node.name}${attrsText(node, opts.quote)}`;
      if (node.children.length === 0) {
        out.push(`${pad}${open}${node.selfClosing || !pretty ? "/>" : `></${node.name}>`}${nl}`);
        return;
      }
      const kids = pretty ? node.children.filter((c) => !isBlank(c)) : node.children;
      const hasText = kids.some((c) => c.type === "text" || c.type === "cdata");
      const keepInline = inlineMode || (pretty && (INLINE_TEXT.has(node.name) || hasText));
      if (keepInline) {
        out.push(`${pad}${open}>`);
        for (const child of node.children) writeNode(child, out, opts, 0, true);
        out.push(`</${node.name}>${nl}`);
        return;
      }
      out.push(`${pad}${open}>${nl}`);
      for (const child of kids) writeNode(child, out, opts, depth + 1, false);
      out.push(`${pad}</${node.name}>${nl}`);
      return;
    }
  }
}

/** Write nodes back to text. With `indent` set, the layout is rebuilt; text inside <text>, <style> and similar is left alone. */
export function serializeSvg(nodes: SvgNode[], options: SerializeOptions = {}): string {
  const out: string[] = [];
  try {
    for (const node of nodes) {
      if (options.indent != null && isBlank(node)) continue;
      writeNode(node, out, options, 0, false);
    }
  } catch (err) {
    if (err instanceof RangeError) throw new SvgSyntaxError("This SVG is nested too deeply to rewrite.", 1);
    throw err;
  }
  return out.join("").trimEnd();
}

/* ----------------------------------------------------------------------------------------------- */
/* Helpers                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export const getAttr = (el: SvgElement, name: string): string | undefined => el.attrs.find((a) => a.name === name)?.value;

export function setAttr(el: SvgElement, name: string, value: string): void {
  const existing = el.attrs.find((a) => a.name === name);
  if (existing) existing.value = value;
  else el.attrs.push({ name, value });
}

export function removeAttr(el: SvgElement, name: string): boolean {
  const index = el.attrs.findIndex((a) => a.name === name);
  if (index === -1) return false;
  el.attrs.splice(index, 1);
  return true;
}

/** Visit every element, parents before children. The walk is iterative. */
export function walkElements(nodes: SvgNode[], visit: (el: SvgElement, parent: SvgElement | null, depth: number) => void): void {
  const stack: { node: SvgNode; parent: SvgElement | null; depth: number }[] = [];
  for (let k = nodes.length - 1; k >= 0; k--) stack.push({ node: nodes[k] as SvgNode, parent: null, depth: 0 });
  while (stack.length) {
    const { node, parent, depth } = stack.pop() as { node: SvgNode; parent: SvgElement | null; depth: number };
    if (node.type !== "element") continue;
    visit(node, parent, depth);
    for (let k = node.children.length - 1; k >= 0; k--) stack.push({ node: node.children[k] as SvgNode, parent: node, depth: depth + 1 });
  }
}

/** A fresh deep copy, so edits do not change the original. */
export function cloneNodes(nodes: SvgNode[]): SvgNode[] {
  return nodes.map((n) => (n.type === "element" ? { ...n, attrs: n.attrs.map((a) => ({ ...a })), children: cloneNodes(n.children) } : { ...n }));
}

/** Escape text for use in element content. */
export const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Escape a value for use inside double quotes. */
export const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
