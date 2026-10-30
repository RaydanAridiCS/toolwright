/**
 * XML for people: check it, format it, shrink it, and convert it to and from JSON.
 *
 * The reader is written for this tool. It is iterative (a 50,000-deep file cannot overflow the stack), it never
 * loads or expands entities from a DOCTYPE (so "billion laughs" files are harmless), and it reports the line and
 * column of the first problem. Text and attribute values keep their original spelling when a file is formatted or
 * shrunk, so `&#169;` stays `&#169;`. Keep this file free of React, the DOM and the network.
 */

export interface XmlAttr {
  name: string;
  /** The value with character references decoded. */
  value: string;
  /** The value exactly as written. */
  raw: string;
  quote: '"' | "'";
}

export interface XmlElement {
  type: "element";
  name: string;
  attrs: XmlAttr[];
  children: XmlNode[];
  /** Written as `<tag/>` in the source. */
  selfClosing: boolean;
  line: number;
}

export interface XmlText {
  type: "text";
  /** As written, with references such as `&amp;` left alone. */
  raw: string;
  /** With references decoded. */
  value: string;
}

export type XmlNode =
  | XmlElement
  | XmlText
  | { type: "cdata"; value: string }
  | { type: "comment"; value: string }
  | { type: "pi"; target: string; data: string }
  | { type: "doctype"; raw: string };

export interface XmlWarning {
  message: string;
  line: number;
}

export interface XmlStats {
  elements: number;
  attributes: number;
  maxDepth: number;
  comments: number;
}

export interface XmlDocument {
  /** Declaration, comments, processing instructions and the DOCTYPE before the root element. */
  before: XmlNode[];
  root: XmlElement;
  /** Comments and processing instructions after the root element. */
  after: XmlNode[];
  warnings: XmlWarning[];
  stats: XmlStats;
  /** The `encoding` named in the declaration, if any. */
  encoding?: string;
}

export const XML_LIMITS = {
  maxChars: 20_000_000,
  /** Converting to or from JSON nests objects, which stops being safe far below what the reader itself can handle. */
  maxConvertDepth: 1000,
  /** Formatted output larger than this is refused. A very deep file would otherwise need quadratic indentation. */
  maxOutputChars: 60_000_000,
  maxWarnings: 20,
} as const;

export class XmlError extends Error {
  constructor(message: string, readonly line: number, readonly column: number) {
    super(`Line ${line}, column ${column}: ${message}`);
    this.name = "XmlError";
  }
}

/* ----------------------------------------------------------------------------------------------- */
/* Reading                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

const NAME_RE = /[\p{L}\p{Nl}_:][\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}_:.-]*/uy;
const NAME_ONLY = /^[\p{L}\p{Nl}_:][\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}_:.-]*$/u;
// The characters XML forbids: control codes other than tab, line feed and carriage return.
// eslint-disable-next-line no-control-regex
const BAD_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
const SPACE = /[ \t\r\n]/;

export const isXmlName = (name: string) => NAME_ONLY.test(name);

const PREDEFINED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function validXmlCodePoint(cp: number): boolean {
  return cp === 0x9 || cp === 0xa || cp === 0xd || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff);
}

interface Parsing {
  src: string;
  /** Index of the first character of each line. */
  starts: number[];
}

function positionAt(p: Parsing, index: number): { line: number; column: number } {
  let lo = 0;
  let hi = p.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((p.starts[mid] as number) <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: index - (p.starts[lo] as number) + 1 };
}

function fail(p: Parsing, index: number, message: string): never {
  const { line, column } = positionAt(p, index);
  throw new XmlError(message, line, column);
}

