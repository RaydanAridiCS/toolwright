import { describe, expect, it } from "vitest";
import { parseCurl } from "../src/curl-to-fetch";
import { fetchToCurl, generateCurl, parseFetch, shellQuote } from "../src/fetch-to-curl";

const oneLine = (code: string, extra = {}) => fetchToCurl(code, { multiline: false, ...extra });

describe("fetchToCurl: the basics", () => {
  it("converts a bare GET", () => {
    expect(oneLine('fetch("https://example.com/api")')).toBe("curl 'https://example.com/api' -L");
  });

  it("converts a POST with headers and a JSON body", () => {
    const out = fetchToCurl(`
      const response = await fetch('https://api.example.com/v1/users', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer abc',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Ada', admin: false }),
      });
      const data = await response.json();
    `);
    expect(out).toBe(
      [
        "curl 'https://api.example.com/v1/users' \\",
        "  -H 'Authorization: Bearer abc' \\",
        "  -H 'Content-Type: application/json' \\",
        `  --data-raw '{"name":"Ada","admin":false}' \\`,
        "  -L",
      ].join("\n"),
    );
  });

  it("uses -X only when curl would not pick the method by itself", () => {
    expect(oneLine('fetch("https://x.test", { method: "POST", body: "a=1" })')).not.toContain("-X");
    expect(oneLine('fetch("https://x.test", { method: "PUT", body: "a" })')).toContain("-X PUT");
    expect(oneLine('fetch("https://x.test", { method: "delete" })')).toContain("-X DELETE");
    expect(oneLine('fetch("https://x.test", { method: "HEAD" })')).toContain("-I");
    expect(oneLine('fetch("https://x.test", { method: "GET" })')).not.toContain("-X");
  });

  it("pretty-prints JSON.stringify with an indent argument", () => {
    const out = oneLine('fetch("https://x.test", { method: "POST", body: JSON.stringify({ a: [1, 2] }, null, 2) })');
    expect(out).toContain('--data-raw \'{\n  "a": [\n    1,\n    2\n  ]\n}\'');
  });

  it("quotes single quotes safely", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
    expect(oneLine(`fetch("https://x.test", { headers: { "X-Note": "it's fine" } })`)).toContain(`-H 'X-Note: it'\\''s fine'`);
  });

  it("can put everything on one line and add --compressed", () => {
    const out = fetchToCurl('fetch("https://x.test", { method: "PATCH", body: "x" })', { multiline: false, compressed: true });
    expect(out.split("\n")).toHaveLength(1);
    expect(out).toContain("--compressed");
  });
});

