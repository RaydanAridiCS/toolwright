import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  XML_LIMITS,
  XmlError,
  describeValidation,
  formatXml,
  isXmlName,
  jsonToXml,
  minifyXml,
  parseXml,
  validateXml,
  xmlToJson,
} from "../src/xml-formatter";

const FIXTURES = join(import.meta.dirname, "fixtures", "xml");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

/** What a person would see: the message of the error the reader throws. */
function problem(source: string): string {
  try {
    parseXml(source);
  } catch (err) {
    expect(err).toBeInstanceOf(XmlError);
    return (err as XmlError).message;
  }
  throw new Error("Expected the XML to be rejected");
}

describe("parseXml: what it accepts", () => {
  it("reads elements, attributes, text, comments, CDATA and processing instructions", () => {
    const doc = parseXml(`<?xml version="1.0" encoding="UTF-8"?><!-- top --><a x="1" y='2'>hi<b/><![CDATA[<raw>]]><?pi data?></a><!-- end -->`);
    expect(doc.root.name).toBe("a");
    expect(doc.root.attrs.map((a) => [a.name, a.value, a.quote])).toEqual([
      ["x", "1", '"'],
      ["y", "2", "'"],
    ]);
    expect(doc.root.children.map((c) => c.type)).toEqual(["text", "element", "cdata", "pi"]);
    expect(doc.encoding).toBe("UTF-8");
    expect(doc.before.map((n) => n.type)).toEqual(["pi", "comment"]);
    expect(doc.after.map((n) => n.type)).toEqual(["comment"]);
    expect(doc.stats).toMatchObject({ elements: 2, attributes: 2, maxDepth: 2, comments: 2 });
  });

  it("decodes the five built-in entities and number references, and keeps the original spelling too", () => {
    const doc = parseXml(`<a t="&lt;&amp;&#169;&#x1F600;">&quot;&apos;&gt;</a>`);
    expect(doc.root.attrs[0]).toMatchObject({ value: "<&©😀", raw: "&lt;&amp;&#169;&#x1F600;" });
    const text = doc.root.children[0];
    expect(text).toMatchObject({ type: "text", value: `"'>`, raw: "&quot;&apos;&gt;" });
  });

  it("accepts a byte order mark, CRLF line endings and unicode names", () => {
    expect(parseXml("\uFEFF<root/>").root.name).toBe("root");
    expect(parseXml("<a>\r\n<b/>\r\n</a>").stats.elements).toBe(2);
    expect(parseXml("<日本語 属性='値'>テキスト</日本語>").root.name).toBe("日本語");
    expect(parseXml("<_a-b.c:d/>").root.name).toBe("_a-b.c:d");
  });

  it("accepts a DOCTYPE with an internal subset and keeps declared entities as written", () => {
    const doc = parseXml(`<?xml version="1.0"?>\n<!DOCTYPE note [\n<!ENTITY writer "Donald">\n<!ELEMENT note (#PCDATA)>\n]>\n<note>by &writer;</note>`);
    expect(doc.before.some((n) => n.type === "doctype")).toBe(true);
    expect(doc.root.children[0]).toMatchObject({ value: "by &writer;" });
  });

  it("accepts a lone root, an empty root and attributes with spaces around =", () => {
    expect(parseXml("<a/>").stats.elements).toBe(1);
    expect(parseXml("<a></a>").root.children).toEqual([]);
    expect(parseXml('<a  b = "1"\n c=\'2\' />').root.attrs).toHaveLength(2);
  });
});

