/**
 * Parse raw HTTP headers and explain them in plain English. Keep this file free of React, the DOM and the network.
 *
 * Accepts a request or response as copied from browser dev tools, `curl -i` or a log: an optional start line
 * (`HTTP/1.1 200 OK`, `GET / HTTP/1.1`), then `Name: value` lines. The body, if any, is ignored.
 */

export type HeaderGroup = "caching" | "security" | "content" | "cors" | "auth" | "cookies" | "connection" | "request" | "other";
export type MessageKind = "request" | "response" | "unknown";

export interface ParsedHeader {
  /** Name as written, e.g. `content-type`. */
  name: string;
  value: string;
  /** 1-based line in the pasted text. */
  line: number;
}

export interface ParsedMessage {
  kind: MessageKind;
  startLine: string | null;
  headers: ParsedHeader[];
  warnings: string[];
}

export interface HeaderInfo {
  /** Conventional capitalization, e.g. `Content-Type`. */
  name: string;
  group: HeaderGroup;
  summary: string;
}

export type FlagLevel = "good" | "warn" | "info";
export interface Flag {
  level: FlagLevel;
  text: string;
}

export interface ExplainedHeader {
  header: ParsedHeader;
  info: HeaderInfo | null;
  /** Plain-English breakdown of this particular value. */
  details: string[];
  flags: Flag[];
}

export type CheckStatus = "good" | "warn" | "missing";
export interface SecurityCheck {
  id: string;
  title: string;
  status: CheckStatus;
  message: string;
}

export interface HeaderReport {
  message: ParsedMessage;
  entries: ExplainedHeader[];
  /** Only filled for responses. */
  checks: SecurityCheck[];
}

