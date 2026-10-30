/** Turn a cURL command into `fetch` code. Keep this file free of React, the DOM and the network. */
import { base64Encode } from "./encoding";

export interface CurlToFetchOptions {
  /** What to do with the response in the generated code. */
  responseAs?: "json" | "text" | "none";
  /** Leave out headers browsers refuse to set from fetch() (Cookie, Referer, Sec-*, …). */
  omitBrowserHeaders?: boolean;
}

export type CurlBody =
  | { kind: "text"; value: string }
  | { kind: "form"; fields: { name: string; value: string; file?: boolean }[] }
  | { kind: "file"; path: string };

export interface ParsedCurl {
  url: string;
  method: string;
  headers: { name: string; value: string }[];
  body?: CurlBody;
  warnings: string[];
}

// --- Tokenizer -------------------------------------------------------------------------------------------

const ANSI_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?" };

/** Read the body of a `$'…'` string starting after the opening quote. Returns the text and the next index. */
function readAnsiC(src: string, start: number): [string, number] {
  let out = "";
  let i = start;
  while (i < src.length) {
    const ch = src[i] as string;
    if (ch === "'") return [out, i + 1];
    if (ch !== "\\") {
      out += ch;
      i++;
      continue;
    }
    const next = src[i + 1];
    if (next === undefined) break;
    if (next in ANSI_ESCAPES) {
      out += ANSI_ESCAPES[next];
      i += 2;
    } else if (next === "x" || next === "u" || next === "U") {
      const max = next === "x" ? 2 : next === "u" ? 4 : 8;
      const hex = /^[0-9a-fA-F]+/.exec(src.slice(i + 2, i + 2 + max))?.[0] ?? "";
      if (!hex) {
        out += `\\${next}`;
        i += 2;
      } else {
        const code = parseInt(hex, 16);
        out += code <= 0x10ffff ? String.fromCodePoint(code) : "�";
        i += 2 + hex.length;
      }
    } else if (/[0-7]/.test(next)) {
      const oct = /^[0-7]{1,3}/.exec(src.slice(i + 1))![0];
      out += String.fromCharCode(parseInt(oct, 8));
      i += 1 + oct.length;
    } else {
      out += `\\${next}`;
      i += 2;
    }
  }
  throw new Error("A quote is not closed. Check that every ' and \" in the command has a partner.");
}

interface Tokens {
  words: string[];
  /** True when the command contained something a shell would have stopped at (a pipe, `;`, `>`…). */
  truncated: boolean;
  /** True when a $VARIABLE was left unexpanded. */
  hasVariable: boolean;
}