describe("parseXml: what it rejects, with a position and a reason", () => {
  it("names the line and column of a mismatched closing tag", () => {
    const msg = problem("<a>\n  <b>\n  </c>\n</a>");
    expect(msg).toMatch(/^Line 3, column 3:/);
    expect(msg).toContain("Expected </b>");
    expect(msg).toContain("opened on line 2");
    expect(msg).toContain("found </c>");
  });
  it("reports tags that are never closed, naming where they opened", () => {
    expect(problem("<a>\n<b>text")).toMatch(/<b> opened on line 2 is never closed/);
    expect(problem("<a")).toMatch(/never finished/);
    expect(problem('<a b="1')).toMatch(/never closed/);
  });
  it("rejects a closing tag with nothing open, a second root and text outside the root", () => {
    expect(problem("</a>")).toMatch(/no matching opening tag/);
    expect(problem("<a/><b/>")).toMatch(/only one root element/);
    expect(problem("hello<a/>")).toMatch(/text before the root/);
    expect(problem("<a/>hello")).toMatch(/text after the root/);
  });
  it("rejects an empty file and a file with only a declaration", () => {
    expect(problem("")).toMatch(/no root element/);
    expect(problem("   \n ")).toMatch(/no root element/);
    expect(problem('<?xml version="1.0"?>')).toMatch(/no root element/);
  });
  it("rejects a declaration that is not first, or has no version", () => {
    expect(problem('\n<?xml version="1.0"?><a/>')).toMatch(/very first thing/);
    expect(problem("<?xml encoding='utf-8'?><a/>")).toMatch(/needs a version/);
  });
  it("rejects attribute problems", () => {
    expect(problem('<a b="1" b="2"/>')).toMatch(/"b" appears twice/);
    expect(problem("<a b/>")).toMatch(/needs a value/);
    expect(problem("<a b=1/>")).toMatch(/must be in quotes/);
    expect(problem('<a b="1"c="2"/>')).toMatch(/space before them/);
    expect(problem('<a b="x<y"/>')).toMatch(/contains a </);
  });
  it("explains a bare & and an unknown entity such as &nbsp;", () => {
    expect(problem("<a>fish & chips</a>")).toMatch(/lone & is not allowed/);
    expect(problem("<a>AT&T;</a>")).toMatch(/Unknown entity &T;/);
    expect(problem("<a>&nbsp;</a>")).toMatch(/Unknown entity &nbsp;.*&#160;/);
    expect(problem("<a>&#xD800;</a>")).toMatch(/does not allow/);
    expect(problem("<a>&#0;</a>")).toMatch(/does not allow/);
    expect(problem("<a>&#xZZ;</a>")).toMatch(/not a valid character reference/);
  });
  it("rejects a bare < in text, ]]> in text and bad comments", () => {
    expect(problem("<a>1 < 2</a>")).toMatch(/must be followed by a tag name/);
    expect(problem("<a>x ]]> y</a>")).toMatch(/]]>/);
    expect(problem("<a><!-- a -- b --></a>")).toMatch(/two hyphens/);
    expect(problem("<a><!-- ends with --->")).toMatch(/two hyphens/);
    expect(problem("<a><!-- never ends</a>")).toMatch(/never closed/);
  });
  it("rejects control characters and gives their code", () => {
    expect(problem("<a>x\u0001y</a>")).toMatch(/U\+0001/);
    expect(problem("<a>\u0000</a>")).toMatch(/U\+0000/);
  });
  it("rejects unsupported markup and misplaced CDATA or DOCTYPE", () => {
    expect(problem("<!ELEMENT a><a/>")).toMatch(/not supported/);
    expect(problem("<!doctype html><html/>")).toMatch(/not supported/);
    expect(problem("<![CDATA[x]]><a/>")).toMatch(/inside an element/);
    expect(problem("<a/><!DOCTYPE a>")).toMatch(/before the root/);
    expect(problem("<!DOCTYPE a><!DOCTYPE a><a/>")).toMatch(/only one DOCTYPE/);
    expect(problem("<!DOCTYPE a [<a/>")).toMatch(/never closed/);
  });
  it("is not fooled by HTML pasted in place of XML", () => {
    expect(problem("<html><body><br><p>hi</p></body></html>")).toMatch(/Expected <br>|never closed|Expected </);
  });
  it("rejects names that are not names", () => {
    expect(problem("<1a/>")).toMatch(/tag name/);
    expect(problem("< a/>")).toMatch(/tag name/);
  });
  it("refuses input that is too large, and input that is not text", () => {
    expect(() => parseXml("<a>" + "x".repeat(XML_LIMITS.maxChars) + "</a>")).toThrow(/million characters/);
    expect(() => parseXml(undefined as unknown as string)).toThrow(XmlError);
  });
});