const MAX_HEADERS = 2000;
const TOKEN = /^:?[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/* ------------------------------ known headers ------------------------------ */

const H = (name: string, group: HeaderGroup, summary: string): [string, HeaderInfo] => [name.toLowerCase(), { name, group, summary }];

const KNOWN: Record<string, HeaderInfo> = Object.fromEntries([
  H("Accept", "request", "The content types the client can handle, most preferred first."),
  H("Accept-Charset", "request", "Character sets the client accepts. Obsolete: UTF-8 is assumed."),
  H("Accept-Encoding", "request", "Compression formats the client can decode, such as gzip or br."),
  H("Accept-Language", "request", "The languages the user prefers, most preferred first."),
  H("Accept-Ranges", "content", "Whether the server supports partial downloads (byte ranges)."),
  H("Access-Control-Allow-Credentials", "cors", "Lets cross-origin pages send cookies and credentials with the request."),
  H("Access-Control-Allow-Headers", "cors", "Request headers a cross-origin page is allowed to send."),
  H("Access-Control-Allow-Methods", "cors", "HTTP methods a cross-origin page is allowed to use."),
  H("Access-Control-Allow-Origin", "cors", "Which origin may read this response from a script on another site."),
  H("Access-Control-Expose-Headers", "cors", "Response headers that cross-origin scripts are allowed to read."),
  H("Access-Control-Max-Age", "cors", "How long the browser may cache the answer to a CORS preflight check."),
  H("Access-Control-Request-Headers", "cors", "Preflight: the headers the real request wants to send."),
  H("Access-Control-Request-Method", "cors", "Preflight: the method the real request wants to use."),
  H("Age", "caching", "Seconds this response has already spent in a shared cache."),
  H("Allow", "content", "The methods the resource supports."),
  H("Alt-Svc", "connection", "Advertises other ways to reach this site, such as HTTP/3."),
  H("Authorization", "auth", "Credentials the client uses to prove who it is."),
  H("Cache-Control", "caching", "Rules for how browsers and caches may store this response."),
  H("Clear-Site-Data", "security", "Tells the browser to wipe stored data for this site, for example on logout."),
  H("Connection", "connection", "Controls whether the network connection stays open."),
  H("Content-Disposition", "content", "Whether to show the content inline or download it, and under what file name."),
  H("Content-Encoding", "content", "The compression applied to the body."),
  H("Content-Language", "content", "The natural language of the content."),
  H("Content-Length", "content", "Size of the body in bytes."),
  H("Content-Location", "content", "A direct URL for the content that was returned."),
  H("Content-Range", "content", "Which part of the whole resource this partial response holds."),
  H("Content-Security-Policy", "security", "Limits where scripts, styles, images and frames may load from. The main defence against XSS."),
  H("Content-Security-Policy-Report-Only", "security", "Like Content-Security-Policy, but only reports violations instead of blocking."),
  H("Content-Type", "content", "The media type of the body, and often its character set."),
  H("Cookie", "cookies", "Cookies the browser sends back to the server."),
  H("Cross-Origin-Embedder-Policy", "security", "Requires cross-origin resources to opt in before this page can load them."),
  H("Cross-Origin-Opener-Policy", "security", "Isolates this page from windows opened by or from other sites."),
  H("Cross-Origin-Resource-Policy", "security", "Controls which sites may load this resource."),
  H("Date", "other", "When the message was created."),
  H("DNT", "request", "Do Not Track preference. Deprecated and widely ignored."),
  H("ETag", "caching", "A version fingerprint of the resource, used to check if it changed."),
  H("Expect", "request", "Asks the server to confirm it will accept the request before the body is sent."),
  H("Expires", "caching", "When the response goes stale. Cache-Control: max-age takes priority."),
  H("Forwarded", "request", "Standard header describing the original client when a proxy is in the way."),
  H("From", "request", "Email address of the person or bot behind the request."),
  H("Host", "request", "The site and port the client is asking for."),
  H("If-Match", "request", "Only proceed if the resource still has this ETag."),
  H("If-Modified-Since", "caching", "Only send the body if it changed after this date."),
  H("If-None-Match", "caching", "Only send the body if the ETag differs from this one."),
  H("If-Range", "request", "Resume a partial download only if the resource is unchanged."),
  H("If-Unmodified-Since", "request", "Only proceed if the resource has not changed since this date."),
  H("Keep-Alive", "connection", "Settings for a persistent connection."),
  H("Last-Modified", "caching", "When the resource last changed."),
  H("Link", "other", "Related resources such as preloads, canonical URLs or pagination."),
  H("Location", "other", "Where to go next: the target of a redirect or a newly created resource."),
  H("Origin", "request", "The site that started the request. Sent on cross-origin and POST requests."),
  H("Permissions-Policy", "security", "Turns browser features such as camera, microphone and geolocation on or off for this page."),
  H("Pragma", "caching", "Old HTTP/1.0 cache control. Use Cache-Control instead."),
  H("Proxy-Authenticate", "auth", "How to authenticate with the proxy."),
  H("Proxy-Authorization", "auth", "Credentials for the proxy."),
  H("Range", "request", "Asks for only part of the resource."),
  H("Referer", "request", "The page the request came from. (The misspelling is part of the standard.)"),
  H("Referrer-Policy", "security", "How much of the page address is sent along when the user follows a link."),
  H("Retry-After", "other", "How long to wait before trying again."),
  H("Sec-Fetch-Dest", "request", "What the request will be used for, such as a document or an image."),
  H("Sec-Fetch-Mode", "request", "The request mode, such as navigate or cors."),
  H("Sec-Fetch-Site", "request", "How the request relates to the page that made it: same-origin, same-site or cross-site."),
  H("Sec-Fetch-User", "request", "Present when a user action, such as a click, started the navigation."),
  H("Server", "other", "Names the software that handled the request."),
  H("Server-Timing", "other", "Timing measurements from the server, visible in dev tools."),
  H("Set-Cookie", "cookies", "Asks the browser to store a cookie."),
  H("SourceMap", "other", "Where to find the source map for this script or stylesheet."),
  H("Strict-Transport-Security", "security", "Tells browsers to use HTTPS only for this site for a set time (HSTS)."),
  H("TE", "request", "Transfer encodings the client accepts."),
  H("Timing-Allow-Origin", "cors", "Sites that may read detailed resource timing for this response."),
  H("Trailer", "other", "Names headers that follow the body."),
  H("Transfer-Encoding", "connection", "How the body is sent over the wire, such as chunked."),
  H("Upgrade", "connection", "Asks to switch protocol, for example to WebSocket."),
  H("Upgrade-Insecure-Requests", "request", "The client prefers an HTTPS version of the page."),
  H("User-Agent", "request", "Identifies the browser or program making the request."),
  H("Vary", "caching", "Request headers that change the response, so caches must keep separate copies."),
  H("Via", "connection", "Proxies the message passed through."),
  H("Warning", "other", "Extra information about the message. Deprecated."),
  H("WWW-Authenticate", "auth", "Tells the client how to authenticate after a 401 response."),
  H("X-Content-Type-Options", "security", "nosniff stops browsers from guessing a different content type than declared."),
  H("X-DNS-Prefetch-Control", "other", "Turns browser DNS prefetching on or off."),
  H("X-Forwarded-For", "request", "The client address as seen by each proxy. Can be forged by the client."),
  H("X-Forwarded-Host", "request", "The Host the client originally asked for, set by a proxy."),
  H("X-Forwarded-Proto", "request", "The protocol the client originally used, set by a proxy."),
  H("X-Frame-Options", "security", "Controls whether other sites may put this page in a frame. Superseded by CSP frame-ancestors."),
  H("X-Powered-By", "other", "Names the framework behind the site. Unneeded, and tells attackers what to target."),
  H("X-Request-ID", "other", "A unique id for the request, handy for matching logs."),
  H("X-Requested-With", "request", "Often XMLHttpRequest: marks a script request rather than a page navigation."),
  H("X-XSS-Protection", "security", "Old browser XSS filter. Obsolete; rely on Content-Security-Policy instead."),
]);

/** Look up a header by name (any capitalization). */
export function describeHeader(name: string): HeaderInfo | null {
  const key = name.toLowerCase();
  return has(KNOWN, key) ? (KNOWN[key] as HeaderInfo) : null;
}

/* --------------------------------- parsing --------------------------------- */

const RESPONSE_LINE = /^HTTP\/\d(?:\.\d)?\s+\d{3}\b.*$/i;
const REQUEST_LINE = /^[A-Z]+\s+\S+\s+HTTP\/\d(?:\.\d)?\s*$/;

export function parseHeaders(text: string): ParsedMessage {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const warnings: string[] = [];
  const headers: ParsedHeader[] = [];
  let startLine: string | null = null;
  let kind: MessageKind = "unknown";
  let started = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] as string;
    const line = i + 1;
    if (!raw.trim()) {
      if (headers.length || startLine) {
        // A blank line ends the headers. Anything after it is a body, or a second response from a redirect chain.
        if (lines.slice(i + 1).some((l) => RESPONSE_LINE.test(l.trim()))) warnings.push("Only the first message was read. Paste each response separately to explain the others.");
        break;
      }
      continue;
    }
    if (!started) {
      started = true;
      const trimmed = raw.trim();
      if (RESPONSE_LINE.test(trimmed)) {
        startLine = trimmed;
        kind = "response";
        continue;
      }
      if (REQUEST_LINE.test(trimmed)) {
        startLine = trimmed;
        kind = "request";
        continue;
      }
    }
    if (/^[ \t]/.test(raw) && headers.length) {
      const prev = headers[headers.length - 1] as ParsedHeader;
      prev.value = `${prev.value} ${raw.trim()}`.trim();
      continue;
    }
    // Pseudo-headers such as ":status: 200" start with a colon, so look for the colon after the first character.
    const colon = raw.indexOf(":", raw.startsWith(":") ? 1 : 0);
    if (colon < 1) {
      warnings.push(`Line ${line} is not a header, because it has no colon: “${truncate(raw.trim(), 60)}”.`);
      continue;
    }
    const name = raw.slice(0, colon).trim();
    if (!TOKEN.test(name)) {
      warnings.push(`Line ${line} has a header name with spaces or odd characters: “${truncate(name, 40)}”.`);
      continue;
    }
    if (headers.length >= MAX_HEADERS) {
      warnings.push(`Stopped after ${MAX_HEADERS} headers.`);
      break;
    }
    headers.push({ name, value: raw.slice(colon + 1).trim(), line });
  }

  if (kind === "unknown") kind = guessKind(headers);
  return { kind, startLine, headers, warnings };
}