describe("fetchToCurl: reading JavaScript", () => {
  it("handles template literals, joins and variables, and says which parts need a value", () => {
    const out = fetchToCurl("fetch(`https://api.test/users/${id}`, { headers: { Authorization: 'Bearer ' + token } })");
    expect(out).toContain("'https://api.test/users/${id}'");
    expect(out).toContain("'Authorization: Bearer ${token}'");
    expect(out).toMatch(/# Note: Parts that come from variables are kept as \$\{name\}/);
  });

  it("joins strings with +", () => {
    expect(oneLine('fetch("https://api.test" + "/v1" + "/ping")')).toContain("'https://api.test/v1/ping'");
  });

  it("decodes escapes in strings", () => {
    expect(oneLine('fetch("https://x.test", { method: "POST", body: "line1\\nline2 \\u00e9 \\"q\\"" })')).toContain('--data-raw \'line1\nline2 é "q"\'');
  });

  it("ignores comments, trailing commas and fetch inside strings or comments", () => {
    const out = oneLine(`
      // fetch("https://wrong.example")
      const note = "call fetch('https://also-wrong.example')";
      /* fetch("https://nope.example") */
      fetch("https://right.example", { /* why */ method: "PUT", body: "x", },)
    `);
    expect(out).toContain("'https://right.example'");
    expect(out).not.toContain("wrong");
    expect(out).not.toContain("nope");
  });

  it("finds window.fetch but not other objects' fetch methods", () => {
    expect(oneLine('window.fetch("https://a.test")')).toContain("a.test");
    expect(() => fetchToCurl('api.fetch("https://a.test")')).toThrow(/No fetch/);
  });

  it("keeps only the first call, and ignores a .then chain after it", () => {
    const out = oneLine('fetch("https://one.test").then(r => r.json()).then(d => fetch("https://two.test"))');
    expect(out).toContain("one.test");
    expect(out).not.toContain("two.test");
  });

  it("accepts new Request(url, init)", () => {
    expect(oneLine('fetch(new Request("https://r.test", { method: "POST", body: "z" }))')).toContain("'https://r.test'");
  });

  it("reads new Headers with an object or pairs", () => {
    expect(oneLine('fetch("https://x.test", { headers: new Headers({ Accept: "text/html" }) })')).toContain("-H 'Accept: text/html'");
    expect(oneLine('fetch("https://x.test", { headers: new Headers([["X-A", "1"], ["X-B", "2"]]) })')).toContain("-H 'X-B: 2'");
    expect(oneLine('fetch("https://x.test", { headers: [["X-A", "1"]] })')).toContain("-H 'X-A: 1'");
  });

  it("skips what it cannot read and says so", () => {
    const out = fetchToCurl('fetch(url, { ...defaults, [key]: 1, headers: authHeaders, method: "POST", body: payload })');
    expect(out).toMatch(/# Note: “\.\.\.defaults” is spread/);
    expect(out).toMatch(/computed key \[key\]/);
    expect(out).toMatch(/headers come from \$\{authHeaders\}/);
    expect(out).toMatch(/body comes from \$\{payload\}/);
    expect(out).toContain("'${url}'");
  });
});

describe("fetchToCurl: bodies", () => {
  it("labels a plain string body the way fetch does, so curl does not send it as a form", () => {
    const parsed = parseFetch('fetch("https://x.test", { method: "POST", body: "hello" })');
    expect(parsed.headers).toContainEqual({ name: "Content-Type", value: "text/plain;charset=UTF-8" });
  });

  it("does not add a Content-Type when one is given, in any letter case", () => {
    const parsed = parseFetch('fetch("https://x.test", { method: "POST", headers: { "content-type": "text/csv" }, body: "a,b" })');
    expect(parsed.headers).toEqual([{ name: "content-type", value: "text/csv" }]);
  });

  it("encodes URLSearchParams the way a browser does", () => {
    const parsed = parseFetch('fetch("https://x.test", { method: "POST", body: new URLSearchParams({ q: "a b&c", note: "it\'s (ok)" }) })');
    expect(parsed.body).toEqual({ kind: "text", value: "q=a+b%26c&note=it%27s+%28ok%29", implicitType: "application/x-www-form-urlencoded;charset=UTF-8" });
    expect(parseFetch('fetch("https://x.test", { method: "POST", body: new URLSearchParams("?a=1&b=2") })').body).toMatchObject({ value: "a=1&b=2" });
  });

  it("reads FormData built with append", () => {
    const out = fetchToCurl(`
      const formData = new FormData();
      formData.append("title", "My file");
      formData.append("file", fileInput.files[0]);
      fetch("https://up.test/upload", { method: "POST", body: formData });
    `);
    expect(out).toContain("--form-string 'title=My file'");
    expect(out).toContain("-F 'file=@fileInput.files[0]'");
    expect(out).toMatch(/# Note: A form field holds a file/);
    expect(out).not.toContain("--data-raw");
  });

  it("drops a hand-written multipart Content-Type", () => {
    const out = fetchToCurl(`
      const fd = new FormData(); fd.append("a", "1");
      fetch("https://x.test", { method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: fd });
    `);
    expect(out).not.toContain("-H");
    expect(out).toMatch(/boundary/);
  });

  it("warns about a GET with a body and a body that is a bare object", () => {
    expect(fetchToCurl('fetch("https://x.test", { body: "a" })')).toMatch(/GET request has a body/);
    expect(fetchToCurl('fetch("https://x.test", { method: "POST", body: { a: 1 } })')).toMatch(/JSON\.stringify/);
  });
});

describe("fetchToCurl: options", () => {
  it("adds -L like fetch's default, and not for redirect: manual", () => {
    expect(oneLine('fetch("https://x.test")')).toContain("-L");
    expect(oneLine('fetch("https://x.test", { redirect: "manual" })')).not.toContain("-L");
    expect(oneLine('fetch("https://x.test")', { followRedirects: false })).not.toContain("-L");
  });

  it("lists options curl cannot use, and explains credentials", () => {
    const out = fetchToCurl('fetch("https://x.test", { mode: "cors", cache: "no-store", credentials: "include", keepalive: true, wat: 1 })');
    expect(out).toMatch(/left out: mode, cache, keepalive/);
    expect(out).toMatch(/credentials: "include" sends the browser's cookies/);
    expect(out).toMatch(/“wat” is not a fetch option/);
  });

  it("warns about relative addresses and adds a scheme to bare hosts", () => {
    expect(fetchToCurl('fetch("/api/me")')).toMatch(/relative/);
    expect(oneLine('fetch("example.com/x")')).toContain("'http://example.com/x'");
  });
});

describe("fetchToCurl: errors", () => {
  it("explains empty input, missing fetch, missing address and unclosed code", () => {
    expect(() => fetchToCurl("   ")).toThrow(/Paste some JavaScript/);
    expect(() => fetchToCurl("const x = 1;")).toThrow(/No fetch\(/);
    expect(() => fetchToCurl("fetch()")).toThrow(/needs an address/);
    expect(() => fetchToCurl('fetch("https://x.test", { method: "POST"')).toThrow(/not closed/);
    expect(() => fetchToCurl('fetch("https://x.test)')).toThrow(/not closed/);
    expect(() => fetchToCurl("fetch(`https://x.test)")).toThrow(/not closed/);
  });

  it("never evaluates the code", () => {
    const g = globalThis as unknown as { __pwned?: boolean };
    delete g.__pwned;
    const out = fetchToCurl('fetch("https://x.test", { method: (globalThis.__pwned = true, "POST"), body: eval("globalThis.__pwned = true") })');
    expect(g.__pwned).toBeUndefined();
    expect(out).toContain("curl 'https://x.test'");
    expect(out).toContain("# Note:");
  });

  it("copes with very long and deeply nested input", () => {
    const deep = `${"[".repeat(200_000)}${"]".repeat(200_000)}`;
    expect(() => fetchToCurl(`fetch("https://x.test", { method: "POST", body: JSON.stringify(${deep}) })`)).toThrow(/nested too deeply/);
    const long = "a".repeat(200_000);
    expect(oneLine(`fetch("https://x.test", { method: "POST", body: "${long}" })`).length).toBeGreaterThan(200_000);
  });
});

describe("round trip through the cURL parser", () => {
  const cases = [
    'fetch("https://api.test/items?x=1&y=2")',
    'fetch("https://api.test/items", { method: "POST", headers: { "Content-Type": "application/json", "X-Key": "it\'s" }, body: JSON.stringify({ a: 1, b: ["x", "y"] }) })',
    'fetch("https://api.test/f", { method: "PUT", headers: { Authorization: "Bearer t" }, body: "plain text" })',
    'fetch("https://api.test/f", { method: "DELETE" })',
    'fetch("https://api.test/f", { method: "POST", body: new URLSearchParams({ a: "1 2", b: "x&y" }) })',
  ];
  for (const code of cases) {
    it(`keeps the request intact: ${code.slice(0, 50)}…`, () => {
      const wanted = parseFetch(code);
      const parsed = parseCurl(fetchToCurl(code));
      expect(parsed.url).toBe(wanted.url);
      expect(parsed.method).toBe(wanted.method);
      const names = (h: { name: string; value: string }[]) => Object.fromEntries(h.map((x) => [x.name.toLowerCase(), x.value]));
      expect(names(parsed.headers)).toEqual(names(wanted.headers));
      if (wanted.body?.kind === "text") expect(parsed.body).toEqual({ kind: "text", value: wanted.body.value });
      else expect(parsed.body).toBeUndefined();
      expect(parsed.warnings).toEqual([]);
    });
  }
});

describe("generateCurl", () => {
  it("can be driven from a parsed request", () => {
    expect(generateCurl({ url: "https://a.test", method: "GET", headers: [], followRedirects: true, warnings: [] }, { multiline: false })).toBe("curl 'https://a.test' -L");
  });
});