describe("parseXml: namespaces", () => {
  it("warns about a prefix that is never declared, once", () => {
    const doc = parseXml("<a><x:b/><x:c x:attr='1'/></a>");
    expect(doc.warnings).toHaveLength(1);
    expect(doc.warnings[0]?.message).toContain('"x:"');
  });
  it("is quiet when the prefix is declared on the element or an ancestor, and for xml and xmlns", () => {
    expect(parseXml('<a xmlns:x="u"><x:b x:c="1"/></a>').warnings).toEqual([]);
    expect(parseXml('<x:a xmlns:x="u"/>').warnings).toEqual([]);
    expect(parseXml('<a xml:lang="en" xmlns:q="u"/>').warnings).toEqual([]);
  });
  it("stops treating a prefix as declared once its element is closed", () => {
    const doc = parseXml('<a><b xmlns:x="u"><x:c/></b><x:d/></a>');
    expect(doc.warnings).toHaveLength(1);
    expect(doc.warnings[0]?.line).toBe(1);
  });
  it("caps how many warnings it collects", () => {
    const many = "<a>" + Array.from({ length: 100 }, (_, i) => `<p${i}:x/>`).join("") + "</a>";
    expect(parseXml(many).warnings).toHaveLength(XML_LIMITS.maxWarnings);
  });
});

