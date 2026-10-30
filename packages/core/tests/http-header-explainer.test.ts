import { describe, expect, it } from "vitest";
import { describeHeader, explainHeaders, humanDuration, parseHeaders } from "../src/http-header-explainer";

const response = (extra = "") => `HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n${extra}`;
const entry = (text: string, name: string) => {
  const found = explainHeaders(text).entries.find((e) => e.header.name.toLowerCase() === name.toLowerCase());
  if (!found) throw new Error(`no ${name}`);
  return found;
};
const check = (text: string, id: string) => explainHeaders(text).checks.find((c) => c.id === id);

describe("parseHeaders", () => {
  it("reads a response with a status line", () => {
    const m = parseHeaders("HTTP/2 404 Not Found\ncontent-type: text/plain\nserver: nginx");
    expect(m.kind).toBe("response");
    expect(m.startLine).toBe("HTTP/2 404 Not Found");
    expect(m.headers.map((h) => [h.name, h.value])).toEqual([["content-type", "text/plain"], ["server", "nginx"]]);
  });

  it("reads a request with a request line", () => {
    const m = parseHeaders("GET /api/items?x=1 HTTP/1.1\nHost: example.com\nAccept: */*");
    expect(m.kind).toBe("request");
    expect(m.headers).toHaveLength(2);
  });

  it("reads bare headers and guesses the direction", () => {
    expect(parseHeaders("Host: a.com\nUser-Agent: x\nCookie: a=1").kind).toBe("request");
    expect(parseHeaders("Server: nginx\nSet-Cookie: a=1\nETag: \"x\"").kind).toBe("response");
    expect(parseHeaders("X-Custom: 1").kind).toBe("unknown");
    expect(parseHeaders(":status: 200\ncontent-type: a/b").kind).toBe("response");
    expect(parseHeaders(":method: GET\n:path: /\nhost: a").kind).toBe("request");
  });

  it("handles CRLF, CR, tabs and no space after the colon", () => {
    const m = parseHeaders("A:1\r\nB:\t2\rC:  3  ");
    expect(m.headers.map((h) => h.value)).toEqual(["1", "2", "3"]);
  });

  it("keeps colons inside values", () => {
    expect(parseHeaders("Host: example.com:8080\nLocation: https://x.test/a:b").headers.map((h) => h.value)).toEqual(["example.com:8080", "https://x.test/a:b"]);
  });

  it("joins folded continuation lines", () => {
    const m = parseHeaders("X-Long: first\n  second\n\tthird\nNext: 1");
    expect(m.headers[0]?.value).toBe("first second third");
    expect(m.headers).toHaveLength(2);
  });

  it("skips leading blank lines and stops at the body", () => {
    const m = parseHeaders("\n\nHTTP/1.1 200 OK\nA: 1\n\n<html>B: not a header</html>");
    expect(m.headers.map((h) => h.name)).toEqual(["A"]);
  });

  it("warns about redirect chains instead of merging them", () => {
    const m = parseHeaders("HTTP/1.1 301 Moved\nLocation: /x\n\nHTTP/1.1 200 OK\nServer: s");
    expect(m.headers.map((h) => h.name)).toEqual(["Location"]);
    expect(m.warnings.join(" ")).toMatch(/Only the first message/);
  });

  it("warns about lines that are not headers", () => {
    const m = parseHeaders("A: 1\nthis is not a header\nB: 2");
    expect(m.headers).toHaveLength(2);
    expect(m.warnings[0]).toMatch(/Line 2 is not a header/);
  });

  it("warns about odd header names", () => {
    const m = parseHeaders("Bad Name: 1\nOk: 2");
    expect(m.headers.map((h) => h.name)).toEqual(["Ok"]);
    expect(m.warnings[0]).toMatch(/Line 1/);
  });

  it("keeps repeated headers separate and in order", () => {
    const m = parseHeaders("Set-Cookie: a=1\nSet-Cookie: b=2");
    expect(m.headers.map((h) => h.value)).toEqual(["a=1", "b=2"]);
  });

  it("copes with empty and whitespace-only input", () => {
    expect(parseHeaders("")).toMatchObject({ headers: [], kind: "unknown" });
    expect(parseHeaders("  \n \n")).toMatchObject({ headers: [], kind: "unknown" });
  });

  it("accepts empty values and unicode", () => {
    const m = parseHeaders("X-Empty:\nX-Name: café 🙂");
    expect(m.headers.map((h) => h.value)).toEqual(["", "café 🙂"]);
  });

  it("caps the number of headers", () => {
    const text = Array.from({ length: 2500 }, (_, i) => `X-${i}: v`).join("\n");
    const m = parseHeaders(text);
    expect(m.headers).toHaveLength(2000);
    expect(m.warnings.join(" ")).toMatch(/Stopped after 2000/);
  });

  it("records line numbers", () => {
    expect(parseHeaders("HTTP/1.1 200 OK\nA: 1\nB: 2").headers.map((h) => h.line)).toEqual([2, 3]);
  });
});

