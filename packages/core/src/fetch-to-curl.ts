/**
 * Turn a JavaScript `fetch(...)` call into a cURL command. The reverse of curl-to-fetch.
 * Keep this file free of React, the DOM and the network.
 *
 * The pasted code is only ever read as text and is never evaluated. A small reader understands the parts of JavaScript
 * that describe a request: strings, template literals, `+` joins, numbers, objects, arrays, `JSON.stringify`,
 * `new Headers`, `new URLSearchParams` and `new FormData` with `.append`. Anything else (a variable, a function call)
 * is kept as `${name}` and the output says so.
 */

export interface FetchToCurlOptions {
  /** Put each option on its own line, joined with backslashes. */
  multiline?: boolean;
  /** Add -L, because fetch follows redirects by default and curl does not. */
  followRedirects?: boolean;
  /** Add --compressed, which asks for gzip and friends like a browser does. */
  compressed?: boolean;
}

export type FetchBody =
  | { kind: "text"; value: string; implicitType?: string }
  | { kind: "form"; fields: { name: string; value: string; file?: boolean }[] };

export interface ParsedFetch {
  url: string;
  method: string;
  headers: { name: string; value: string }[];
  body?: FetchBody;
  followRedirects: boolean;
  warnings: string[];
}

// --- A small reader for JavaScript values --------------------------------------------------------------------------

type Value =
  | { t: "str"; v: string }
  | { t: "num"; v: number }
  | { t: "bool"; v: boolean }
  | { t: "null" }
  | { t: "undef" }
  | { t: "arr"; items: Value[] }
  | { t: "obj"; entries: { key: string; value: Value }[] }
  | { t: "json"; arg: Value; space: number | string | undefined }
  | { t: "params"; arg: Value | undefined }
  | { t: "headers"; arg: Value | undefined }
  | { t: "formdata" }
  | { t: "expr"; src: string };

const hole = (src: string) => `\${${src.replace(/\s+/g, " ").trim()}}`;

class Reader {
  pos = 0;
  readonly warnings = new Set<string>();

  constructor(readonly src: string, start = 0) {
    this.pos = start;
  }

  private ws() {
    const s = this.src;
    for (;;) {
      const c = s[this.pos];
      if (c === undefined) return;
      if (/\s/.test(c)) this.pos++;
      else if (c === "/" && s[this.pos + 1] === "/") while (this.pos < s.length && s[this.pos] !== "\n") this.pos++;
      else if (c === "/" && s[this.pos + 1] === "*") {
        const end = s.indexOf("*/", this.pos + 2);
        this.pos = end === -1 ? s.length : end + 2;
      } else return;
    }
  }

  peek(): string | undefined {
    this.ws();
    return this.src[this.pos];
  }

  eat(ch: string): boolean {
    if (this.peek() === ch) {
      this.pos++;
      return true;
    }
    return false;
  }

  private startsWith(word: string): boolean {
    this.ws();
    if (!this.src.startsWith(word, this.pos)) return false;
    return !/[A-Za-z0-9_$]/.test(this.src[this.pos + word.length] ?? "");
  }

  /** Read a quoted string starting at the opening quote. Returns the text. */
  private quoted(): string {
    const s = this.src;
    const quote = s[this.pos] as string;
    this.pos++;
    let out = "";
    while (this.pos < s.length) {
      const c = s[this.pos] as string;
      if (c === quote) {
        this.pos++;
        return out;
      }
      if (c === "\\") out += this.escape();
      else {
        out += c;
        this.pos++;
      }
    }
    throw new Error("A string in the code is not closed. Check that every quote has a partner.");
  }

