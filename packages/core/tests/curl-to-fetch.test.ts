import { describe, expect, it } from "vitest";
import { curlToFetch, parseCurl, tokenize } from "../src/curl-to-fetch";

describe("tokenize", () => {
  it("handles single, double and escaped quoting", () => {
    expect(tokenize(`curl -H 'A: b c' "d e" f\\ g`).words).toEqual(["curl", "-H", "A: b c", "d e", "f g"]);
  });

  it("joins backslash line continuations", () => {
    expect(tokenize("curl \\\n  -X POST \\\r\n  https://x.test").words).toEqual(["curl", "-X", "POST", "https://x.test"]);
  });

  it("decodes $'…' strings as Chrome writes them", () => {
    expect(tokenize(String.raw`curl --data-raw $'{"a":"line1\nline2","e":"é","q":"it\'s"}'`).words[2]).toBe('{"a":"line1\nline2","e":"é","q":"it\'s"}');
  });

  it("keeps empty quoted arguments", () => {
    expect(tokenize(`curl -d '' x`).words).toEqual(["curl", "-d", "", "x"]);
  });

  it("stops at a pipe or redirect", () => {
    const t = tokenize("curl https://x.test | jq .");
    expect(t.words).toEqual(["curl", "https://x.test"]);
    expect(t.truncated).toBe(true);
  });

  it("keeps a bare & inside an unquoted URL", () => {
    expect(tokenize("curl https://x.test/?a=1&b=2").words[1]).toBe("https://x.test/?a=1&b=2");
  });

  it("rejects unclosed quotes", () => {
    expect(() => tokenize(`curl 'oops`)).toThrow(/quote is not closed/);
    expect(() => tokenize(`curl "oops`)).toThrow(/quote is not closed/);
  });
});