describe("describeHeader", () => {
  it("finds headers in any capitalization", () => {
    expect(describeHeader("content-TYPE")?.name).toBe("Content-Type");
    expect(describeHeader("X-Unknown-Thing")).toBeNull();
    expect(describeHeader("constructor")).toBeNull();
    expect(describeHeader("__proto__")).toBeNull();
  });
});

describe("humanDuration", () => {
  it.each([
    [0, "0 seconds"],
    [1, "1 second"],
    [90, "1 minute 30 seconds"],
    [3600, "1 hour"],
    [86_400, "1 day"],
    [31_536_000, "1 year"],
    [63_072_000, "2 years"],
    [90_000, "1 day 1 hour"],
    [-5, "an invalid time"],
    [NaN, "an invalid time"],
  ])("%s -> %s", (input, out) => {
    expect(humanDuration(input)).toBe(out);
  });
});

describe("value explanations", () => {
  it("explains Cache-Control", () => {
    const e = entry("Cache-Control: public, max-age=31536000, immutable", "cache-control");
    expect(e.details.join(" ")).toMatch(/fresh for 1 year/);
    expect(e.details.join(" ")).toMatch(/immutable/);
    expect(entry("Cache-Control: no-store", "cache-control").flags[0]?.text).toMatch(/Nothing will be cached/);
    expect(entry("Cache-Control: public, private", "cache-control").flags.some((f) => f.level === "warn")).toBe(true);
    expect(entry("Cache-Control: wibble", "cache-control").details[0]).toMatch(/not a directive/);
  });

  it("explains cookies and flags missing protections", () => {
    const weak = entry("Set-Cookie: sid=abc", "set-cookie");
    expect(weak.flags.filter((f) => f.level === "warn")).toHaveLength(2);
    expect(weak.details.join(" ")).toMatch(/session cookie/);

    const strong = entry("Set-Cookie: sid=abc; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax", "set-cookie");
    expect(strong.flags.filter((f) => f.level === "good")).toHaveLength(3);
    expect(strong.details.join(" ")).toMatch(/1 hour/);
  });

  it("checks cookie prefixes and SameSite=None", () => {
    expect(entry("Set-Cookie: __Host-id=1; Secure; Path=/; Domain=a.com", "set-cookie").flags.some((f) => /__Host-/.test(f.text))).toBe(true);
    expect(entry("Set-Cookie: __Host-id=1; Secure; Path=/", "set-cookie").flags.some((f) => /__Host-/.test(f.text))).toBe(false);
    expect(entry("Set-Cookie: __Secure-id=1", "set-cookie").flags.some((f) => /__Secure-/.test(f.text))).toBe(true);
    expect(entry("Set-Cookie: a=1; SameSite=None", "set-cookie").flags.some((f) => /only works together with Secure/.test(f.text))).toBe(true);
  });

  it("lists the names in a Cookie header without echoing values", () => {
    const e = entry("Cookie: sid=secret; theme=dark", "cookie");
    expect(e.details[0]).toBe("2 cookies: sid, theme.");
    expect(JSON.stringify(e.details)).not.toContain("secret");
  });

  it("explains Strict-Transport-Security", () => {
    const e = entry("Strict-Transport-Security: max-age=63072000; includeSubDomains; preload", "strict-transport-security");
    expect(e.details.join(" ")).toMatch(/2 years/);
    expect(e.details.join(" ")).toMatch(/includeSubDomains/);
    expect(entry("Strict-Transport-Security: includeSubDomains", "strict-transport-security").flags[0]?.level).toBe("warn");
  });

  it("breaks down a Content-Security-Policy and warns about weak sources", () => {
    const e = entry("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'", "content-security-policy");
    expect(e.details).toEqual(["default-src: 'self'", "script-src: 'self' 'unsafe-inline'", "object-src: 'none'"]);
    expect(e.flags.some((f) => /unsafe-inline/.test(f.text))).toBe(true);
    expect(entry("Content-Security-Policy-Report-Only: default-src 'self'", "content-security-policy-report-only").flags[0]?.text).toMatch(/nothing is blocked/);
  });

  it("explains Content-Type and Content-Length", () => {
    expect(entry("Content-Type: application/json; charset=UTF-8", "content-type").details).toEqual(["Media type: application/json.", "Character set: UTF-8."]);
    expect(entry("HTTP/1.1 200 OK\nContent-Type: text/html", "content-type").flags[0]?.text).toMatch(/No charset/);
    expect(entry("Content-Length: 2048", "content-length").details[0]).toBe("2 KB (2,048 bytes)");
    expect(entry("Content-Length: 12", "content-length").details[0]).toBe("12 bytes");
    expect(entry("Content-Length: 1", "content-length").details[0]).toBe("1 byte");
    expect(entry("Content-Length: abc", "content-length").flags[0]?.level).toBe("warn");
  });

  it("reads quality values", () => {
    const e = entry("Accept-Language: en-GB,en;q=0.8,fr;q=0", "accept-language");
    expect(e.details).toEqual(["en-GB: preferred.", "en: preference 0.8.", "fr: not acceptable."]);
  });

  it("explains CORS headers", () => {
    expect(entry("Access-Control-Allow-Origin: *", "access-control-allow-origin").flags[0]?.text).toMatch(/Any website/);
    expect(entry("Access-Control-Allow-Origin: null", "access-control-allow-origin").flags[0]?.level).toBe("warn");
    expect(entry("Access-Control-Allow-Origin: https://a.test", "access-control-allow-origin").details[0]).toMatch(/https:\/\/a\.test/);
    expect(entry("Access-Control-Allow-Credentials: true", "access-control-allow-credentials").flags).toHaveLength(1);
  });

  it("reads dates", () => {
    expect(entry("Date: Tue, 15 Nov 1994 08:12:31 GMT", "date").details[0]).toBe("1994-11-15T08:12:31Z (UTC).");
    expect(entry("Expires: 0", "expires").details[0]).toMatch(/already expired/);
    expect(entry("Last-Modified: nonsense", "last-modified").flags[0]?.level).toBe("warn");
  });

  it("warns that Authorization holds credentials without decoding it", () => {
    const e = entry("Authorization: Basic dXNlcjpwYXNz", "authorization");
    expect(e.details[0]).toBe("Scheme: Basic.");
    expect(e.flags[0]?.level).toBe("warn");
    expect(JSON.stringify(e)).not.toContain("user:pass");
  });

  it("explains framing, sniffing and referrer headers", () => {
    expect(entry("X-Frame-Options: DENY", "x-frame-options").flags[0]?.level).toBe("good");
    expect(entry("X-Frame-Options: ALLOW-FROM https://a.test", "x-frame-options").flags[0]?.level).toBe("warn");
    expect(entry("X-Content-Type-Options: nosniff", "x-content-type-options").flags[0]?.level).toBe("good");
    expect(entry("Referrer-Policy: unsafe-url", "referrer-policy").flags[0]?.level).toBe("warn");
  });

  it("notes version disclosure", () => {
    expect(entry("Server: nginx/1.25.3", "server").flags).toHaveLength(1);
    expect(entry("Server: nginx", "server").flags).toHaveLength(0);
    expect(entry("X-Powered-By: Express", "x-powered-by").flags).toHaveLength(1);
  });

  it("explains Vary, Age, Location and Retry-After", () => {
    expect(entry("Vary: Accept-Encoding, Origin", "vary").details[0]).toMatch(/Accept-Encoding, Origin/);
    expect(entry("Vary: *", "vary").details[0]).toMatch(/cannot be cached/);
    expect(entry("Age: 120", "age").details[0]).toMatch(/2 minutes/);
    expect(entry("Location: /next", "location").details[0]).toBe("Points to /next.");
    expect(entry("Retry-After: 3600", "retry-after").details[0]).toMatch(/1 hour/);
  });

  it("attaches a summary to known headers only", () => {
    const report = explainHeaders("Content-Type: a/b\nX-Mystery: 1");
    expect(report.entries[0]?.info?.group).toBe("content");
    expect(report.entries[1]?.info).toBeNull();
    expect(report.entries[1]?.details).toEqual([]);
  });
});