function guessKind(headers: ParsedHeader[]): MessageKind {
  const names = new Set(headers.map((h) => h.name.toLowerCase()));
  if (names.has(":status")) return "response";
  if (names.has(":method") || names.has(":path")) return "request";
  const requestOnly = ["host", "user-agent", "cookie", "authorization", "origin", "referer", "if-none-match", "if-modified-since", "range"];
  const responseOnly = ["set-cookie", "server", "etag", "last-modified", "location", "www-authenticate", "strict-transport-security", "content-security-policy", "access-control-allow-origin"];
  const req = requestOnly.filter((n) => names.has(n)).length;
  const res = responseOnly.filter((n) => names.has(n)).length;
  if (req > res) return "request";
  if (res > req) return "response";
  return "unknown";
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* -------------------------------- explaining -------------------------------- */

export function humanDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "an invalid time";
  if (totalSeconds === 0) return "0 seconds";
  const units: [string, number][] = [
    ["year", 31_536_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  const parts: string[] = [];
  let rest = Math.floor(totalSeconds);
  for (const [label, size] of units) {
    const n = Math.floor(rest / size);
    if (n > 0) parts.push(`${n} ${label}${n === 1 ? "" : "s"}`);
    rest -= n * size;
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} byte${n === 1 ? "" : "s"}`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Number(v.toFixed(1))} ${units[i]} (${n.toLocaleString("en-US")} bytes)`;
}

const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

/** Every `;`- or `,`-separated directive as lower-cased key and raw value: `max-age=60; preload`. */
function directives(value: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of value.split(/[;,]/)) {
    const eq = part.indexOf("=");
    const key = (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase();
    if (key) map.set(key, eq === -1 ? "" : part.slice(eq + 1).trim().replace(/^"|"$/g, ""));
  }
  return map;
}

/** Split a `head; key=value` string such as `text/html; charset=utf-8` or a cookie. */
function params(value: string): { head: string; params: Map<string, string> } {
  const [head = "", ...rest] = value.split(";");
  const map = new Map<string, string>();
  for (const part of rest) {
    const eq = part.indexOf("=");
    const key = (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase();
    if (key) map.set(key, eq === -1 ? "" : part.slice(eq + 1).trim().replace(/^"|"$/g, ""));
  }
  return { head: head.trim(), params: map };
}

const CACHE_DIRECTIVES: Record<string, string> = {
  "no-store": "Do not store this response anywhere.",
  "no-cache": "May be stored, but must be re-checked with the server before every reuse.",
  public: "Any cache, including shared ones, may store it.",
  private: "Only the user's own browser may store it, not shared caches.",
  "must-revalidate": "Once stale, it must be re-checked before use.",
  "proxy-revalidate": "Like must-revalidate, but for shared caches.",
  immutable: "The content will never change while fresh, so skip revalidation.",
  "no-transform": "Intermediaries must not alter the body.",
  "only-if-cached": "Request: answer only from cache.",
  "stale-while-revalidate": "May serve a stale copy while fetching a fresh one in the background.",
  "stale-if-error": "May serve a stale copy if the origin fails.",
};

const CSP_UNSAFE = ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"];

type Explain = { details: string[]; flags: Flag[] };

function explainValue(lower: string, value: string, kind: MessageKind): Explain {
  const details: string[] = [];
  const flags: Flag[] = [];
  const add = (level: FlagLevel, text: string) => flags.push({ level, text });

  switch (lower) {
    case "cache-control": {
      const seen = new Set<string>();
      for (const part of splitList(value)) {
        const [dir = "", arg] = part.split("=");
        const d = dir.trim().toLowerCase();
        seen.add(d);
        const secs = Number(arg);
        if ((d === "max-age" || d === "s-maxage") && arg !== undefined && Number.isFinite(secs)) {
          details.push(`${d}=${secs}: ${d === "max-age" ? "fresh for" : "shared caches treat it as fresh for"} ${humanDuration(secs)}.`);
        } else if (has(CACHE_DIRECTIVES, d)) {
          details.push(`${d}: ${CACHE_DIRECTIVES[d]}`);
        } else if (d) details.push(`${part}: not a directive this tool knows.`);
      }
      if (seen.has("no-store")) add("info", "Nothing will be cached.");
      if (seen.has("public") && seen.has("private")) add("warn", "public and private contradict each other.");
      if (seen.has("no-cache") && seen.has("max-age")) add("info", "no-cache makes caches re-check even though max-age is set.");
      break;
    }
    case "set-cookie": {
      const { head, params: p } = params(value);
      const name = head.split("=")[0] ?? "";
      details.push(`Sets a cookie named “${name}”.`);
      if (p.has("max-age")) details.push(`Max-Age: lasts ${humanDuration(Number(p.get("max-age")))}.`);
      else if (p.has("expires")) details.push(`Expires: ${p.get("expires")}.`);
      else details.push("No Max-Age or Expires, so it is a session cookie and goes when the browser closes.");
      if (p.has("domain")) details.push(`Domain=${p.get("domain")}: also sent to subdomains.`);
      if (p.has("path")) details.push(`Path=${p.get("path")}.`);
      const lowerName = name.toLowerCase();
      if (p.has("secure")) add("good", "Secure: only sent over HTTPS.");
      else add("warn", "No Secure flag: the cookie can travel over plain HTTP.");
      if (p.has("httponly")) add("good", "HttpOnly: page scripts cannot read it.");
      else add("warn", "No HttpOnly flag: scripts on the page can read it. Fine only if a script needs it.");
      const same = (p.get("samesite") ?? "").toLowerCase();
      if (same === "strict" || same === "lax") add("good", `SameSite=${p.get("samesite")}: limits cross-site sending.`);
      else if (same === "none") add(p.has("secure") ? "info" : "warn", p.has("secure") ? "SameSite=None: sent on cross-site requests too." : "SameSite=None only works together with Secure.");
      else add("info", "No SameSite attribute: browsers treat it as Lax.");
      if (lowerName.startsWith("__host-") && !(p.has("secure") && p.get("path") === "/" && !p.has("domain"))) add("warn", "A __Host- cookie needs Secure, Path=/ and no Domain.");
      if (lowerName.startsWith("__secure-") && !p.has("secure")) add("warn", "A __Secure- cookie needs the Secure flag.");
      break;
    }
    case "cookie": {
      const pairs = value.split(";").filter((s) => s.trim());
      details.push(`${pairs.length} cookie${pairs.length === 1 ? "" : "s"}: ${pairs.map((c) => c.split("=")[0]?.trim()).join(", ")}.`);
      add("info", "Cookie values can include session ids. Do not share them.");
      break;
    }
    case "strict-transport-security": {
      const p = directives(value);
      const age = Number(p.get("max-age"));
      if (p.has("max-age") && Number.isFinite(age)) details.push(`max-age=${age}: use HTTPS only for ${humanDuration(age)}.`);
      else add("warn", "No valid max-age, so browsers ignore this header.");
      if (p.has("includesubdomains")) details.push("includeSubDomains: applies to every subdomain.");
      if (p.has("preload")) details.push("preload: the site may be added to browsers' built-in HTTPS list.");
      if (p.has("max-age") && age === 0) add("info", "max-age=0 switches HSTS off.");
      break;
    }
    case "content-security-policy":
    case "content-security-policy-report-only": {
      const directives = value.split(";").map((d) => d.trim()).filter(Boolean);
      for (const d of directives) {
        const [name = "", ...sources] = d.split(/\s+/);
        details.push(`${name}: ${sources.length ? sources.join(" ") : "(nothing allowed)"}`);
        const risky = sources.filter((s) => CSP_UNSAFE.includes(s.toLowerCase()) || s === "*" || s === "data:" || s === "http:");
        if (risky.length && /^(default|script|style)-src/.test(name)) add("warn", `${name} allows ${risky.join(", ")}, which weakens the policy.`);
      }
      if (lower.endsWith("report-only")) add("info", "Report-only: violations are reported but nothing is blocked.");
      break;
    }
    case "content-type": {
      const { head, params: p } = params(value);
      details.push(`Media type: ${head || "(empty)"}.`);
      if (p.has("charset")) details.push(`Character set: ${p.get("charset")}.`);
      if (p.has("boundary")) details.push("Multipart body split by the given boundary.");
      if (/^text\//i.test(head) && !p.has("charset") && kind === "response") add("info", "No charset given. Browsers guess, so add charset=utf-8 for text.");
      break;
    }
    case "content-length": {
      const n = Number(value);
      if (/^\d+$/.test(value) && Number.isSafeInteger(n)) details.push(humanBytes(n));
      else add("warn", "Content-Length must be a whole number of bytes.");
      break;
    }
    case "content-encoding":
    case "transfer-encoding":
      details.push(...splitList(value).map((e) => `${e}${e.toLowerCase() === "chunked" ? ": the body arrives in pieces of unknown total size." : "."}`));
      break;
    case "accept":
    case "accept-encoding":
    case "accept-language":
    case "accept-charset":
      details.push(...splitList(value).map(describeQuality));
      break;
    case "access-control-allow-origin":
      if (value === "*") add("info", "Any website may read this response from a script.");
      else if (value === "null") add("warn", "“null” trusts sandboxed and local pages, which is rarely wanted.");
      else details.push(`Only scripts from ${value} may read this response.`);
      break;
    case "access-control-allow-credentials":
      if (value.toLowerCase() === "true") add("info", "Cross-origin requests may carry cookies. The allowed origin must then be a specific site, not *.");
      break;
    case "date":
    case "expires":
    case "last-modified":
    case "if-modified-since":
    case "if-unmodified-since": {
      // Date.parse accepts junk such as "0" (year 2000), so require a clock time as HTTP dates have.
      const t = /\d{1,2}:\d{2}:\d{2}/.test(value) ? Date.parse(value) : NaN;
      if (Number.isNaN(t)) {
        if (lower === "expires") details.push("Not a valid date, which caches treat as already expired.");
        else add("warn", "Not a valid HTTP date.");
      } else details.push(`${new Date(t).toISOString().replace(".000Z", "Z")} (UTC).`);
      break;
    }
    case "age": {
      const n = Number(value);
      if (Number.isFinite(n)) details.push(`In a shared cache for ${humanDuration(n)}.`);
      break;
    }
    case "authorization":
    case "proxy-authorization": {
      const scheme = value.split(/\s+/)[0] ?? "";
      details.push(`Scheme: ${scheme || "(none)"}.`);
      add("warn", "Contains credentials. Do not share or post this value.");
      break;
    }
    case "x-frame-options": {
      const v = value.toUpperCase();
      if (v === "DENY") add("good", "No site may frame this page.");
      else if (v === "SAMEORIGIN") add("good", "Only this site may frame the page.");
      else add("warn", "Use DENY or SAMEORIGIN. Other values, such as ALLOW-FROM, are ignored.");
      break;
    }
    case "x-content-type-options":
      if (value.toLowerCase() === "nosniff") add("good", "Browsers must trust the declared content type.");
      else add("warn", "The only valid value is nosniff.");
      break;
    case "referrer-policy":
      if (value.toLowerCase() === "unsafe-url") add("warn", "unsafe-url sends the full address, even to other sites and over HTTP.");
      else details.push(`Policy: ${value}.`);
      break;
    case "x-xss-protection":
      if (value.trim().startsWith("1")) add("info", "Obsolete, and the old filter had its own security bugs. Use 0 or remove it.");
      break;
    case "server":
      if (/\d+\.\d+/.test(value)) add("info", "Exposes a version number. Hiding it makes targeted attacks slightly harder.");
      break;
    case "x-powered-by":
      add("info", "Reveals the framework. Most sites remove it.");
      break;
    case "connection":
      if (value.toLowerCase() === "close") details.push("Close the connection after this exchange.");
      else if (value.toLowerCase() === "keep-alive") details.push("Keep the connection open for more requests.");
      break;
    case "vary":
      details.push(value === "*" ? "The response depends on something no header names, so it cannot be cached." : `Caches keep separate copies per: ${splitList(value).join(", ")}.`);
      break;
    case "location":
      details.push(`Points to ${value}.`);
      break;
    case "retry-after":
      if (/^\d+$/.test(value)) details.push(`Try again in ${humanDuration(Number(value))}.`);
      break;
    case "user-agent":
    case "host":
      break;
    default:
      break;
  }
  return { details, flags };
}

function describeQuality(item: string): string {
  const { head, params: p } = params(item);
  const q = p.get("q");
  if (q === undefined) return `${head}: preferred.`;
  const n = Number(q);
  return `${head}: ${n === 0 ? "not acceptable" : `preference ${q}`}.`;
}

/* ------------------------------- security checks ------------------------------- */

function find(headers: ParsedHeader[], name: string): ParsedHeader | undefined {
  return headers.find((h) => h.name.toLowerCase() === name);
}

function securityChecks(headers: ParsedHeader[]): SecurityCheck[] {
  const checks: SecurityCheck[] = [];
  const push = (id: string, title: string, status: CheckStatus, message: string) => checks.push({ id, title, status, message });

  const hsts = find(headers, "strict-transport-security");
  if (!hsts) push("hsts", "Strict-Transport-Security", "missing", "Browsers are not told to stick to HTTPS. Add it on HTTPS sites; it has no effect on plain HTTP.");
  else {
    const age = Number(directives(hsts.value).get("max-age"));
    if (!Number.isFinite(age) || age <= 0) push("hsts", "Strict-Transport-Security", "warn", "There is no usable max-age, so HSTS is not active.");
    else if (age < 15_552_000) push("hsts", "Strict-Transport-Security", "warn", `max-age is only ${humanDuration(age)}. Aim for at least 6 months.`);
    else push("hsts", "Strict-Transport-Security", "good", `HTTPS is enforced for ${humanDuration(age)}.`);
  }

  const csp = find(headers, "content-security-policy");
  if (!csp) push("csp", "Content-Security-Policy", "missing", "No policy limits where scripts and other content can load from. It is the main defence against cross-site scripting.");
  else {
    const scriptish = csp.value.split(";").map((d) => d.trim()).filter((d) => /^(default|script)-src\b/i.test(d));
    const weak = scriptish.flatMap((d) => d.split(/\s+/).filter((s) => CSP_UNSAFE.includes(s.toLowerCase()) || s === "*"));
    if (weak.length) push("csp", "Content-Security-Policy", "warn", `Script sources allow ${[...new Set(weak)].join(", ")}, which lets injected code run.`);
    else if (!scriptish.length) push("csp", "Content-Security-Policy", "warn", "There is no default-src or script-src, so scripts are not restricted.");
    else push("csp", "Content-Security-Policy", "good", "Scripts are restricted to the sources the policy lists.");
  }

  const nosniff = find(headers, "x-content-type-options");
  if (nosniff?.value.toLowerCase() === "nosniff") push("nosniff", "X-Content-Type-Options", "good", "Browsers will not guess a different content type.");
  else if (nosniff) push("nosniff", "X-Content-Type-Options", "warn", "The only valid value is nosniff.");
  else push("nosniff", "X-Content-Type-Options", "missing", "Add nosniff so a file served as text cannot be run as a script.");

  const xfo = find(headers, "x-frame-options");
  const frameAncestors = csp && /(^|;)\s*frame-ancestors\b/i.test(csp.value);
  if (frameAncestors || (xfo && ["deny", "sameorigin"].includes(xfo.value.toLowerCase()))) push("frames", "Clickjacking protection", "good", frameAncestors ? "CSP frame-ancestors limits who can frame the page." : "X-Frame-Options limits who can frame the page.");
  else if (xfo) push("frames", "Clickjacking protection", "warn", "X-Frame-Options should be DENY or SAMEORIGIN.");
  else push("frames", "Clickjacking protection", "missing", "Other sites can put this page in a frame. Add CSP frame-ancestors or X-Frame-Options.");

  const ref = find(headers, "referrer-policy");
  if (!ref) push("referrer", "Referrer-Policy", "missing", "Browsers apply their default, which is fine for most sites. Set one to be explicit.");
  else if (ref.value.toLowerCase() === "unsafe-url") push("referrer", "Referrer-Policy", "warn", "unsafe-url leaks the full address to every site you link to.");
  else push("referrer", "Referrer-Policy", "good", `Policy is ${ref.value}.`);

  if (find(headers, "permissions-policy")) push("permissions", "Permissions-Policy", "good", "Browser features are restricted for this page.");
  else push("permissions", "Permissions-Policy", "missing", "Optional. Add it to switch off camera, microphone and location if the page does not use them.");

  const leaks = headers.filter((h) => ["x-powered-by", "x-aspnet-version", "x-aspnetmvc-version"].includes(h.name.toLowerCase()) || (h.name.toLowerCase() === "server" && /\d+\.\d+/.test(h.value)));
  if (leaks.length) push("disclosure", "Software version disclosure", "warn", `${leaks.map((h) => h.name).join(", ")} reveal${leaks.length === 1 ? "s" : ""} what software runs the site.`);

  const cookies = headers.filter((h) => h.name.toLowerCase() === "set-cookie");
  if (cookies.length) {
    const weak = cookies.filter((c) => {
      const p = params(c.value).params;
      return !p.has("secure") || !p.has("httponly");
    });
    if (weak.length) push("cookies", "Cookie flags", "warn", `${weak.length} of ${cookies.length} cookie${cookies.length === 1 ? "" : "s"} ${weak.length === 1 ? "lacks" : "lack"} Secure or HttpOnly. Session cookies should have both.`);
    else push("cookies", "Cookie flags", "good", "Every cookie is Secure and HttpOnly.");
  }

  return checks;
}

/** Parse and explain a pasted set of headers. */
export function explainHeaders(text: string): HeaderReport {
  const message = parseHeaders(text);
  const entries = message.headers.map<ExplainedHeader>((header) => {
    const lower = header.name.toLowerCase();
    const { details, flags } = explainValue(lower, header.value, message.kind);
    return { header, info: describeHeader(header.name), details, flags };
  });
  return { message, entries, checks: message.kind === "request" ? [] : securityChecks(message.headers) };
}
