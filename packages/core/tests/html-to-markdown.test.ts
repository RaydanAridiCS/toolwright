// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "../src/html-to-markdown";

const md = (html: string, options = {}) => htmlToMarkdown(html, options);

describe("text structure", () => {
  it("converts headings", () => {
    expect(md("<h1>Title</h1><h3>Sub <em>part</em></h3>")).toBe("# Title\n\n### Sub *part*");
  });

  it("separates paragraphs and collapses whitespace", () => {
    expect(md("<p>One   two\n  three</p>\n\n<p>Four</p>")).toBe("One two three\n\nFour");
  });

  it("keeps hard line breaks", () => {
    expect(md("<p>line one<br>line two</p>")).toBe("line one  \nline two");
  });

  it("handles bare text and fragments", () => {
    expect(md("just text")).toBe("just text");
    expect(md("<b>bold</b> and plain")).toBe("**bold** and plain");
  });

  it("returns an empty string for empty input", () => {
    expect(md("")).toBe("");
    expect(md("   \n ")).toBe("");
    expect(md("<div></div><p> </p>")).toBe("");
  });

  it("treats divs and sections as containers", () => {
    expect(md("<div><section><p>A</p></section><div>B</div></div>")).toBe("A\n\nB");
  });

  it("converts rules", () => {
    expect(md("<p>a</p><hr><p>b</p>")).toBe("a\n\n---\n\nb");
  });
});

describe("inline formatting", () => {
  it("converts strong, emphasis and strikethrough", () => {
    expect(md("<p><strong>a</strong> <b>b</b> <em>c</em> <i>d</i> <del>e</del> <s>f</s></p>")).toBe("**a** **b** *c* *d* ~~e~~ ~~f~~");
  });

  it("moves spaces outside the markers", () => {
    expect(md("<p>x<strong> bold </strong>y</p>")).toBe("x **bold** y");
  });

  it("drops markers around nothing", () => {
    expect(md("<p>a<strong> </strong>b</p>")).toBe("a b");
  });

  it("converts inline code and widens the fence when needed", () => {
    expect(md("<p>run <code>npm test</code></p>")).toBe("run `npm test`");
    expect(md("<p><code>a`b</code></p>")).toBe("``a`b``");
    expect(md("<p><code>`x`</code></p>")).toBe("`` `x` ``");
  });

  it("converts links with titles", () => {
    expect(md('<p><a href="https://example.com/a" title="Home">Site</a></p>')).toBe('[Site](https://example.com/a "Home")');
  });

  it("keeps link text only when links are off or the href is unsafe", () => {
    expect(md('<a href="https://example.com">Site</a>', { links: false })).toBe("Site");
    expect(md('<a href="javascript:alert(1)">Click</a>')).toBe("Click");
    expect(md('<a href="  JavaScript:alert(1)">Click</a>')).toBe("Click");
    expect(md("<a>No href</a>")).toBe("No href");
  });

  it("escapes characters in urls that would end the link", () => {
    expect(md('<a href="https://x.test/a (b)">t</a>')).toBe("[t](https://x.test/a%20%28b%29)");
  });

  it("converts images and can drop them", () => {
    expect(md('<img src="/logo.png" alt="Logo [1]" title="Our logo">')).toBe('![Logo 1](/logo.png "Our logo")');
    expect(md('<img src="/logo.png" alt="x">', { images: false })).toBe("");
    expect(md('<img alt="no source">')).toBe("");
  });

  it("escapes Markdown characters in plain text", () => {
    expect(md("<p>2 * 3 = 6 and [not a link] and `tick` and a\\b</p>")).toBe("2 \\* 3 = 6 and \\[not a link\\] and \\`tick\\` and a\\\\b");
  });

  it("escapes underscores only at word edges", () => {
    expect(md("<p>snake_case and _lead and trail_</p>")).toBe("snake_case and \\_lead and trail\\_");
  });

  it("escapes text that would start a block", () => {
    expect(md("<p># not a heading</p>")).toBe("\\# not a heading");
    expect(md("<p>- not a list</p>")).toBe("\\- not a list");
    expect(md("<p>1. not a list</p>")).toBe("1\\. not a list");
    expect(md("<p>&gt; not a quote</p>")).toBe("\\> not a quote");
  });

  it("escapes things that look like tags", () => {
    expect(md("<p>a &lt;div&gt; b and 1 &lt; 2</p>")).toBe("a \\<div> b and 1 < 2");
  });

  it("decodes entities and non-breaking spaces", () => {
    expect(md("<p>Fish &amp; chips&nbsp;&copy;</p>")).toBe("Fish & chips ©");
  });

  it("keeps unicode and emoji", () => {
    expect(md("<p>こんにちは 🙂 café</p>")).toBe("こんにちは 🙂 café");
  });
});