describe("hostile and extreme input", () => {
  it("does not expand entities: a billion-laughs file is read in a blink and stays small", () => {
    const lol =
      `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">` +
      `<!ENTITY lol9 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">]><lolz>&lol9;</lolz>`;
    const started = Date.now();
    const out = formatXml(lol);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(out.length).toBeLessThan(lol.length * 2);
    expect(out).toContain("&lol9;");
  });
  it("does not load external entities", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`;
    const out = minifyXml(xxe);
    expect(out).toContain("&xxe;");
    expect(out).not.toContain("root:");
  });
  it("reads a 50,000-deep file without overflowing the stack, and can shrink and check it", () => {
    const depth = 50_000;
    const deep = "<a>".repeat(depth) + "x" + "</a>".repeat(depth);
    const doc = parseXml(deep);
    expect(doc.stats.maxDepth).toBe(depth);
    expect(minifyXml(deep)).toBe(deep);
    expect(validateXml(deep).maxDepth).toBe(depth);
  }, 60_000);
  it("refuses to format a file that deep, instead of writing gigabytes of indentation", () => {
    const depth = 50_000;
    const deep = "<a>".repeat(depth) + "</a>".repeat(depth);
    expect(() => formatXml(deep)).toThrow(/too large/);
  }, 60_000);
  it("refuses to convert a file that deep to JSON, with a readable message", () => {
    const depth = XML_LIMITS.maxConvertDepth + 5;
    expect(() => xmlToJson("<a>".repeat(depth) + "</a>".repeat(depth))).toThrow(/too deep/);
  });
  it("handles 100,000 attributes and 100,000 siblings", () => {
    const attrs = Array.from({ length: 100_000 }, (_, i) => `a${i}="${i}"`).join(" ");
    expect(parseXml(`<e ${attrs}/>`).root.attrs).toHaveLength(100_000);
    const siblings = "<r>" + "<i/>".repeat(100_000) + "</r>";
    expect(parseXml(siblings).root.children).toHaveLength(100_000);
  }, 60_000);
  it("does not choke on a very long text run or a huge comment", () => {
    expect(parseXml(`<a>${"x".repeat(5_000_000)}</a>`).root.children).toHaveLength(1);
    expect(parseXml(`<a><!--${"y".repeat(1_000_000)}--></a>`).stats.comments).toBe(1);
  });
  it("treats __proto__ as an ordinary name in JSON, not as a prototype", () => {
    const json = JSON.parse(xmlToJson("<__proto__><__proto__>1</__proto__><x>2</x></__proto__>"));
    expect(Object.keys(json)).toEqual(["__proto__"]);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(Object.getPrototypeOf(JSON.parse(xmlToJson("<a><b>1</b></a>")))).toBe(Object.prototype);
  });
  it("throws only XmlError for broken input, never a raw TypeError", () => {
    const junk = ["<", "<<", "<a", "<a b", '<a b="', "</", "<!", "<!-", "<!--", "<![CDATA[", "<?", "&", "<a>&", "<a>&#", "<a>&;</a>", "\u0000", "<a/", "<a b='1' / >", "<\u{1F600}/>"];
    for (const text of junk) {
      try {
        parseXml(text);
      } catch (err) {
        expect(err, JSON.stringify(text)).toBeInstanceOf(XmlError);
      }
    }
  });
});

describe("formatXml", () => {
  it("indents nested tags and keeps text-only elements on one line", () => {
    expect(formatXml("<a><b>1</b><c><d>2</d></c></a>")).toBe("<a>\n  <b>1</b>\n  <c>\n    <d>2</d>\n  </c>\n</a>\n");
  });
  it("supports four spaces and tabs", () => {
    expect(formatXml("<a><b/></a>", 4)).toBe("<a>\n    <b/>\n</a>\n");
    expect(formatXml("<a><b/></a>", "tab")).toBe("<a>\n\t<b/>\n</a>\n");
  });
  it("is idempotent: formatting formatted text changes nothing", () => {
    for (const name of readdirSync(FIXTURES)) {
      const once = formatXml(fixture(name));
      expect(formatXml(once), name).toBe(once);
    }
  });
  it("keeps the declaration, comments, processing instructions and the DOCTYPE, each on its own line", () => {
    const out = formatXml(`<?xml version="1.0"?><!DOCTYPE a><!-- c --><a><?pi x?><!-- inner --></a>`);
    expect(out).toBe(`<?xml version="1.0"?>\n<!DOCTYPE a>\n<!-- c -->\n<a>\n  <?pi x?>\n  <!-- inner -->\n</a>\n`);
  });
  it("keeps the spelling of entities, quotes and empty elements", () => {
    const src = `<a x='1' y="&#169; &amp; &lt;"><b/><c></c></a>`;
    expect(formatXml(src)).toBe(`<a x='1' y="&#169; &amp; &lt;">\n  <b/>\n  <c></c>\n</a>\n`);
  });
  it("leaves mixed content exactly as written, so words are never glued or split", () => {
    const out = formatXml(fixture("mixed-content.xml"));
    expect(out).toContain(`<p>This is <b>bold</b> and <i>italic</i> text,\n     with a <a href="https://example.com/?a=1&amp;b=2">link</a>.</p>`);
    expect(out).toContain("<empty/>");
    expect(out).toContain("<pair></pair>");
    expect(out).toContain("<?target some data?>");
  });
  it("keeps CDATA exactly", () => {
    const out = formatXml(fixture("rss-with-cdata.xml"));
    expect(out).toContain("<![CDATA[How do Americans get ready to work with Russians aboard the <b>International Space Station</b>?");
    expect(out).toContain("culture, language & protocol.]]>");
  });
  it("keeps whitespace-only text inside text-only elements", () => {
    expect(formatXml("<a>  </a>")).toBe("<a>  </a>\n");
  });
  it("produces output that parses to the same tree", () => {
    for (const name of readdirSync(FIXTURES)) {
      const original = parseXml(fixture(name));
      const reparsed = parseXml(formatXml(fixture(name)));
      expect(JSON.stringify(shape(reparsed.root)), name).toBe(JSON.stringify(shape(original.root)));
    }
  });
});

/** The tree without whitespace-only text, which formatting is allowed to change. */
function shape(el: ReturnType<typeof parseXml>["root"]): unknown {
  return {
    name: el.name,
    attrs: el.attrs.map((a) => [a.name, a.value]),
    children: el.children
      .filter((c) => !(c.type === "text" && c.raw.trim() === "") && c.type !== "comment")
      .map((c) => (c.type === "element" ? shape(c) : c.type === "text" ? c.value : c.type === "cdata" ? { cdata: c.value } : c)),
  };
}

describe("minifyXml", () => {
  it("removes the space between tags and the comments", () => {
    expect(minifyXml(`<a>\n  <!-- x -->\n  <b>1</b>\n  <c/>\n</a>`)).toBe("<a><b>1</b><c/></a>");
  });
  it("can keep comments", () => {
    expect(minifyXml("<a>\n<!-- x -->\n<b/></a>", { keepComments: true })).toBe("<a><!-- x --><b/></a>");
  });
  it("never changes text, so mixed content keeps its spaces", () => {
    expect(minifyXml("<p>Hello <b>big</b> world</p>")).toBe("<p>Hello <b>big</b> world</p>");
  });
  it("shrinks a real file and the result still parses to the same tree", () => {
    for (const name of readdirSync(FIXTURES)) {
      const src = fixture(name);
      const small = minifyXml(src);
      expect(small.length, name).toBeLessThanOrEqual(src.length);
      expect(JSON.stringify(shape(parseXml(small).root)), name).toBe(JSON.stringify(shape(parseXml(src).root)));
    }
  });
});

describe("validateXml and describeValidation", () => {
  it("summarises a good file", () => {
    const v = validateXml(fixture("soap-w3c-note.xml"));
    expect(v).toMatchObject({ valid: true, root: "env:Envelope", encoding: "UTF-8" });
    expect(v.elements).toBe(8);
    expect(v.maxDepth).toBe(4);
    const text = describeValidation(v);
    expect(text).toContain("well-formed");
    expect(text).toContain("Root element: <env:Envelope>");
    expect(text).toContain("Declared encoding: UTF-8");
  });
  it("lists warnings", () => {
    const text = describeValidation(validateXml("<a><x:b/></a>"));
    expect(text).toContain("Worth a look");
    expect(text).toContain("x:");
  });
  it("throws the first problem otherwise", () => {
    expect(() => validateXml("<a><b></a>")).toThrow(/Line 1/);
  });
  it("reads every real-world fixture", () => {
    const names = readdirSync(FIXTURES);
    expect(names.length).toBeGreaterThanOrEqual(7);
    for (const name of names) expect(() => validateXml(fixture(name)), name).not.toThrow();
  });
});

describe("xmlToJson", () => {
  it("turns attributes, text and repeated tags into JSON", () => {
    const json = JSON.parse(xmlToJson(fixture("rss-with-cdata.xml")));
    expect(json.rss["@version"]).toBe("2.0");
    expect(json.rss.channel.title).toBe("Liftoff News");
    expect(json.rss.channel.item).toHaveLength(2);
    expect(json.rss.channel.item[0].description).toContain("<b>International Space Station</b>");
    expect(json.rss.channel.item[0].guid).toEqual({ "@isPermaLink": "false", "#text": "http://liftoff.msfc.nasa.gov/2003/06/03.html#item573" });
    expect(json.rss.channel.item[1].title).toBe("The Engine That Does More & Costs Less ©");
    expect(json.rss.channel.item[1].category).toEqual(["Rockets", "Engines"]);
  });
  it("writes empty elements as null and keeps numbers and booleans as text", () => {
    expect(JSON.parse(xmlToJson("<a><b/><c></c><n>007</n><t>true</t></a>"))).toEqual({ a: { b: null, c: null, n: "007", t: "true" } });
  });
  it("keeps namespace prefixes in names", () => {
    const json = JSON.parse(xmlToJson(fixture("soap-w3c-note.xml")));
    expect(json["env:Envelope"]["env:Body"]["m:alert"]["m:msg"]).toBe("Pick up Mary at school at 2pm");
    expect(json["env:Envelope"]["@xmlns:env"]).toBe("http://www.w3.org/2003/05/soap-envelope");
  });
  it("joins the text of mixed content under #text", () => {
    const json = JSON.parse(xmlToJson("<p>Hello <b>big</b> world</p>"));
    expect(json.p.b).toBe("big");
    expect(json.p["#text"]).toBe("Hello  world");
  });
  it("honours other prefixes and indent", () => {
    expect(xmlToJson('<a x="1"/>', { attributePrefix: "_", indent: 0 })).toBe('{"a":{"_x":"1"}}');
  });
  it("does not turn a single child into a list, but a repeated one is", () => {
    expect(JSON.parse(xmlToJson("<a><b>1</b></a>")).a.b).toBe("1");
    expect(JSON.parse(xmlToJson("<a><b>1</b><b>2</b><b>3</b></a>")).a.b).toEqual(["1", "2", "3"]);
  });
  it("reports XML errors with their position", () => {
    expect(() => xmlToJson("<a><b></a>")).toThrow(/Line 1, column/);
  });
});

describe("jsonToXml", () => {
  it("writes the XML back that xmlToJson made", () => {
    for (const name of ["atom-rfc4287.xml", "soap-w3c-note.xml", "rss-with-cdata.xml", "netbeans-project.xml", "intellij-code-style.xml"]) {
      const json = xmlToJson(fixture(name));
      const xml = jsonToXml(json);
      // Same data in, same data out: converting the new XML gives the same JSON.
      expect(JSON.parse(xmlToJson(xml)), name).toEqual(JSON.parse(json));
    }
  });
  it("uses the only top-level key as the root", () => {
    expect(jsonToXml('{"note":{"@id":"7","to":"Tove","body":"Hi & bye"}}')).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<note id="7">\n  <to>Tove</to>\n  <body>Hi &amp; bye</body>\n</note>\n');
  });
  it("wraps anything else in a root element with the name you choose", () => {
    expect(jsonToXml('{"a":1,"b":[2,3]}', { declaration: false })).toBe("<root>\n  <a>1</a>\n  <b>2</b>\n  <b>3</b>\n</root>\n");
    expect(jsonToXml('{"a":1,"b":2}', { declaration: false, rootName: "data" })).toContain("<data>");
    expect(jsonToXml("[1,2]", { declaration: false })).toBe("<root>\n  <item>1</item>\n  <item>2</item>\n</root>\n");
    expect(jsonToXml('"text"', { declaration: false })).toBe("<root>text</root>\n");
    expect(jsonToXml("null", { declaration: false })).toBe("<root/>\n");
  });
  it("escapes everything that needs it", () => {
    const xml = jsonToXml('{"a":{"@t":"say \\"hi\\" <&>","#text":"1 < 2 && 3 > 2"}}', { declaration: false });
    expect(xml).toBe('<a t="say &quot;hi&quot; &lt;&amp;>">1 &lt; 2 &amp;&amp; 3 &gt; 2</a>\n');
    expect(() => parseXml(xml)).not.toThrow();
  });
  it("writes null as an empty element and booleans and numbers as text", () => {
    expect(jsonToXml('{"a":{"x":null,"y":true,"z":1.5}}', { declaration: false })).toBe("<a>\n  <x/>\n  <y>true</y>\n  <z>1.5</z>\n</a>\n");
  });
  it("can write on one line", () => {
    expect(jsonToXml('{"a":{"b":1}}', { declaration: false, indent: 0 })).toBe("<a><b>1</b></a>");
  });
  it("explains keys that cannot be element names", () => {
    expect(() => jsonToXml('{"a":{"my key":1}}')).toThrow(/"my key" cannot be used as an element name/);
    expect(() => jsonToXml('{"a":{"1st":1}}')).toThrow(/cannot be used/);
    expect(() => jsonToXml('{"a":{"@bad name":1}}')).toThrow(/attribute name/);
    expect(() => jsonToXml('{"a":[[1]]}')).toThrow(/inside another list/);
  });
  it("refuses characters XML cannot hold", () => {
    expect(() => jsonToXml('{"a":"x\\u0001y"}')).toThrow(/U\+0001/);
  });
  it("reports invalid JSON and over-deep JSON", () => {
    expect(() => jsonToXml("{not json")).toThrow(/not valid JSON/);
    expect(() => jsonToXml("")).toThrow(/not valid JSON/);
    const deep = '{"a":'.repeat(XML_LIMITS.maxConvertDepth + 5) + "1" + "}".repeat(XML_LIMITS.maxConvertDepth + 5);
    expect(() => jsonToXml(deep)).toThrow(/too deep/);
  });
  it("round-trips unicode and emoji", () => {
    const xml = jsonToXml('{"a":{"b":"日本語 😀 é"}}', { declaration: false });
    expect(JSON.parse(xmlToJson(xml)).a.b).toBe("日本語 😀 é");
  });
});

describe("isXmlName", () => {
  it("accepts and rejects the right things", () => {
    for (const ok of ["a", "_a", "a1", "a-b", "a.b", "a:b", "日本", "é"]) expect(isXmlName(ok), ok).toBe(true);
    for (const bad of ["", "1a", "-a", ".a", "a b", "a<b", "a/b", "a=b", "@a", "#a"]) expect(isXmlName(bad), bad).toBe(false);
  });
});