/** Split a command line the way a POSIX shell would, without expanding anything. */
export function tokenize(src: string): Tokens {
  const words: string[] = [];
  let current = "";
  let inWord = false;
  let truncated = false;
  let hasVariable = false;
  let i = 0;

  const flush = () => {
    if (inWord) words.push(current);
    current = "";
    inWord = false;
  };

  scan: while (i < src.length) {
    const ch = src[i] as string;
    if (ch === "\\") {
      const next = src[i + 1];
      if (next === "\n") i += 2;
      else if (next === "\r" && src[i + 2] === "\n") i += 3;
      else if (next === undefined) i++;
      else {
        current += next;
        inWord = true;
        i += 2;
      }
    } else if (ch === "'") {
      const end = src.indexOf("'", i + 1);
      if (end === -1) throw new Error("A quote is not closed. Check that every ' and \" in the command has a partner.");
      current += src.slice(i + 1, end);
      inWord = true;
      i = end + 1;
    } else if (ch === '"') {
      i++;
      inWord = true;
      for (;;) {
        if (i >= src.length) throw new Error("A quote is not closed. Check that every ' and \" in the command has a partner.");
        const c = src[i];
        if (c === '"') {
          i++;
          break;
        }
        if (c === "\\" && i + 1 < src.length) {
          const n = src[i + 1];
          if (n === "\n") i += 2;
          else if (n === '"' || n === "\\" || n === "$" || n === "`") {
            current += n;
            i += 2;
          } else {
            current += c;
            i++;
          }
        } else {
          if (c === "$" && /[A-Za-z_{(]/.test(src[i + 1] ?? "")) hasVariable = true;
          current += c;
          i++;
        }
      }
    } else if (ch === "$" && src[i + 1] === "'") {
      const [text, next] = readAnsiC(src, i + 2);
      current += text;
      inWord = true;
      i = next;
    } else if (/\s/.test(ch)) {
      flush();
      i++;
    } else if (ch === "|" || ch === ";" || ch === ">" || ch === "<" || (ch === "&" && src[i + 1] === "&")) {
      truncated = true;
      break scan;
    } else {
      if (ch === "$" && /[A-Za-z_{(]/.test(src[i + 1] ?? "")) hasVariable = true;
      current += ch;
      inWord = true;
      i++;
    }
  }
  flush();
  return { words, truncated, hasVariable };
}

// --- Option tables ---------------------------------------------------------------------------------------

/** Short options that consume a value. */
const SHORT_WITH_VALUE = new Set(["X", "H", "d", "u", "b", "A", "e", "F", "o", "m", "x", "E", "w", "T", "c", "C", "K", "r", "y", "Y", "z", "t", "P", "Q"]);
const LONG_ALIASES: Record<string, string> = {
  request: "X",
  header: "H",
  data: "d",
  "data-ascii": "d",
  user: "u",
  cookie: "b",
  "user-agent": "A",
  referer: "e",
  form: "F",
  head: "I",
  get: "G",
  output: "o",
  "max-time": "m",
  proxy: "x",
  cert: "E",
  "write-out": "w",
  "upload-file": "T",
  "cookie-jar": "c",
  insecure: "k",
};
/** Long options that consume a value but have no special meaning here. */
const LONG_IGNORED_WITH_VALUE = new Set([
  "connect-timeout", "retry", "retry-delay", "retry-max-time", "key", "cacert", "capath", "limit-rate", "resolve", "interface", "proxy-user", "dns-servers",
  "max-redirs", "range", "time-cond", "continue-at", "config", "trace", "trace-ascii", "dump-header", "stderr", "expect100-timeout", "keepalive-time", "pinnedpubkey",
  "cert-type", "key-type", "pass", "ciphers", "connect-to", "unix-socket", "aws-sigv4", "proxy-header", "noproxy", "variable",
]);
/** Long options that take no value and do not change the request. */
const LONG_FLAGS = new Set([
  "compressed", "location", "silent", "show-error", "verbose", "include", "fail", "globoff", "http1.1", "http2", "http3", "no-buffer", "location-trusted", "progress-bar",
  "remote-name", "tr-encoding", "tcp-nodelay", "path-as-is", "no-keepalive", "ipv4", "ipv6", "anyauth", "basic", "digest", "negotiate", "ntlm", "fail-with-body",
  "retry-connrefused", "ssl-reqd", "tlsv1.2", "tlsv1.3", "disable", "no-progress-meter",
]);
const LONG_WITH_VALUE = new Set(["request", "header", "data", "data-ascii", "data-raw", "data-binary", "data-urlencode", "form", "form-string", "user", "cookie", "user-agent", "referer", "url", "json", "output", "max-time", "proxy", "cert", "write-out", "upload-file", "oauth2-bearer", "cookie-jar"]);

/** Header names a browser will not let page code set. They still work in Node.js, Deno and Bun. */
const FORBIDDEN = new Set(["accept-charset", "accept-encoding", "access-control-request-headers", "access-control-request-method", "connection", "content-length", "cookie", "cookie2", "date", "dnt", "expect", "host", "keep-alive", "origin", "referer", "set-cookie", "te", "trailer", "transfer-encoding", "upgrade", "via"]);
export const isBrowserOnlyHeader = (name: string) => {
  const n = name.toLowerCase();
  return FORBIDDEN.has(n) || n.startsWith("sec-") || n.startsWith("proxy-");
};

const encodeForm = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");

// --- Parser ----------------------------------------------------------------------------------------------

/** Parse a cURL command into a request description. Throws readable errors. */
export function parseCurl(command: string): ParsedCurl {
  const text = command.replace(/^\s*\$\s+/, "").trim();
  if (!text) throw new Error("Paste a cURL command to convert, for example: curl https://example.com");

  const { words, truncated, hasVariable } = tokenize(text);
  if (!words.length || !/^curl(\.exe)?$/i.test(words[0] ?? "")) throw new Error("The command should start with “curl”. In Chrome or Firefox, use “Copy as cURL” in the network panel.");

  const warnings = new Set<string>();
  if (truncated) warnings.add("Everything after a pipe, redirect or “;” was ignored, as it is not part of the request.");
  if (hasVariable) warnings.add("Shell variables such as $TOKEN are not expanded. They are kept as written, so replace them with real values.");

  let url: string | undefined;
  let method: string | undefined;
  const headers: { name: string; value: string }[] = [];
  const dataParts: string[] = [];
  const formFields: { name: string; value: string; file?: boolean }[] = [];
  let dataFile: string | undefined;
  let dataIsJson = false;
  let getMode = false;
  let head = false;
  let basic: string | undefined;
  let bearer: string | undefined;
  const cookies: string[] = [];
  let sawData = false;

  const addHeader = (raw: string) => {
    const colon = raw.indexOf(":");
    if (colon === -1) {
      if (raw.endsWith(";")) return; // "Name;" sends an empty header in curl; fetch cannot express it usefully
      warnings.add(`The header “${raw}” has no colon, so it was skipped. Headers look like “Name: value”.`);
      return;
    }
    const name = raw.slice(0, colon).trim();
    const value = raw.slice(colon + 1).trim();
    if (!name) return;
    if (!value) {
      warnings.add(`“${name}:” with no value removes a header in curl, so it was skipped.`);
      return;
    }
    headers.push({ name, value });
  };

  const addData = (value: string, flag: string) => {
    sawData = true;
    if (flag === "data-urlencode") {
      // curl forms: content, =content, name=content (all encoded), @file and name@file (read from disk).
      const eq = value.indexOf("=");
      if (eq === -1 && value.includes("@")) warnings.add("Reading data from a file is not possible in the browser, so that part was skipped.");
      else if (eq === -1) dataParts.push(encodeForm(value));
      else dataParts.push(eq === 0 ? encodeForm(value.slice(1)) : `${value.slice(0, eq)}=${encodeForm(value.slice(eq + 1))}`);
      return;
    }
    if (flag !== "data-raw" && value.startsWith("@")) {
      dataFile = value.slice(1);
      warnings.add(`The body is read from the file “${dataFile}” in curl. Browsers cannot read files by path, so replace it with the file's contents.`);
      return;
    }
    dataParts.push(value);
  };

  const handle = (opt: string, value: string | undefined) => {
    switch (opt) {
      case "X":
        method = value!.toUpperCase();
        break;
      case "H":
        if (value!.startsWith("@")) warnings.add("Headers read from a file were skipped.");
        else addHeader(value!);
        break;
      case "d":
      case "data-raw":
      case "data-binary":
      case "data-urlencode":
        addData(value!, opt === "d" ? "data" : opt);
        break;
      case "json":
        dataIsJson = true;
        addData(value!, "json");
        break;
      case "F":
      case "form-string": {
        const eq = value!.indexOf("=");
        if (eq === -1) {
          warnings.add(`The form field “${value}” has no “=”, so it was skipped.`);
          break;
        }
        const name = value!.slice(0, eq);
        let v = value!.slice(eq + 1);
        const isFile = opt === "F" && (v.startsWith("@") || v.startsWith("<"));
        if (isFile) {
          v = v.slice(1).split(";")[0] ?? "";
          warnings.add("File uploads need a File from the page (for example from an <input type=\"file\">). Those lines are marked in the code.");
        } else if (opt === "F") {
          v = v.replace(/;type=[^;]*$/, "").replace(/^"(.*)"$/, "$1");
        }
        formFields.push({ name, value: v, file: isFile });
        break;
      }
      case "u":
        basic = value!;
        break;
      case "oauth2-bearer":
        bearer = value!;
        break;
      case "b":
        if (value!.includes("=")) cookies.push(value!);
        else warnings.add("Cookies read from a file were skipped.");
        break;
      case "A":
        headers.push({ name: "User-Agent", value: value! });
        break;
      case "e":
        headers.push({ name: "Referer", value: value!.replace(/;auto$/, "") });
        break;
      case "I":
        head = true;
        break;
      case "G":
        getMode = true;
        break;
      case "url":
        url ??= value!;
        break;
      case "k":
        warnings.add("--insecure (skip certificate checks) has no fetch equivalent, so it was left out.");
        break;
      case "x":
        warnings.add("Proxy settings have no fetch equivalent and were left out.");
        break;
      case "o":
      case "T":
      case "E":
      case "c":
        warnings.add("Options for saving files, uploading files or client certificates have no fetch equivalent and were left out.");
        break;
      default:
        break; // -L, -s, -v, --compressed and friends do not change the request
    }
  };

  for (let i = 1; i < words.length; i++) {
    const word = words[i] as string;
    if (word === "--") {
      url ??= words[i + 1];
      break;
    }
    if (word.startsWith("--")) {
      const eq = word.indexOf("=");
      const raw = eq === -1 ? word.slice(2) : word.slice(2, eq);
      const inline = eq === -1 ? undefined : word.slice(eq + 1);
      const wantsValue = LONG_WITH_VALUE.has(raw) || LONG_IGNORED_WITH_VALUE.has(raw);
      let value = inline;
      if (wantsValue && value === undefined) {
        value = words[++i];
        if (value === undefined) throw new Error(`The option --${raw} needs a value, but the command ends after it.`);
      }
      if (!wantsValue && !(raw in LONG_ALIASES) && !LONG_FLAGS.has(raw)) warnings.add(`The option --${raw} was not recognised and was ignored.`);
      handle(LONG_ALIASES[raw] ?? raw, value);
    } else if (word.length > 1 && word.startsWith("-")) {
      for (let j = 1; j < word.length; j++) {
        const flag = word[j] as string;
        if (SHORT_WITH_VALUE.has(flag)) {
          let value: string | undefined = word.slice(j + 1);
          if (!value) {
            value = words[++i];
            if (value === undefined) throw new Error(`The option -${flag} needs a value, but the command ends after it.`);
          }
          handle(flag, value);
          break;
        }
        handle(flag, undefined);
      }
    } else if (url === undefined) {
      url = word;
    } else {
      warnings.add("More than one URL was given. Only the first one is used.");
    }
  }

  if (!url) throw new Error("No URL found. Add the address to request, for example: curl https://example.com/api");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`;

  // Assemble the body.
  let body: CurlBody | undefined;
  if (formFields.length) {
    body = { kind: "form", fields: formFields };
    const ct = headers.findIndex((h) => h.name.toLowerCase() === "content-type");
    const contentTypeHeader = headers[ct];
    if (contentTypeHeader && /multipart\/form-data/i.test(contentTypeHeader.value)) {
      headers.splice(ct, 1);
      warnings.add("The Content-Type header was removed because fetch must set the multipart boundary itself.");
    }
  } else if (dataFile !== undefined && dataParts.length === 0) {
    body = { kind: "file", path: dataFile };
  } else if (sawData && dataParts.length) {
    body = { kind: "text", value: dataParts.join(dataIsJson ? "" : "&") };
  }

  if (getMode && body?.kind === "text") {
    url += (url.includes("?") ? "&" : "?") + body.value;
    body = undefined;
  }

  const has = (name: string) => headers.some((h) => h.name.toLowerCase() === name);
  if (basic !== undefined && !has("authorization")) headers.push({ name: "Authorization", value: `Basic ${base64Encode(basic.includes(":") ? basic : `${basic}:`)}` });
  if (bearer !== undefined && !has("authorization")) headers.push({ name: "Authorization", value: `Bearer ${bearer}` });
  if (cookies.length) {
    const existing = headers.findIndex((h) => h.name.toLowerCase() === "cookie");
    const existingCookie = headers[existing];
    if (existingCookie) existingCookie.value += `; ${cookies.join("; ")}`;
    else headers.push({ name: "Cookie", value: cookies.join("; ") });
  }
  if (dataIsJson) {
    if (!has("content-type")) headers.push({ name: "Content-Type", value: "application/json" });
    if (!has("accept")) headers.push({ name: "Accept", value: "application/json" });
  } else if (body && body.kind !== "form" && !has("content-type")) {
    // curl labels -d data as a form post; fetch would otherwise send text/plain.
    headers.push({ name: "Content-Type", value: "application/x-www-form-urlencoded" });
  }

  // Merge repeated headers: an object literal cannot hold the same name twice.
  const merged: { name: string; value: string }[] = [];
  for (const h of headers) {
    const prior = merged.find((m) => m.name.toLowerCase() === h.name.toLowerCase());
    if (prior) prior.value += h.name.toLowerCase() === "cookie" ? `; ${h.value}` : `, ${h.value}`;
    else merged.push({ ...h });
  }

  const resolvedMethod = method ?? (head ? "HEAD" : body ? "POST" : "GET");
  if (body && (resolvedMethod === "GET" || resolvedMethod === "HEAD")) {
    warnings.add(`fetch throws an error when a ${resolvedMethod} request has a body. Change the method or remove the body.`);
  }

  return { url, method: resolvedMethod, headers: merged, body, warnings: [...warnings] };
}

// --- Code generation -------------------------------------------------------------------------------------

const str = (s: string) => JSON.stringify(s);
const indent = (code: string, pad: string) => code.replace(/\n/g, `\n${pad}`);

function bodyExpression(body: CurlBody, contentType: string | undefined): { setup: string[]; expr: string } {
  if (body.kind === "form") {
    const setup = ["const formData = new FormData();"];
    for (const f of body.fields) {
      setup.push(f.file ? `formData.append(${str(f.name)}, fileInput.files[0]); // replaces @${f.value}` : `formData.append(${str(f.name)}, ${str(f.value)});`);
    }
    return { setup, expr: "formData" };
  }
  if (body.kind === "file") return { setup: [], expr: `"" /* contents of ${body.path.replace(/\*\//g, "* /")} */` };
  if (contentType && /json/i.test(contentType)) {
    try {
      const parsed: unknown = JSON.parse(body.value);
      if (parsed !== null && typeof parsed === "object") return { setup: [], expr: `JSON.stringify(${JSON.stringify(parsed, null, 2)})` };
    } catch {
      // Not valid JSON: send the text exactly as it was given.
    }
  }
  return { setup: [], expr: str(body.value) };
}

/** Generate `fetch` code for a parsed command. */
export function generateFetch(parsed: ParsedCurl, options: CurlToFetchOptions = {}): string {
  const { responseAs = "json", omitBrowserHeaders = false } = options;
  const notes = [...parsed.warnings];

  let headers = parsed.headers;
  const browserOnly = headers.filter((h) => isBrowserOnlyHeader(h.name));
  if (browserOnly.length) {
    if (omitBrowserHeaders) {
      headers = headers.filter((h) => !isBrowserOnlyHeader(h.name));
      notes.push(`Left out headers that browsers refuse to set: ${browserOnly.map((h) => h.name).join(", ")}.`);
    } else {
      notes.push(`Browsers refuse to set ${browserOnly.map((h) => h.name).join(", ")} from fetch(). They work in Node.js, Deno and Bun.`);
    }
  }

  const contentType = headers.find((h) => h.name.toLowerCase() === "content-type")?.value;
  const body = parsed.body ? bodyExpression(parsed.body, contentType) : undefined;

  // Notes can quote text from the command, so keep each one on a single comment line.
  const lines: string[] = notes.map((n) => `// Note: ${n.replace(/\s+/g, " ")}`);
  if (body?.setup.length) lines.push(...body.setup, "");

  const init: string[] = [];
  if (parsed.method !== "GET") init.push(`  method: ${str(parsed.method)},`);
  if (headers.length) init.push(`  headers: {\n${headers.map((h) => `    ${str(h.name)}: ${str(h.value)},`).join("\n")}\n  },`);
  if (body) init.push(`  body: ${indent(body.expr, "  ")},`);

  lines.push(init.length ? `const response = await fetch(${str(parsed.url)}, {\n${init.join("\n")}\n});` : `const response = await fetch(${str(parsed.url)});`);

  if (responseAs !== "none") {
    lines.push("", "if (!response.ok) {", "  throw new Error(`Request failed with status ${response.status}`);", "}", "", `const data = await response.${responseAs}();`, "console.log(data);");
  }
  return lines.join("\n");
}

/** Convert a pasted cURL command to fetch code. */
export function curlToFetch(command: string, options: CurlToFetchOptions = {}): string {
  return generateFetch(parseCurl(command), options);
}
