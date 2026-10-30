import { describe, expect, it } from "vitest";
import { cloneNodes, escapeAttr, escapeText, getAttr, parseSvg, removeAttr, serializeSvg, setAttr, SvgSyntaxError, walkElements, type SvgElement } from "../src/svg-xml";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- made by hand -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" width="24" height="24">
  <title>Check &amp; go</title>
  <defs><style><![CDATA[.a { fill: #333; }]]></style></defs>
  <g class="a" transform="translate(1 2)">
    <path d="M1 1h22v22H1z" fill="none" stroke='#000'/>
    <text x="1" y="2">Hello <tspan font-weight="bold">world</tspan></text>
  </g>
</svg>
`;

describe("parseSvg", () => {
  it("reads elements, attributes, text, comments, CDATA, the doctype and the declaration", () => {
    const { nodes, root } = parseSvg(SAMPLE);
    expect(nodes.map((n) => n.type).filter((t) => t !== "text")).toEqual(["pi", "doctype", "comment", "element"]);
    expect(root.name).toBe("svg");
    expect(getAttr(root, "viewBox")).toBe("0 0 24 24");
    expect(getAttr(root, "xmlns:xlink")).toBe("http://www.w3.org/1999/xlink");
    const names: string[] = [];
    walkElements(nodes, (el) => names.push(el.name));
    expect(names).toEqual(["svg", "title", "defs", "style", "g", "path", "text", "tspan"]);
  });

  it("keeps values exactly as written, including entities and single quotes", () => {
    const { root } = parseSvg(SAMPLE);
    const title = root.children.find((c) => c.type === "element" && c.name === "title") as SvgElement;
    expect(title.children[0]).toEqual({ type: "text", value: "Check &amp; go" });
    const g = root.children.find((c) => c.type === "element" && c.name === "g") as SvgElement;
    const path = g.children.find((c) => c.type === "element" && c.name === "path") as SvgElement;
    expect(getAttr(path, "stroke")).toBe("#000");
    expect(path.selfClosing).toBe(true);
  });

  it("round-trips without changing a byte when no layout is requested", () => {
    expect(serializeSvg(parseSvg(SAMPLE).nodes).trimEnd()).toBe(SAMPLE.trimEnd().replace("stroke='#000'", 'stroke="#000"'));
  });

  it("copes with > inside attribute values, newlines in tags, unquoted values and a byte order mark", () => {
    const { root } = parseSvg('﻿<svg\n  data-x="a > b"\n  id=main>\n<g/></svg>');
    expect(getAttr(root, "data-x")).toBe("a > b");
    expect(getAttr(root, "id")).toBe("main");
  });

  it("reports mistakes with line numbers", () => {
    expect(() => parseSvg("<svg>\n<g>\n</svg>")).toThrow(/<g> on line 2 is closed by <\/svg>/);
    expect(() => parseSvg("<svg>\n<g>")).toThrow(/<g> on line 2 is never closed/);
    expect(() => parseSvg("</svg>")).toThrow(/no matching opening tag/);
    expect(() => parseSvg("<svg><!-- oops </svg>")).toThrow(/comment is never closed/);
    expect(() => parseSvg('<svg width="10></svg>')).toThrow(/no closing quote/);
    expect(() => parseSvg("<svg>")).toThrow(/never closed/);
    expect(() => parseSvg("hello")).toThrow(/outside the <svg> element/);
    expect(() => parseSvg("")).toThrow(/No <svg> element found/);
    expect(() => parseSvg("<html><body/></html>")).toThrow(/not <svg>/);
    expect(() => parseSvg("<svg/><svg/>")).toThrow(/more than one top-level element/);
    expect(() => parseSvg("<svg>< g/></svg>")).toThrow(/not followed by a tag name/);
    try {
      parseSvg("<svg>\n\n</g>");
    } catch (err) {
      expect(err).toBeInstanceOf(SvgSyntaxError);
      expect((err as SvgSyntaxError).line).toBe(3);
    }
  });

  it("survives very deep nesting without a stack overflow", () => {
    const depth = 50_000;
    const { root } = parseSvg(`<svg>${"<g>".repeat(depth)}${"</g>".repeat(depth)}</svg>`);
    let count = 0;
    walkElements([root], () => count++);
    expect(count).toBe(depth + 1);
  });

  it("is quick on a large file", () => {
    const big = `<svg>${'<path d="M0 0L1 1" fill="red"/>\n'.repeat(60_000)}</svg>`;
    const t0 = Date.now();
    parseSvg(big);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe("serializeSvg with indentation", () => {
  it("rebuilds the layout and keeps text inside <text> and <style> alone", () => {
    const out = serializeSvg(parseSvg('<svg viewBox="0 0 1 1"><g><path d="M0 0"/><text x="1">Hi <tspan>there</tspan></text></g><style>.a{fill:red}</style></svg>').nodes, { indent: "  " });
    expect(out).toBe(
      ['<svg viewBox="0 0 1 1">', "  <g>", '    <path d="M0 0"/>', '    <text x="1">Hi <tspan>there</tspan></text>', "  </g>", "  <style>.a{fill:red}</style>", "</svg>"].join("\n"),
    );
  });

  it("drops blank lines between elements and uses the indent it is given", () => {
    const out = serializeSvg(parseSvg("<svg>\n\n\n  <g>\n\n    <path/>\n\n  </g>\n</svg>").nodes, { indent: "\t" });
    expect(out).toBe("<svg>\n\t<g>\n\t\t<path/>\n\t</g>\n</svg>");
  });

  it("formatting twice gives the same result", () => {
    const once = serializeSvg(parseSvg(SAMPLE).nodes, { indent: "  " });
    expect(serializeSvg(parseSvg(once).nodes, { indent: "  " })).toBe(once);
  });

  it("does not lose any element or attribute", () => {
    const names = (src: string) => {
      const out: string[] = [];
      walkElements(parseSvg(src).nodes, (el) => out.push(`${el.name}:${el.attrs.map((a) => `${a.name}=${a.value}`).join(",")}`));
      return out;
    };
    expect(names(serializeSvg(parseSvg(SAMPLE).nodes, { indent: "  " }))).toEqual(names(SAMPLE));
  });

  it("reports nesting that is too deep to rewrite", () => {
    const depth = 20_000;
    expect(() => serializeSvg(parseSvg(`<svg>${"<g>".repeat(depth)}${"</g>".repeat(depth)}</svg>`).nodes, { indent: " " })).toThrow(/nested too deeply/);
  });
});

describe("helpers", () => {
  it("gets, sets and removes attributes", () => {
    const { root } = parseSvg('<svg width="1"/>');
    setAttr(root, "width", "2");
    setAttr(root, "height", "3");
    expect(serializeSvg([root])).toBe('<svg width="2" height="3"/>');
    expect(removeAttr(root, "width")).toBe(true);
    expect(removeAttr(root, "nope")).toBe(false);
    expect(getAttr(root, "width")).toBeUndefined();
  });

  it("clones deeply, so edits do not leak", () => {
    const { nodes, root } = parseSvg('<svg><g a="1"/></svg>');
    const copy = cloneNodes(nodes);
    walkElements(copy, (el) => el.name === "g" && setAttr(el, "a", "2"));
    expect(serializeSvg(nodes)).toBe('<svg><g a="1"/></svg>');
    expect(serializeSvg(copy)).toBe('<svg><g a="2"/></svg>');
    void root;
  });

  it("escapes text and attribute values", () => {
    expect(escapeText("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
    expect(escapeAttr('say "hi" & <go>')).toBe("say &quot;hi&quot; &amp; &lt;go>");
  });
});