describe("blocks", () => {
  it("converts code blocks with a language", () => {
    expect(md('<pre><code class="language-ts">const a = 1;\nlet b = 2;\n</code></pre>')).toBe("```ts\nconst a = 1;\nlet b = 2;\n```");
  });

  it("keeps whitespace inside code blocks", () => {
    expect(md("<pre>  indented\n\n    more</pre>")).toBe("```\n  indented\n\n    more\n```");
  });

  it("uses a longer fence when the code contains one", () => {
    expect(md("<pre><code>```\nx\n```</code></pre>")).toBe("````\n```\nx\n```\n````");
  });

  it("converts blockquotes, including nested content", () => {
    expect(md("<blockquote><p>Quote</p><p>Two <strong>parts</strong></p></blockquote>")).toBe("> Quote\n>\n> Two **parts**");
  });

  it("converts bullet and numbered lists", () => {
    expect(md("<ul><li>One</li><li>Two</li></ul>")).toBe("- One\n- Two");
    expect(md("<ol><li>One</li><li>Two</li></ol>")).toBe("1. One\n2. Two");
    expect(md('<ol start="5"><li>Five</li><li>Six</li></ol>')).toBe("5. Five\n6. Six");
  });

  it("uses the chosen bullet", () => {
    expect(md("<ul><li>One</li></ul>", { bullet: "*" })).toBe("* One");
  });

  it("indents nested lists", () => {
    expect(md("<ul><li>A<ul><li>A1</li><li>A2<ol><li>deep</li></ol></li></ul></li><li>B</li></ul>")).toBe("- A\n  - A1\n  - A2\n    1. deep\n- B");
  });

  it("keeps multi-paragraph items together", () => {
    expect(md("<ul><li><p>First</p><p>More</p></li><li><p>Second</p></li></ul>")).toBe("- First\n\n  More\n\n- Second");
  });

  it("converts task lists", () => {
    expect(md('<ul><li><input type="checkbox" checked> Done</li><li><input type="checkbox"> Todo</li></ul>')).toBe("- [x] Done\n- [ ] Todo");
  });

  it("converts tables with header, alignment and escaped pipes", () => {
    const html = '<table><thead><tr><th>Name</th><th align="right">Qty</th><th style="text-align:center">Note</th></tr></thead><tbody><tr><td>Bolt</td><td>10</td><td>a|b</td></tr></tbody></table>';
    expect(md(html)).toBe("| Name | Qty | Note |\n| --- | ---: | :---: |\n| Bolt | 10 | a\\|b |");
  });

  it("uses the first row as the header when there is no thead", () => {
    expect(md("<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>")).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |");
  });

  it("pads short rows and spreads colspans", () => {
    expect(md('<table><tr><th>A</th><th>B</th><th>C</th></tr><tr><td>1</td></tr><tr><td colspan="2">x</td><td>y</td></tr></table>')).toBe(
      "| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |\n| x |  | y |",
    );
  });

  it("flattens line breaks inside cells and ignores nested tables' rows", () => {
    expect(md("<table><tr><th>H</th></tr><tr><td>a<br>b</td></tr></table>")).toBe("| H |\n| --- |\n| a b |");
    expect(md("<table><tr><td>outer<table><tr><td>inner</td></tr></table></td></tr></table>")).toBe("| outer inner |\n| --- |");
  });

  it("makes definition terms bold", () => {
    expect(md("<dl><dt>Term</dt><dd>Meaning</dd></dl>")).toBe("**Term**\n\nMeaning");
  });
});

describe("safety and limits", () => {
  it("drops scripts, styles and other non-content", () => {
    expect(md('<p>Hi</p><script>alert("x")</script><style>p{color:red}</style><noscript>n</noscript><iframe src="x"></iframe><svg><text>t</text></svg>')).toBe("Hi");
  });

  it("drops comments and event handler attributes", () => {
    expect(md('<!-- note --><p onclick="evil()">Hi</p>')).toBe("Hi");
  });

  it("converts a realistic page fragment", () => {
    const html = `<article><h1>Release notes</h1><p>Version <strong>2.0</strong> is out. See the <a href="/changelog">changelog</a>.</p><ul><li>Faster</li><li>Smaller</li></ul></article>`;
    expect(md(html)).toBe("# Release notes\n\nVersion **2.0** is out. See the [changelog](/changelog).\n\n- Faster\n- Smaller");
  });

  it("rejects absurdly large input", () => {
    expect(() => md("a".repeat(5_000_001))).toThrow(/too much HTML/);
  });

  it("does not overflow the stack on deep nesting", () => {
    const html = `${"<div>".repeat(5000)}deep${"</div>".repeat(5000)}`;
    // Real browsers cap nesting while parsing; either way the result is the text or a readable message.
    try {
      expect(md(html)).toBe("deep");
    } catch (err) {
      expect(err).not.toBeInstanceOf(RangeError);
      expect((err as Error).message).toMatch(/nested too deeply/);
    }
  });
});