describe("security checks", () => {
  it("flags everything missing on a bare response", () => {
    const r = explainHeaders(response());
    const status = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(status).toMatchObject({ hsts: "missing", csp: "missing", nosniff: "missing", frames: "missing", referrer: "missing", permissions: "missing" });
    expect(r.checks.find((c) => c.id === "disclosure")).toBeUndefined();
  });

  it("passes a well configured response", () => {
    const good = response(
      [
        "Strict-Transport-Security: max-age=63072000; includeSubDomains",
        "Content-Security-Policy: default-src 'self'; frame-ancestors 'none'",
        "X-Content-Type-Options: nosniff",
        "Referrer-Policy: strict-origin-when-cross-origin",
        "Permissions-Policy: camera=()",
        "Set-Cookie: sid=1; Secure; HttpOnly; SameSite=Lax",
      ].join("\r\n"),
    );
    const r = explainHeaders(good);
    expect(r.checks.every((c) => c.status === "good")).toBe(true);
    expect(r.checks.map((c) => c.id)).toContain("cookies");
  });

  it("warns about short HSTS, weak CSP, bad framing headers and leaks", () => {
    expect(check(response("Strict-Transport-Security: max-age=300"), "hsts")?.status).toBe("warn");
    expect(check(response("Strict-Transport-Security: preload"), "hsts")?.status).toBe("warn");
    expect(check(response("Content-Security-Policy: script-src * 'unsafe-eval'"), "csp")?.message).toMatch(/unsafe-eval/);
    expect(check(response("Content-Security-Policy: img-src 'self'"), "csp")?.message).toMatch(/not restricted/);
    expect(check(response("X-Frame-Options: ALLOW-FROM x"), "frames")?.status).toBe("warn");
    expect(check(response("X-Content-Type-Options: yes"), "nosniff")?.status).toBe("warn");
    expect(check(response("Referrer-Policy: unsafe-url"), "referrer")?.status).toBe("warn");
    expect(check(response("Server: Apache/2.4.1\r\nX-Powered-By: PHP/8.1"), "disclosure")?.message).toMatch(/Server, X-Powered-By reveal/);
  });

  it("counts weak cookies", () => {
    const c = check(response("Set-Cookie: a=1; Secure; HttpOnly\r\nSet-Cookie: b=2"), "cookies");
    expect(c?.status).toBe("warn");
    expect(c?.message).toMatch(/1 of 2 cookies lacks/);
  });

  it("does not grade requests", () => {
    expect(explainHeaders("GET / HTTP/1.1\nHost: a.test").checks).toEqual([]);
  });

  it("copes with empty input", () => {
    const r = explainHeaders("");
    expect(r.entries).toEqual([]);
  });
});