/** Decodes character references. Named references other than the five built-in ones are kept as written when the DOCTYPE declares them, and are an error otherwise. */
function decode(p: Parsing, raw: string, base: number, declared: ReadonlySet<string>): string {
  if (raw.indexOf("&") === -1) return raw;
  let out = "";
  let last = 0;
  for (let at = raw.indexOf("&"); at !== -1; at = raw.indexOf("&", last)) {
    out += raw.slice(last, at);
    const end = raw.indexOf(";", at + 1);
    const body = end === -1 || end - at > 40 ? "" : raw.slice(at + 1, end);
    if (!body || /[\s&<]/.test(body)) fail(p, base + at, "A lone & is not allowed. Write &amp; for an ampersand, or end the reference with a semicolon.");
    if (body.startsWith("#")) {
      const hex = body[1] === "x";
      const digits = body.slice(hex ? 2 : 1);
      if (!(hex ? /^[0-9A-Fa-f]+$/ : /^[0-9]+$/).test(digits)) fail(p, base + at, `&${body}; is not a valid character reference.`);
      const cp = parseInt(digits, hex ? 16 : 10);
      if (!Number.isFinite(cp) || !validXmlCodePoint(cp)) fail(p, base + at, `&${body}; refers to a character that XML does not allow.`);
      out += String.fromCodePoint(cp);
    } else if (body in PREDEFINED) {
      out += PREDEFINED[body];
    } else if (declared.has(body)) {
      out += `&${body};`;
    } else {
      fail(p, base + at, `Unknown entity &${body};. XML only knows &amp; &lt; &gt; &quot; and &apos;. Use a number such as &#160; for other characters.`);
    }
    last = end + 1;
  }
  return out + raw.slice(last);
}