describe("parseCurl", () => {
  it("defaults to GET", () => {
    expect(parseCurl("curl https://api.test/users")).toMatchObject({ url: "https://api.test/users", method: "GET", headers: [], body: undefined });
  });

  it("accepts a leading prompt and curl.exe", () => {
    expect(parseCurl("$ curl https://a.test").url).toBe("https://a.test");
    expect(parseCurl("curl.exe https://a.test").url).toBe("https://a.test");
  });

  it("adds http:// when the scheme is missing, as curl does", () => {
    expect(parseCurl("curl localhost:3000/health").url).toBe("http://localhost:3000/health");
  });

  it("reads -X, -H and combined short flags", () => {
    const p = parseCurl(`curl -sSL -X delete -H 'Authorization: Bearer abc' -H "Accept:application/json" https://a.test/x/1`);
    expect(p.method).toBe("DELETE");
    expect(p.headers).toEqual([
      { name: "Authorization", value: "Bearer abc" },
      { name: "Accept", value: "application/json" },
    ]);
  });

  it("accepts values attached to short flags and --long=value", () => {
    const p = parseCurl(`curl -XPUT -H'X-A: 1' --request=PATCH https://a.test`);
    expect(p.method).toBe("PATCH");
    expect(p.headers).toEqual([{ name: "X-A", value: "1" }]);
  });

  it("infers POST and a form content type from -d", () => {
    const p = parseCurl(`curl -d a=1 -d b=2 https://a.test`);
    expect(p.method).toBe("POST");
    expect(p.body).toEqual({ kind: "text", value: "a=1&b=2" });
    expect(p.headers).toEqual([{ name: "Content-Type", value: "application/x-www-form-urlencoded" }]);
  });

  it("does not override an explicit content type", () => {
    const p = parseCurl(`curl -H 'content-type: text/plain' -d hi https://a.test`);
    expect(p.headers).toEqual([{ name: "content-type", value: "text/plain" }]);
  });

  it("encodes --data-urlencode values", () => {
    const p = parseCurl(`curl --data-urlencode 'q=a b&c' --data-urlencode 'plain text' --data-urlencode '=x y' https://a.test`);
    expect(p.body).toEqual({ kind: "text", value: "q=a+b%26c&plain+text&x+y" });
  });

  it("moves -G data to the query string", () => {
    const p = parseCurl(`curl -G -d a=1 -d b=2 https://a.test/s?x=0`);
    expect(p.method).toBe("GET");
    expect(p.url).toBe("https://a.test/s?x=0&a=1&b=2");
    expect(p.body).toBeUndefined();
  });

  it("turns --json into a JSON request", () => {
    const p = parseCurl(`curl --json '{"a":1}' https://a.test`);
    expect(p.method).toBe("POST");
    expect(p.headers).toEqual([
      { name: "Content-Type", value: "application/json" },
      { name: "Accept", value: "application/json" },
    ]);
  });

  it("builds Basic auth from -u", () => {
    expect(parseCurl("curl -u ada:s3cret https://a.test").headers).toEqual([{ name: "Authorization", value: "Basic YWRhOnMzY3JldA==" }]);
  });

  it("builds Bearer auth from --oauth2-bearer", () => {
    expect(parseCurl("curl --oauth2-bearer tok https://a.test").headers).toEqual([{ name: "Authorization", value: "Bearer tok" }]);
  });

  it("maps -A, -e, -b and -I", () => {
    const p = parseCurl(`curl -I -A 'agent/1' -e https://r.test -b 'a=1' -b 'b=2' https://a.test`);
    expect(p.method).toBe("HEAD");
    expect(p.headers).toEqual([
      { name: "User-Agent", value: "agent/1" },
      { name: "Referer", value: "https://r.test" },
      { name: "Cookie", value: "a=1; b=2" },
    ]);
  });

  it("merges repeated headers", () => {
    const p = parseCurl(`curl -H 'Accept: a' -H 'accept: b' https://a.test`);
    expect(p.headers).toEqual([{ name: "Accept", value: "a, b" }]);
  });

  it("reads multipart fields and drops a manual boundary header", () => {
    const p = parseCurl(`curl -F 'name=Ada' -F 'avatar=@me.png;type=image/png' -H 'Content-Type: multipart/form-data' https://a.test`);
    expect(p.body).toEqual({
      kind: "form",
      fields: [
        { name: "name", value: "Ada", file: false },
        { name: "avatar", value: "me.png", file: true },
      ],
    });
    expect(p.headers).toEqual([]);
    expect(p.warnings.join(" ")).toMatch(/multipart boundary/);
  });

  it("warns about file bodies, which a browser cannot read", () => {
    const p = parseCurl(`curl -d @payload.json https://a.test`);
    expect(p.body).toEqual({ kind: "file", path: "payload.json" });
    expect(p.warnings.join(" ")).toMatch(/payload\.json/);
  });

  it("treats --data-raw @x literally", () => {
    expect(parseCurl(`curl --data-raw '@x' https://a.test`).body).toEqual({ kind: "text", value: "@x" });
  });

  it("warns about unexpanded variables, ignored pipes and multiple URLs", () => {
    const p = parseCurl(`curl -H "Authorization: Bearer $TOKEN" https://a.test https://b.test | jq .`);
    expect(p.url).toBe("https://a.test");
    expect(p.warnings.join("\n")).toMatch(/\$TOKEN/);
    expect(p.warnings.join("\n")).toMatch(/pipe/);
    expect(p.warnings.join("\n")).toMatch(/Only the first/);
  });

  it("warns about options that fetch cannot express", () => {
    expect(parseCurl("curl -k https://a.test").warnings.join(" ")).toMatch(/insecure/);
    expect(parseCurl("curl --frobnicate https://a.test").warnings.join(" ")).toMatch(/--frobnicate was not recognised/);
    expect(parseCurl("curl --compressed -L -s -v https://a.test").warnings).toEqual([]);
  });

  it("warns when a GET carries a body", () => {
    expect(parseCurl("curl -X GET -d a=1 https://a.test").warnings.join(" ")).toMatch(/GET request has a body/);
  });

  it("skips a malformed header instead of failing", () => {
    const p = parseCurl(`curl -H 'nocolon' https://a.test`);
    expect(p.headers).toEqual([]);
    expect(p.warnings.join(" ")).toMatch(/no colon/);
  });

  it("explains empty, missing-URL and non-curl input", () => {
    expect(() => parseCurl("")).toThrow(/Paste a cURL command/);
    expect(() => parseCurl("   \n")).toThrow(/Paste a cURL command/);
    expect(() => parseCurl("wget https://a.test")).toThrow(/start with “curl”/);
    expect(() => parseCurl("curl -X POST")).toThrow(/No URL found/);
    expect(() => parseCurl("curl https://a.test -H")).toThrow(/needs a value/);
  });
});