  /** Read one escape sequence at a backslash. */
  private escape(): string {
    const s = this.src;
    const n = s[this.pos + 1];
    this.pos += 2;
    switch (n) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "v":
        return "\v";
      case "0":
        return "\0";
      case "\n":
        return "";
      case "x": {
        const hex = /^[0-9a-fA-F]{2}/.exec(s.slice(this.pos, this.pos + 2))?.[0];
        if (!hex) return "x";
        this.pos += 2;
        return String.fromCharCode(parseInt(hex, 16));
      }
      case "u": {
        if (s[this.pos] === "{") {
          const end = s.indexOf("}", this.pos);
          const code = end === -1 ? NaN : parseInt(s.slice(this.pos + 1, end), 16);
          if (Number.isNaN(code) || code > 0x10ffff) return "u";
          this.pos = end + 1;
          return String.fromCodePoint(code);
        }
        const hex = /^[0-9a-fA-F]{4}/.exec(s.slice(this.pos, this.pos + 4))?.[0];
        if (!hex) return "u";
        this.pos += 4;
        return String.fromCharCode(parseInt(hex, 16));
      }
      default:
        return n ?? "";
    }
  }

  /** A template literal. `${expr}` parts are kept as text so the output can point them out. */
  private template(): string {
    const s = this.src;
    this.pos++;
    let out = "";
    while (this.pos < s.length) {
      const c = s[this.pos] as string;
      if (c === "`") {
        this.pos++;
        return out;
      }
      if (c === "\\") out += this.escape();
      else if (c === "$" && s[this.pos + 1] === "{") {
        const start = this.pos + 2;
        this.pos = start;
        let depth = 1;
        while (this.pos < s.length && depth > 0) {
          const d = s[this.pos] as string;
          if (d === "'" || d === '"' || d === "`") {
            const inner = new Reader(s, this.pos);
            inner.skipQuotedForScan();
            this.pos = inner.pos;
            continue;
          }
          if (d === "{") depth++;
          else if (d === "}") depth--;
          this.pos++;
        }
        out += hole(s.slice(start, this.pos - 1));
      } else {
        out += c;
        this.pos++;
      }
    }
    throw new Error("A template string in the code is not closed. Check the backticks.");
  }

  /** Move past a quoted string or template without interpreting it. */
  skipQuotedForScan() {
    const s = this.src;
    const quote = s[this.pos] as string;
    this.pos++;
    while (this.pos < s.length) {
      const c = s[this.pos] as string;
      if (c === "\\") this.pos += 2;
      else if (c === quote) {
        this.pos++;
        return;
      } else if (quote === "`" && c === "$" && s[this.pos + 1] === "{") {
        this.pos += 2;
        let depth = 1;
        while (this.pos < s.length && depth > 0) {
          const d = s[this.pos] as string;
          if (d === "'" || d === '"' || d === "`") this.skipQuotedForScan();
          else {
            if (d === "{") depth++;
            else if (d === "}") depth--;
            this.pos++;
          }
        }
      } else this.pos++;
    }
  }

  /** Read an arbitrary expression up to a top-level `,`, closing bracket, `;` or `+`, and return its source. */
  private rawExpression(): string {
    const s = this.src;
    const start = this.pos;
    let depth = 0;
    while (this.pos < s.length) {
      const c = s[this.pos] as string;
      if (c === "'" || c === '"' || c === "`") {
        this.skipQuotedForScan();
        continue;
      }
      if (c === "/" && (s[this.pos + 1] === "/" || s[this.pos + 1] === "*")) {
        this.ws();
        continue;
      }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) break;
        depth--;
      } else if (depth === 0 && (c === "," || c === ";" || (c === "+" && s[this.pos + 1] !== "+" && s[this.pos - 1] !== "+"))) break;
      this.pos++;
    }
    return s.slice(start, this.pos).trim();
  }

  /** A full value, including `a + b + c` joins. */
  expression(): Value {
    let first = this.primary();
    if (this.peek() !== "+") return first;
    let text = valueText(first);
    while (this.peek() === "+") {
      this.pos++;
      text += valueText(this.primary());
    }
    first = { t: "str", v: text };
    return first;
  }

  private primary(): Value {
    const c = this.peek();
    const s = this.src;
    if (c === undefined) throw new Error("The code ends before the fetch call is complete.");
    if (c === '"' || c === "'") return { t: "str", v: this.quoted() };
    if (c === "`") return { t: "str", v: this.template() };
    if (c === "{") return this.object();
    if (c === "[") return this.array();
    if (c === "(") {
      // A parenthesised expression: read it whole and keep it as a placeholder.
      return { t: "expr", src: this.rawExpression() };
    }
    const number = /^-?(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/.exec(s.slice(this.pos, this.pos + 40));
    if (number && !/[A-Za-z_$]/.test(s[this.pos + number[0].length] ?? "")) {
      this.pos += number[0].length;
      return { t: "num", v: Number(number[0]) };
    }
    if (this.startsWith("true")) return (this.pos += 4), { t: "bool", v: true };
    if (this.startsWith("false")) return (this.pos += 5), { t: "bool", v: false };
    if (this.startsWith("null")) return (this.pos += 4), { t: "null" };
    if (this.startsWith("undefined")) return (this.pos += 9), { t: "undef" };
    if (this.startsWith("JSON")) {
      const m = /^JSON\s*\.\s*stringify\s*\(/.exec(s.slice(this.pos));
      if (m) {
        this.pos += m[0].length;
        const arg = this.expression();
        let space: number | string | undefined;
        if (this.eat(",")) {
          this.expression(); // replacer, ignored
          if (this.eat(",")) {
            const sp = this.expression();
            if (sp.t === "num") space = sp.v;
            else if (sp.t === "str") space = sp.v;
          }
        }
        this.eat(",");
        this.close();
        return { t: "json", arg, space };
      }
    }
    if (this.startsWith("new")) {
      const m = /^new\s+(Headers|URLSearchParams|FormData)\s*\(/.exec(s.slice(this.pos));
      if (m) {
        this.pos += m[0].length;
        const arg = this.peek() === ")" ? undefined : this.expression();
        this.eat(",");
        this.close();
        const kind = m[1];
        if (kind === "FormData") return { t: "formdata" };
        return kind === "Headers" ? { t: "headers", arg } : { t: "params", arg };
      }
    }
    return { t: "expr", src: this.rawExpression() };
  }

  close() {
    if (!this.eat(")")) throw new Error("A bracket in the code is not closed. Check that every ( has a partner.");
  }

  private object(): Value {
    this.pos++; // {
    const entries: { key: string; value: Value }[] = [];
    for (;;) {
      const c = this.peek();
      if (c === undefined) throw new Error("An object in the code is not closed. Check that every { has a partner.");
      if (c === "}") {
        this.pos++;
        break;
      }
      if (this.src.startsWith("...", this.pos)) {
        this.pos += 3;
        this.warnings.add(`“...${this.rawExpression()}” is spread into an object, so what it adds could not be read.`);
      } else {
        let key: string | null = null;
        if (c === '"' || c === "'") key = this.quoted();
        else if (c === "[") {
          this.pos++;
          const computed = this.rawExpression();
          this.eat("]");
          this.warnings.add(`The computed key [${computed}] could not be read, so that entry was skipped.`);
        } else {
          const id = /^[A-Za-z0-9_$-]+/.exec(this.src.slice(this.pos));
          if (!id) throw new Error(`Unexpected “${c}” in an object. Expected a key such as method or "Content-Type".`);
          this.pos += id[0].length;
          key = id[0];
        }
        if (this.eat(":")) {
          const value = this.expression();
          if (key !== null) entries.push({ key, value });
        } else if (this.peek() === "(") {
          this.rawExpression();
          this.warnings.add(`The method “${key}” in an object was skipped.`);
        } else if (key !== null) {
          entries.push({ key, value: { t: "expr", src: key } }); // shorthand: { body }
        }
      }
      if (!this.eat(",") && this.peek() !== "}") {
        if (this.peek() === undefined) throw new Error("An object in the code is not closed. Check that every { has a partner.");
        throw new Error("Expected a comma or a closing } in an object.");
      }
    }
    return { t: "obj", entries };
  }

  private array(): Value {
    this.pos++; // [
    const items: Value[] = [];
    for (;;) {
      const c = this.peek();
      if (c === undefined) throw new Error("A list in the code is not closed. Check that every [ has a partner.");
      if (c === "]") {
        this.pos++;
        break;
      }
      if (this.src.startsWith("...", this.pos)) {
        this.pos += 3;
        this.warnings.add(`“...${this.rawExpression()}” is spread into a list, so what it adds could not be read.`);
      } else items.push(this.expression());
      if (!this.eat(",") && this.peek() !== "]") {
        if (this.peek() === undefined) throw new Error("A list in the code is not closed. Check that every [ has a partner.");
        throw new Error("Expected a comma or a closing ] in a list.");
      }
    }
    return { t: "arr", items };
  }
}

/** The text a value has when joined into a string. Variables become `${name}`. */
function valueText(v: Value): string {
  switch (v.t) {
    case "str":
      return v.v;
    case "num":
      return String(v.v);
    case "bool":
      return String(v.v);
    case "null":
      return "null";
    case "undef":
      return "undefined";
    case "expr":
      return hole(v.src);
    default:
      return hole("value");
  }
}

/** A value as plain data, for JSON.stringify. Variables become "${name}" strings. */
function toData(v: Value): unknown {
  switch (v.t) {
    case "str":
      return v.v;
    case "num":
    case "bool":
      return v.v;
    case "null":
      return null;
    case "undef":
      return undefined;
    case "arr":
      return v.items.map((item) => toData(item) ?? null);
    case "obj": {
      const out: Record<string, unknown> = {};
      for (const e of v.entries) {
        const data = toData(e.value);
        if (data !== undefined) out[e.key] = data;
      }
      return out;
    }
    case "expr":
      return hole(v.src);
    default:
      return hole("value");
  }
}

// --- Finding the call ----------------------------------------------------------------------------------------------

/** The index just after the `(` of the first `fetch(` that is real code, not inside a string or comment. */
function findFetchCall(code: string): number {
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i] as string;
    if (c === "/" && code[i + 1] === "/") {
      while (i < n && code[i] !== "\n") i++;
    } else if (c === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      const r = new Reader(code, i);
      r.skipQuotedForScan();
      i = r.pos;
    } else if (/[A-Za-z_$]/.test(c) && !/[A-Za-z0-9_$]/.test(code[i - 1] ?? "")) {
      const word = /^[A-Za-z0-9_$]+/.exec(code.slice(i))![0];
      if (word === "fetch") {
        const after = /^\s*\(/.exec(code.slice(i + 5));
        const before = code.slice(Math.max(0, i - 12), i);
        const member = /\.\s*$/.test(before);
        if (after && (!member || /(?:window|globalThis|self)\s*\.\s*$/.test(before))) return i + 5 + after[0].length;
      }
      i += word.length;
    } else i++;
  }
  return -1;
}

const METHOD = /^[A-Za-z]+$/;

/** `.append("name", value)` calls on a FormData variable. */
function collectFormData(code: string, name: string, warnings: Set<string>): { name: string; value: string; file?: boolean }[] {
  const fields: { name: string; value: string; file?: boolean }[] = [];
  const re = new RegExp(`(?<![A-Za-z0-9_$.])${name.replace(/[$]/g, "\\$")}\\s*\\.\\s*(?:append|set)\\s*\\(`, "g");
  for (const m of code.matchAll(re)) {
    const reader = new Reader(code, (m.index ?? 0) + m[0].length);
    try {
      const key = reader.expression();
      if (!reader.eat(",")) continue;
      const value = reader.expression();
      const label = valueText(key);
      if (value.t === "str" || value.t === "num" || value.t === "bool") fields.push({ name: label, value: valueText(value) });
      else {
        fields.push({ name: label, value: value.t === "expr" ? value.src : "file", file: true });
        warnings.add("A form field holds a file or a variable. It is written as a file upload (@name); replace the name with the path of a real file.");
      }
    } catch {
      warnings.add("A formData.append call could not be read and was skipped.");
    }
  }
  return fields;
}

/** Form-encode like URLSearchParams does. */
const formEncode = (s: string) => encodeURIComponent(s).replace(/%20/g, "+").replace(/[!'()~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function pairsOf(value: Value | undefined, warnings: Set<string>, what: string): { name: string; value: string }[] {
  if (!value) return [];
  if (value.t === "headers" || value.t === "params") return pairsOf(value.arg, warnings, what);
  if (value.t === "obj") return value.entries.map((e) => ({ name: e.key, value: valueText(e.value) }));
  if (value.t === "arr") {
    const out: { name: string; value: string }[] = [];
    for (const item of value.items) {
      if (item.t === "arr" && item.items.length >= 2) out.push({ name: valueText(item.items[0] as Value), value: valueText(item.items[1] as Value) });
      else warnings.add(`An entry in the ${what} list was not a [name, value] pair and was skipped.`);
    }
    return out;
  }
  if (value.t === "expr") {
    warnings.add(`The ${what} come from ${hole(value.src)}, which could not be read, so they were left out.`);
    return [];
  }
  return [];
}

// --- Parser --------------------------------------------------------------------------------------------------------

/** Read the first fetch call in some JavaScript. Throws readable errors. */
export function parseFetch(code: string): ParsedFetch {
  if (!code.trim()) throw new Error("Paste some JavaScript that contains a fetch call, for example: fetch(\"https://example.com\")");
  const at = findFetchCall(code);
  if (at === -1) throw new Error("No fetch( call found. Paste code that contains fetch(url, options).");

  const reader = new Reader(code, at);
  const warnings = reader.warnings;
  let urlValue: Value;
  let init: Value | undefined;

  if (reader.peek() === ")") throw new Error("fetch() needs an address. Add the URL as the first argument.");
  const first = reader.expression();
  if (first.t === "expr" && /^new\s+Request\s*\(/.test(first.src)) {
    // fetch(new Request(url, init)): read the Request's arguments instead.
    const inner = new Reader(first.src, first.src.indexOf("(") + 1);
    urlValue = inner.expression();
    if (inner.eat(",")) init = inner.expression();
    for (const w of inner.warnings) warnings.add(w);
  } else {
    urlValue = first;
    if (reader.eat(",") && reader.peek() !== ")") init = reader.expression();
  }
  if (!reader.src.slice(reader.pos).trim().startsWith(")") && reader.peek() === undefined) {
    throw new Error("The fetch call is not closed. Check that every ( has a partner.");
  }

  let url = valueText(urlValue);
  if (urlValue.t !== "str" && urlValue.t !== "expr") url = hole("url");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !url.startsWith("${") && !url.startsWith("/")) url = `http://${url}`;
  if (url.startsWith("/")) warnings.add("The address is relative, so it only works on the page's own site. Put the full address (https://…) in front of it.");

  let method = "GET";
  let headers: { name: string; value: string }[] = [];
  let bodyValue: Value | undefined;
  let redirect = "follow";
  const ignored: string[] = [];
  let credentials: string | undefined;

  if (init) {
    if (init.t === "expr") warnings.add(`The options come from ${hole(init.src)}, which could not be read, so only the address was converted.`);
    else if (init.t === "obj") {
      for (const { key, value } of init.entries) {
        const text = value.t === "str" ? value.v : undefined;
        switch (key) {
          case "method":
            if (value.t === "str" && METHOD.test(value.v)) method = value.v.toUpperCase();
            else warnings.add(`The method ${valueText(value)} is not a plain word, so GET was assumed.`);
            break;
          case "headers":
            headers = pairsOf(value, warnings, "headers");
            break;
          case "body":
            bodyValue = value;
            break;
          case "redirect":
            if (text) redirect = text;
            break;
          case "credentials":
            credentials = text;
            break;
          case "signal":
          case "mode":
          case "cache":
          case "referrer":
          case "referrerPolicy":
          case "integrity":
          case "keepalive":
          case "priority":
          case "duplex":
            ignored.push(key);
            break;
          default:
            warnings.add(`The option “${key}” is not a fetch option that curl can use, so it was ignored.`);
        }
      }
    } else warnings.add("The second argument of fetch() should be an object such as { method: \"POST\" }.");
  }
  if (ignored.length) warnings.add(`These fetch options have no curl equivalent and were left out: ${ignored.join(", ")}.`);
  if (credentials === "include") warnings.add("credentials: \"include\" sends the browser's cookies. Add your own with -b 'name=value'.");

  const has = (name: string) => headers.some((h) => h.name.toLowerCase() === name);
  let body: FetchBody | undefined;
  if (bodyValue && bodyValue.t !== "undef" && bodyValue.t !== "null") {
    switch (bodyValue.t) {
      case "str":
      case "num":
      case "bool":
        body = { kind: "text", value: valueText(bodyValue), implicitType: "text/plain;charset=UTF-8" };
        break;
      case "json": {
        const data = toData(bodyValue.arg);
        body = { kind: "text", value: data === undefined ? "" : JSON.stringify(data, null, bodyValue.space as number | string | undefined), implicitType: "text/plain;charset=UTF-8" };
        break;
      }
      case "params": {
        const arg = bodyValue.arg;
        const value = arg && arg.t === "str" ? arg.v.replace(/^\?/, "") : pairsOf(arg, warnings, "form fields").map((p) => `${formEncode(p.name)}=${formEncode(p.value)}`).join("&");
        body = { kind: "text", value, implicitType: "application/x-www-form-urlencoded;charset=UTF-8" };
        break;
      }
      case "formdata":
        body = { kind: "form", fields: [] };
        warnings.add("The form data is built inline, so its fields could not be read.");
        break;
      case "expr": {
        const name = bodyValue.src;
        if (/^[A-Za-z_$][\w$]*$/.test(name) && new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, "\\$")}\\s*=\\s*new\\s+FormData\\b`).test(code)) {
          body = { kind: "form", fields: collectFormData(code, name, warnings) };
        } else {
          body = { kind: "text", value: hole(name), implicitType: "text/plain;charset=UTF-8" };
          warnings.add(`The body comes from ${hole(name)}, which could not be read. Replace it with the real body.`);
        }
        break;
      }
      default:
        warnings.add("The body is an object or list, which fetch would send as “[object Object]”. Wrap it in JSON.stringify(...).");
        body = { kind: "text", value: "[object Object]", implicitType: "text/plain;charset=UTF-8" };
    }
  }
  if (body?.kind === "form" && body.fields.length === 0 && !warnings.size) warnings.add("No formData.append calls were found for this form.");
  if (body?.kind === "form") {
    const ct = headers.findIndex((h) => h.name.toLowerCase() === "content-type");
    if (ct !== -1 && /multipart\/form-data/i.test(headers[ct]!.value)) {
      headers.splice(ct, 1);
      warnings.add("The Content-Type header was removed because curl must set the multipart boundary itself.");
    }
  }
  if (body && (method === "GET" || method === "HEAD")) warnings.add(`fetch throws an error when a ${method} request has a body. Change the method or remove the body.`);
  if (!has("content-type") && body?.kind === "text" && body.implicitType) headers = [...headers, { name: "Content-Type", value: body.implicitType }];

  const resolved = [url, ...headers.flatMap((h) => [h.name, h.value]), body?.kind === "text" ? body.value : ""];
  if (resolved.some((s) => s.includes("${"))) warnings.add("Parts that come from variables are kept as ${name}. Replace each one with its real value before you run the command.");

  return { url, method, headers, body, followRedirects: redirect === "follow", warnings: [...warnings] };
}

// --- Output --------------------------------------------------------------------------------------------------------

/** Quote for a POSIX shell: single quotes, with embedded single quotes closed and reopened. */
export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Write a cURL command for a parsed fetch call. */
export function generateCurl(parsed: ParsedFetch, options: FetchToCurlOptions = {}): string {
  const { multiline = true, followRedirects = true, compressed = false } = options;
  const parts: string[] = ["curl", shellQuote(parsed.url)];

  const { method, body } = parsed;
  if (method === "HEAD") parts.push("-I");
  else if (!(method === "GET" && !body) && !(method === "POST" && body)) parts.push("-X", method);

  for (const h of parsed.headers) parts.push("-H", shellQuote(`${h.name}: ${h.value}`));

  if (body?.kind === "text") parts.push("--data-raw", shellQuote(body.value));
  else if (body?.kind === "form") {
    for (const f of body.fields) parts.push(f.file ? "-F" : "--form-string", shellQuote(f.file ? `${f.name}=@${f.value}` : `${f.name}=${f.value}`));
  }

  if (followRedirects && parsed.followRedirects) parts.push("-L");
  if (compressed) parts.push("--compressed");

  // Group each flag with its value on one line.
  const lines: string[] = [`${parts[0]} ${parts[1]}`];
  for (let i = 2; i < parts.length; i++) {
    const p = parts[i] as string;
    if (p.startsWith("-") && parts[i + 1] !== undefined && !parts[i + 1]!.startsWith("-") && !["-I", "-L", "--compressed"].includes(p)) {
      lines.push(`${p} ${parts[i + 1]}`);
      i++;
    } else lines.push(p);
  }
  const command = multiline ? lines.join(" \\\n  ") : lines.join(" ");
  const notes = parsed.warnings.map((w) => `# Note: ${w.replace(/\s+/g, " ")}`);
  return notes.length ? `${notes.join("\n")}\n${command}` : command;
}

/** Convert pasted fetch code to a cURL command. */
export function fetchToCurl(code: string, options: FetchToCurlOptions = {}): string {
  try {
    return generateCurl(parseFetch(code), options);
  } catch (err) {
    if (err instanceof RangeError) throw new Error("The code is nested too deeply to read. Simplify the object or list and try again.");
    throw err;
  }
}