/** Reads an XML file. Throws an `XmlError` that names the line and column of the first problem. */
export function parseXml(input: string): XmlDocument {
  if (typeof input !== "string") throw new XmlError("The input is not text.", 1, 1);
  const src = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (src.length > XML_LIMITS.maxChars) throw new XmlError(`The file has ${(src.length / 1e6).toFixed(1)} million characters. The limit is ${XML_LIMITS.maxChars / 1e6} million.`, 1, 1);
  const starts = [0];
  for (let k = src.indexOf("\n"); k !== -1; k = src.indexOf("\n", k + 1)) starts.push(k + 1);
  const p: Parsing = { src, starts };

  const bad = BAD_CONTROL.exec(src);
  if (bad) fail(p, bad.index, `The character U+${(bad[0].codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")} is not allowed in XML.`);

  const n = src.length;
  const before: XmlNode[] = [];
  const after: XmlNode[] = [];
  const stack: XmlElement[] = [];
  const declaredByElement: string[][] = [];
  const bindings = new Map<string, number>();
  const declared = new Set<string>();
  const warnings: XmlWarning[] = [];
  const warnedPrefixes = new Set<string>();
  const stats: XmlStats = { elements: 0, attributes: 0, maxDepth: 0, comments: 0 };
  let root: XmlElement | null = null;
  let doctypeSeen = false;
  let encoding: string | undefined;
  let i = 0;

  const append = (node: XmlNode) => {
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else (root ? after : before).push(node);
  };
  const skipSpace = (from: number) => {
    let k = from;
    while (k < n && SPACE.test(src[k] as string)) k++;
    return k;
  };
  const checkPrefix = (name: string, index: number) => {
    const colon = name.indexOf(":");
    if (colon <= 0) return;
    const prefix = name.slice(0, colon);
    if (prefix === "xml" || prefix === "xmlns" || (bindings.get(prefix) ?? 0) > 0 || warnedPrefixes.has(prefix) || warnings.length >= XML_LIMITS.maxWarnings) return;
    warnedPrefixes.add(prefix);
    warnings.push({ message: `The prefix "${prefix}:" is used but never declared. Add xmlns:${prefix}="..." to the element or one around it.`, line: positionAt(p, index).line });
  };

  while (i < n) {
    if (src[i] !== "<") {
      let j = src.indexOf("<", i);
      if (j === -1) j = n;
      const raw = src.slice(i, j);
      if (stack.length === 0) {
        const bit = /[^ \t\r\n]/.exec(raw);
        if (bit) fail(p, i + bit.index, root ? "There is text after the root element. A file has one root element, and nothing but comments after it." : "There is text before the root element. A file starts with <?xml ...?> or a tag.");
      } else {
        const cdataEnd = raw.indexOf("]]>");
        if (cdataEnd !== -1) fail(p, i + cdataEnd, "The characters ]]> cannot appear in text. Write ]]&gt; instead.");
        append({ type: "text", raw, value: decode(p, raw, i, declared) });
      }
      i = j;
      continue;
    }

    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      if (end === -1) fail(p, i, "This comment is never closed. It needs -->.");
      const value = src.slice(i + 4, end);
      const dashes = value.indexOf("--");
      if (dashes !== -1 || value.endsWith("-")) fail(p, i + 4 + (dashes === -1 ? value.length - 1 : dashes), "A comment cannot contain two hyphens in a row (--).");
      stats.comments++;
      append({ type: "comment", value });
      i = end + 3;
    } else if (src.startsWith("<![CDATA[", i)) {
      if (stack.length === 0) fail(p, i, "A CDATA section must be inside an element.");
      const end = src.indexOf("]]>", i + 9);
      if (end === -1) fail(p, i, "This CDATA section is never closed. It needs ]]>.");
      append({ type: "cdata", value: src.slice(i + 9, end) });
      i = end + 3;
    } else if (src.startsWith("<!DOCTYPE", i)) {
      if (root || stack.length > 0) fail(p, i, "A DOCTYPE must come before the root element.");
      if (doctypeSeen) fail(p, i, "A file can have only one DOCTYPE.");
      doctypeSeen = true;
      let depth = 0;
      let quote = "";
      let k = i + 9;
      for (; k < n; k++) {
        const c = src[k] as string;
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      if (k >= n) fail(p, i, "This DOCTYPE is never closed. It needs >.");
      const raw = src.slice(i, k + 1);
      // Entities declared here are allowed as references, but they are never expanded, so they cannot blow up.
      for (const m of raw.matchAll(/<!ENTITY\s+([^\s%][^\s]*)/g)) declared.add(m[1] as string);
      before.push({ type: "doctype", raw });
      i = k + 1;
    } else if (src.startsWith("<?", i)) {
      const end = src.indexOf("?>", i + 2);
      if (end === -1) fail(p, i, "This processing instruction is never closed. It needs ?>.");
      const body = src.slice(i + 2, end);
      const m = /^([^\s?]+)\s*([\s\S]*)$/.exec(body);
      if (!m) fail(p, i, "A processing instruction needs a name, as in <?name ...?>.");
      const target = (m as RegExpExecArray)[1] as string;
      const data = (m as RegExpExecArray)[2] as string;
      if (target.toLowerCase() === "xml") {
        if (i !== 0) fail(p, i, "The XML declaration (<?xml ...?>) must be the very first thing in the file, with nothing before it.");
        const version = /version\s*=\s*(["'])([^"']*)\1/.exec(data);
        if (!version) fail(p, i, 'The XML declaration needs a version, as in <?xml version="1.0"?>.');
        encoding = /encoding\s*=\s*(["'])([^"']*)\1/.exec(data)?.[2];
      } else if (!isXmlName(target)) fail(p, i + 2, `"${target}" is not a valid name for a processing instruction.`);
      append({ type: "pi", target, data: data.replace(/\s+$/, "") });
      i = end + 2;
    } else if (src.startsWith("</", i)) {
      NAME_RE.lastIndex = i + 2;
      const named = NAME_RE.exec(src);
      if (!named) fail(p, i, "A closing tag needs a name, as in </name>.");
      const name = (named as RegExpExecArray)[0];
      const k = skipSpace(i + 2 + name.length);
      if (src[k] !== ">") fail(p, k, `The closing tag </${name} is missing its >.`);
      const open = stack.pop();
      if (!open) fail(p, i, `The closing tag </${name}> has no matching opening tag.`);
      const opened = open as XmlElement;
      if (opened.name !== name) {
        fail(p, i, `Expected </${opened.name}> to close the tag opened on line ${opened.line}, but found </${name}>.`);
      }
      for (const prefix of declaredByElement.pop() ?? []) bindings.set(prefix, (bindings.get(prefix) ?? 1) - 1);
      i = k + 1;
    } else if (src.startsWith("<!", i)) {
      fail(p, i, "This markup is not supported. Comments are <!-- -->, text blocks are <![CDATA[ ]]>, and the DOCTYPE is <!DOCTYPE ...>.");
    } else {
      // A start tag.
      NAME_RE.lastIndex = i + 1;
      const named = NAME_RE.exec(src);
      if (!named) fail(p, i, "A < must be followed by a tag name. To write a less-than sign in text, use &lt;.");
      const name = (named as RegExpExecArray)[0];
      let k = i + 1 + name.length;
      const attrs: XmlAttr[] = [];
      const seen = new Set<string>();
      const declares: string[] = [];
      let selfClosing = false;
      for (;;) {
        const afterSpace = skipSpace(k);
        const spaced = afterSpace > k;
        k = afterSpace;
        if (k >= n) fail(p, i, `The tag <${name} is never finished. It needs a >.`);
        const c = src[k] as string;
        if (c === ">") {
          k++;
          break;
        }
        if (c === "/") {
          if (src[k + 1] !== ">") fail(p, k, "A / inside a tag must be followed by > to make it self-closing, as in <name/>.");
          selfClosing = true;
          k += 2;
          break;
        }
        if (!spaced) fail(p, k, `Attributes need a space before them. Check the text just after "${src.slice(Math.max(i, k - 12), k)}".`);
        NAME_RE.lastIndex = k;
        const attrName = NAME_RE.exec(src);
        if (!attrName) fail(p, k, `"${c}" is not allowed here. Inside a tag, write attributes as name="value".`);
        const aname = (attrName as RegExpExecArray)[0];
        let q = skipSpace(k + aname.length);
        if (src[q] !== "=") fail(p, q < n ? q : k, `The attribute "${aname}" needs a value, as in ${aname}="...".`);
        q = skipSpace(q + 1);
        const quote = src[q];
        if (quote !== '"' && quote !== "'") fail(p, q < n ? q : k, `The value of "${aname}" must be in quotes.`);
        const close = src.indexOf(quote, q + 1);
        if (close === -1) fail(p, q, `The value of "${aname}" is never closed. It needs a closing ${quote}.`);
        const raw = src.slice(q + 1, close);
        const lt = raw.indexOf("<");
        if (lt !== -1) fail(p, q + 1 + lt, `The value of "${aname}" contains a <. Write &lt; instead.`);
        if (seen.has(aname)) fail(p, k, `The attribute "${aname}" appears twice on <${name}>.`);
        seen.add(aname);
        const value = decode(p, raw, q + 1, declared);
        attrs.push({ name: aname, value, raw, quote: quote as '"' | "'" });
        if (aname.startsWith("xmlns:")) declares.push(aname.slice(6));
        k = close + 1;
      }

      if (stack.length === 0 && root) fail(p, i, `A file can have only one root element, but <${name}> starts a second one after </${(root as XmlElement).name}>.`);

      const line = positionAt(p, i).line;
      const el: XmlElement = { type: "element", name, attrs, children: [], selfClosing, line };
      for (const prefix of declares) bindings.set(prefix, (bindings.get(prefix) ?? 0) + 1);
      checkPrefix(name, i);
      for (const a of attrs) if (!a.name.startsWith("xmlns")) checkPrefix(a.name, i);
      stats.elements++;
      stats.attributes += attrs.length;
      if (stack.length === 0) root = el;
      else (stack[stack.length - 1] as XmlElement).children.push(el);
      if (selfClosing) {
        for (const prefix of declares) bindings.set(prefix, (bindings.get(prefix) ?? 1) - 1);
        stats.maxDepth = Math.max(stats.maxDepth, stack.length + 1);
      } else {
        stack.push(el);
        declaredByElement.push(declares);
        stats.maxDepth = Math.max(stats.maxDepth, stack.length);
      }
      i = k;
    }
  }

  const unclosed = stack[stack.length - 1];
  if (unclosed) fail(p, n, `The tag <${unclosed.name}> opened on line ${unclosed.line} is never closed. It needs </${unclosed.name}>.`);
  if (!root) fail(p, n, "There is no root element. An XML file needs at least one tag, such as <root></root>.");
  return { before, root, after, warnings, stats, encoding };
}

/* ----------------------------------------------------------------------------------------------- */
/* Writing                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

export type IndentChoice = 2 | 4 | "tab";

export interface WriteOptions {
  /** Spaces per level, "tab", or `null` to shrink to one line. */
  indent: IndentChoice | null;
  /** Keep comments when shrinking. They are always kept when formatting. */
  keepComments?: boolean;
}

const hasContentText = (node: XmlNode) => (node.type === "text" ? /[^ \t\r\n]/.test(node.raw) : node.type === "cdata");

/** How an element's content is laid out: `inline` (text only), `raw` (mixed text and tags, kept exactly) or `block` (tags only, one per line). */
function layoutOf(el: XmlElement): "empty" | "inline" | "raw" | "block" {
  if (el.children.length === 0) return "empty";
  let text = false;
  let other = false;
  for (const child of el.children) {
    if (hasContentText(child)) text = true;
    else if (child.type !== "text") other = true;
  }
  if (text && other) return "raw";
  if (text) return "inline";
  // Only tags, comments and whitespace. Whitespace-only text between tags is formatting, not content.
  return other ? "block" : "inline";
}

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string, quote: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(new RegExp(quote, "g"), quote === '"' ? "&quot;" : "&apos;");

function openTag(el: XmlElement): string {
  let s = `<${el.name}`;
  for (const a of el.attrs) s += ` ${a.name}=${a.quote}${a.raw}${a.quote}`;
  return s;
}

type Task = { node: XmlNode; depth: number; raw: boolean } | { text: string };

/** Writes a parsed document back out, formatted or shrunk. Iterative, and refuses output that would be unreasonably large. */
export function writeXml(doc: Pick<XmlDocument, "before" | "root" | "after">, options: WriteOptions): string {
  const unit = options.indent === null ? "" : options.indent === "tab" ? "\t" : " ".repeat(options.indent);
  const pretty = options.indent !== null;
  const keepComments = pretty || options.keepComments === true;
  const parts: string[] = [];
  let size = 0;
  const emit = (s: string) => {
    parts.push(s);
    size += s.length;
    if (size > XML_LIMITS.maxOutputChars) {
      throw new XmlError("The result would be too large. This usually means the tags are nested extremely deeply. Shrink the file instead of formatting it.", 1, 1);
    }
  };

  const top: XmlNode[] = [...doc.before, doc.root, ...doc.after];
  const tasks: Task[] = [];
  for (let k = top.length - 1; k >= 0; k--) tasks.push({ node: top[k] as XmlNode, depth: 0, raw: false });

  while (tasks.length > 0) {
    const task = tasks.pop() as Task;
    if ("text" in task) {
      emit(task.text);
      continue;
    }
    const { node, depth, raw } = task;
    const ind = raw || !pretty ? "" : unit.repeat(depth);
    const nl = raw || !pretty ? "" : "\n";
    switch (node.type) {
      case "text":
        // Whitespace between tags is dropped outside raw content; text inside raw content is written exactly.
        if (raw) emit(node.raw);
        break;
      case "cdata":
        emit(`<![CDATA[${node.value}]]>`);
        if (!raw) emit(nl);
        break;
      case "comment":
        if (raw || keepComments) emit(`${ind}<!--${node.value}-->${nl}`);
        break;
      case "pi":
        emit(`${ind}<?${node.target}${node.data ? ` ${node.data}` : ""}?>${raw ? "" : pretty ? "\n" : ""}`);
        break;
      case "doctype":
        emit(`${node.raw}${pretty ? "\n" : ""}`);
        break;
      case "element": {
        const layout = raw ? "raw" : layoutOf(node);
        const open = openTag(node);
        if (layout === "empty") {
          emit(`${ind}${node.selfClosing ? `${open}/>` : `${open}></${node.name}>`}${nl}`);
        } else if (layout === "inline" || layout === "raw") {
          emit(`${ind}${open}>`);
          tasks.push({ text: `</${node.name}>${nl}` });
          for (let k = node.children.length - 1; k >= 0; k--) tasks.push({ node: node.children[k] as XmlNode, depth: depth + 1, raw: true });
        } else {
          emit(`${ind}${open}>${nl}`);
          tasks.push({ text: `${ind}</${node.name}>${nl}` });
          for (let k = node.children.length - 1; k >= 0; k--) {
            const child = node.children[k] as XmlNode;
            if (child.type === "text") continue;
            tasks.push({ node: child, depth: depth + 1, raw: false });
          }
        }
        break;
      }
    }
  }
  const out = parts.join("");
  return pretty ? out.replace(/\n+$/, "\n") : out;
}

/* ----------------------------------------------------------------------------------------------- */
/* The four things the tool does with XML text                                                      */
/* ----------------------------------------------------------------------------------------------- */

export function formatXml(source: string, indent: IndentChoice = 2): string {
  return writeXml(parseXml(source), { indent });
}

export function minifyXml(source: string, options: { keepComments?: boolean } = {}): string {
  return writeXml(parseXml(source), { indent: null, keepComments: options.keepComments });
}

export interface XmlValidation {
  valid: true;
  root: string;
  elements: number;
  attributes: number;
  maxDepth: number;
  comments: number;
  encoding?: string;
  warnings: XmlWarning[];
}

/** Checks that a file is well-formed XML. Throws an `XmlError` with the position of the first problem otherwise. */
export function validateXml(source: string): XmlValidation {
  const doc = parseXml(source);
  return { valid: true, root: doc.root.name, elements: doc.stats.elements, attributes: doc.stats.attributes, maxDepth: doc.stats.maxDepth, comments: doc.stats.comments, encoding: doc.encoding, warnings: doc.warnings };
}

/** A short, readable report for the Validate mode. */
export function describeValidation(v: XmlValidation): string {
  const lines = [
    "This is well-formed XML.",
    "",
    `Root element: <${v.root}>`,
    `Elements: ${v.elements.toLocaleString("en-US")}`,
    `Attributes: ${v.attributes.toLocaleString("en-US")}`,
    `Comments: ${v.comments.toLocaleString("en-US")}`,
    `Deepest nesting: ${v.maxDepth.toLocaleString("en-US")}`,
  ];
  if (v.encoding) lines.push(`Declared encoding: ${v.encoding}`);
  if (v.warnings.length) {
    lines.push("", "Worth a look:");
    for (const w of v.warnings) lines.push(`- Line ${w.line}: ${w.message}`);
  }
  return lines.join("\n");
}

/* ----------------------------------------------------------------------------------------------- */
/* XML to JSON and back                                                                             */
/* ----------------------------------------------------------------------------------------------- */

export interface JsonConvertOptions {
  /** Spaces per level, "tab", or 0 for one line. Default 2. */
  indent?: number | "tab";
  /** Put attributes under keys that start with this. Default "@". */
  attributePrefix?: string;
  /** Key for text that sits next to attributes or tags. Default "#text". */
  textKey?: string;
}

const DEFAULT_PREFIX = "@";
const DEFAULT_TEXT_KEY = "#text";

function textOf(el: XmlElement): string {
  let s = "";
  for (const child of el.children) {
    if (child.type === "text") s += child.value;
    else if (child.type === "cdata") s += child.value;
  }
  return s;
}

function elementToJson(el: XmlElement, prefix: string, textKey: string, depth: number): unknown {
  if (depth > XML_LIMITS.maxConvertDepth) {
    throw new XmlError(`The tags are nested more than ${XML_LIMITS.maxConvertDepth} levels deep, which is too deep to convert to JSON.`, el.line, 1);
  }
  const childElements = el.children.filter((c): c is XmlElement => c.type === "element");
  if (el.attrs.length === 0 && childElements.length === 0) {
    const text = textOf(el);
    return text === "" ? null : text;
  }
  // No prototype, so an element called __proto__ is an ordinary key instead of changing the object.
  const out: Record<string, unknown> = Object.create(null);
  for (const a of el.attrs) out[prefix + a.name] = a.value;
  for (const child of childElements) {
    const value = elementToJson(child, prefix, textKey, depth + 1);
    if (Object.prototype.hasOwnProperty.call(out, child.name)) {
      const existing = out[child.name];
      // A second element with the same name turns the value into a list.
      if (Array.isArray(existing) && listed.has(existing)) existing.push(value);
      else {
        const list: unknown[] = [existing, value];
        listed.add(list);
        out[child.name] = list;
      }
    } else out[child.name] = value;
  }
  const text = textOf(el).trim();
  if (text !== "") out[textKey] = text;
  return out;
}

/** Lists made by this converter, so a JSON array value is never confused with a repeated element. */
const listed = new WeakSet<unknown[]>();

/** Reads XML and writes it as JSON. Attributes get a prefix, repeated tags become lists, comments are dropped, and every value stays text. */
export function xmlToJson(source: string, options: JsonConvertOptions = {}): string {
  const doc = parseXml(source);
  const prefix = options.attributePrefix ?? DEFAULT_PREFIX;
  const textKey = options.textKey ?? DEFAULT_TEXT_KEY;
  if (doc.stats.maxDepth > XML_LIMITS.maxConvertDepth) {
    throw new XmlError(`The tags are nested ${doc.stats.maxDepth.toLocaleString("en-US")} levels deep. That is too deep to convert to JSON, which handles up to ${XML_LIMITS.maxConvertDepth}.`, doc.root.line, 1);
  }
  const value = { [doc.root.name]: elementToJson(doc.root, prefix, textKey, 1) };
  return JSON.stringify(value, null, options.indent === "tab" ? "\t" : (options.indent ?? 2));
}

export interface FromJsonOptions extends JsonConvertOptions {
  /** Name of the root element when the JSON has several top-level keys, or is a list or a plain value. */
  rootName?: string;
  /** Add `<?xml version="1.0" encoding="UTF-8"?>`. Default true. */
  declaration?: boolean;
}

function checkName(name: string, what: string): void {
  if (!isXmlName(name)) {
    throw new Error(`"${name}" cannot be used as ${what}. XML names start with a letter or underscore and contain only letters, digits, hyphens, underscores, dots and colons.`);
  }
}

function scalarText(value: unknown, where: string): string {
  if (typeof value === "string") {
    const bad = BAD_CONTROL.exec(value);
    if (bad) throw new Error(`The value at ${where} contains the character U+${(bad[0].codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")}, which XML cannot hold.`);
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new Error(`The value at ${where} cannot be written as text.`);
}

function jsonToElement(name: string, value: unknown, prefix: string, textKey: string, depth: number, where: string): XmlElement {
  if (depth > XML_LIMITS.maxConvertDepth) throw new Error(`The JSON is nested more than ${XML_LIMITS.maxConvertDepth} levels deep, which is too deep to convert to XML.`);
  checkName(name, "an element name");
  const el: XmlElement = { type: "element", name, attrs: [], children: [], selfClosing: false, line: 1 };
  if (value === null || value === undefined) {
    el.selfClosing = true;
    return el;
  }
  if (Array.isArray(value)) throw new Error(`The list at ${where} is inside another list, which XML cannot show. Give each inner list a name.`);
  if (typeof value !== "object") {
    const text = scalarText(value, where);
    if (text !== "") el.children.push({ type: "text", raw: escapeText(text), value: text });
    else el.selfClosing = false;
    return el;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const textEntry = entries.find(([k]) => k === textKey);
  if (textEntry && textEntry[1] !== null) {
    const text = scalarText(textEntry[1], `${where}.${textKey}`);
    el.children.push({ type: "text", raw: escapeText(text), value: text });
  }
  for (const [key, child] of entries) {
    if (key === textKey) continue;
    if (key.startsWith(prefix) && prefix !== "") {
      const attrName = key.slice(prefix.length);
      checkName(attrName, "an attribute name");
      const text = child === null ? "" : scalarText(child, `${where}.${key}`);
      el.attrs.push({ name: attrName, value: text, raw: escapeAttr(text, '"'), quote: '"' });
      continue;
    }
    const items = Array.isArray(child) ? child : [child];
    items.forEach((item, index) => {
      const label = Array.isArray(child) ? `${where}.${key}[${index}]` : `${where}.${key}`;
      el.children.push(jsonToElement(key, item, prefix, textKey, depth + 1, label));
    });
  }
  if (el.children.length === 0) el.selfClosing = true;
  return el;
}

/** Reads JSON and writes it as XML. The reverse of `xmlToJson` for data that came from it; other JSON is wrapped in a root element. */
export function jsonToXml(source: string, options: FromJsonOptions = {}): string {
  if (source.length > XML_LIMITS.maxChars) throw new Error(`The JSON has ${(source.length / 1e6).toFixed(1)} million characters. The limit is ${XML_LIMITS.maxChars / 1e6} million.`);
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch (err) {
    throw new Error(`This is not valid JSON. ${err instanceof Error ? err.message : ""}`.trim());
  }
  const prefix = options.attributePrefix ?? DEFAULT_PREFIX;
  const textKey = options.textKey ?? DEFAULT_TEXT_KEY;
  const rootName = options.rootName?.trim() || "root";
  let root: XmlElement;
  const keys = data !== null && typeof data === "object" && !Array.isArray(data) ? Object.keys(data as object) : [];
  if (keys.length === 1 && keys[0] !== textKey && !(prefix !== "" && (keys[0] as string).startsWith(prefix)) && !Array.isArray((data as Record<string, unknown>)[keys[0] as string])) {
    root = jsonToElement(keys[0] as string, (data as Record<string, unknown>)[keys[0] as string], prefix, textKey, 1, keys[0] as string);
  } else if (Array.isArray(data)) {
    root = jsonToElement(rootName, { item: data }, prefix, textKey, 1, rootName);
  } else {
    root = jsonToElement(rootName, data, prefix, textKey, 1, rootName);
  }
  const before: XmlNode[] = options.declaration === false ? [] : [{ type: "pi", target: "xml", data: 'version="1.0" encoding="UTF-8"' }];
  return writeXml({ before, root, after: [] }, { indent: options.indent === 4 ? 4 : options.indent === 0 ? null : options.indent === "tab" ? "tab" : 2 });
}