describe("curlToFetch", () => {
  it("writes a plain GET", () => {
    expect(curlToFetch("curl https://a.test", { responseAs: "none" })).toBe('const response = await fetch("https://a.test");');
  });

  it("writes a JSON POST with a readable body and response handling", () => {
    const code = curlToFetch(`curl -X POST https://api.test/users -H 'Content-Type: application/json' -d '{"name":"Ada","tags":["a"]}'`);
    expect(code).toBe(
      [
        'const response = await fetch("https://api.test/users", {',
        '  method: "POST",',
        "  headers: {",
        '    "Content-Type": "application/json",',
        "  },",
        "  body: JSON.stringify({",
        '    "name": "Ada",',
        '    "tags": [',
        '      "a"',
        "    ]",
        "  }),",
        "});",
        "",
        "if (!response.ok) {",
        "  throw new Error(`Request failed with status ${response.status}`);",
        "}",
        "",
        "const data = await response.json();",
        "console.log(data);",
      ].join("\n"),
    );
  });

  it("sends invalid JSON through as the exact text", () => {
    const code = curlToFetch(`curl -H 'Content-Type: application/json' -d '{oops' https://a.test`, { responseAs: "none" });
    expect(code).toContain('body: "{oops",');
  });

  it("supports text responses", () => {
    expect(curlToFetch("curl https://a.test", { responseAs: "text" })).toContain("await response.text()");
  });

  it("builds FormData for -F", () => {
    const code = curlToFetch(`curl -F 'name=Ada' -F 'doc=@cv.pdf' https://a.test`, { responseAs: "none" });
    expect(code).toContain('const formData = new FormData();\nformData.append("name", "Ada");');
    expect(code).toContain('formData.append("doc", fileInput.files[0]); // replaces @cv.pdf');
    expect(code).toContain("body: formData,");
  });

  it("escapes quotes, newlines and unicode in strings", () => {
    const code = curlToFetch(String.raw`curl -d $'say "hi"\n😀' https://a.test`, { responseAs: "none" });
    expect(code).toContain(String.raw`body: "say \"hi\"\n😀",`);
  });

  it("neutralises a comment terminator in a file name", () => {
    const code = curlToFetch(`curl -d '@a*/b' https://a.test`, { responseAs: "none" });
    const bodyLine = code.split("\n").find((l) => l.includes("body:"))!;
    expect(bodyLine).toBe('  body: "" /* contents of a* /b */,');
  });

  it("keeps text from the command inside its comment line", () => {
    const code = curlToFetch(String.raw`curl -d $'@evil\nfetch("https://x.test")' https://a.test`, { responseAs: "none" });
    expect(code.split("\n").filter((l) => l.startsWith("fetch("))).toEqual([]);
    expect(code.split("\n")[0]).toMatch(/^\/\/ Note: .*evil fetch/);
  });

  it("notes browser-only headers, and can drop them", () => {
    const cmd = `curl 'https://a.test' -H 'Cookie: a=1' -H 'sec-fetch-mode: cors' -H 'Accept: */*'`;
    const kept = curlToFetch(cmd, { responseAs: "none" });
    expect(kept).toContain("// Note: Browsers refuse to set Cookie, sec-fetch-mode from fetch().");
    expect(kept).toContain('"Cookie": "a=1"');
    const dropped = curlToFetch(cmd, { responseAs: "none", omitBrowserHeaders: true });
    expect(dropped).not.toContain('"Cookie"');
    expect(dropped).toContain('"Accept": "*/*"');
  });

  it("puts warnings at the top as comments", () => {
    const code = curlToFetch("curl -k https://a.test", { responseAs: "none" });
    expect(code.split("\n")[0]).toMatch(/^\/\/ Note: --insecure/);
  });

  it("converts a Chrome-style multi-line command", () => {
    const cmd = [
      "curl 'https://api.test/v1/items?limit=5' \\",
      "  -H 'accept: application/json' \\",
      "  -H 'authorization: Bearer abc' \\",
      "  --compressed",
    ].join("\n");
    const code = curlToFetch(cmd, { responseAs: "none" });
    expect(code).toBe(
      ['const response = await fetch("https://api.test/v1/items?limit=5", {', "  headers: {", '    "accept": "application/json",', '    "authorization": "Bearer abc",', "  },", "});"].join("\n"),
    );
  });

  it("handles a very long command", () => {
    const headers = Array.from({ length: 2000 }, (_, i) => `-H 'X-${i}: v'`).join(" ");
    expect(curlToFetch(`curl ${headers} https://a.test`, { responseAs: "none" }).split("\n").length).toBeGreaterThan(2000);
  });
});
