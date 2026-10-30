// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { describeRemoved, reportLines } from "@toolwright/core/svg-report";
import { parseSvg, walkElements } from "@toolwright/core/svg-xml";
import { sanitizeSvg } from "../src/shared/svg-sanitize";

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const wrap = (inner: string, attrs = "") => `<svg ${NS} viewBox="0 0 10 10" ${attrs}>${inner}</svg>`;
const names = (svg: string) => {
  const out: string[] = [];
  walkElements(parseSvg(svg).nodes, (el) => out.push(el.name));
  return out;
};
const attrs = (svg: string) => {
  const out: string[] = [];
  walkElements(parseSvg(svg).nodes, (el) => el.attrs.forEach((a) => out.push(`${el.name}.${a.name}`)));
  return out;
};

describe("sanitizeSvg: what is removed", () => {
  it("removes <script> elements, even inside CDATA", () => {
    expect(names(sanitizeSvg(wrap('<script>alert(1)</script><rect width="5" height="5"/>')))).not.toContain("script");
    expect(names(sanitizeSvg(wrap("<script><![CDATA[alert(1)]]></script><circle r=\"2\"/>")))).not.toContain("script");
  });

  it("removes event handler attributes, in any letter case, on any element", () => {
    const out = sanitizeSvg(wrap('<rect width="5" height="5" onclick="x()" OnMouseOver="y()" onfocus="z()"/>', 'onload="w()" onerror="v()"'));
    expect(attrs(out).filter((a) => /\.on/i.test(a))).toEqual([]);
    expect(out).not.toMatch(/alert|x\(\)|y\(\)|w\(\)/);
  });

  it("removes <foreignObject> and the HTML inside it", () => {
    const out = sanitizeSvg(wrap('<foreignObject width="5" height="5"><div xmlns="http://www.w3.org/1999/xhtml" onclick="a()">hi<script>b()</script></div></foreignObject><rect width="1" height="1"/>'));
    expect(out).not.toMatch(/foreignObject|script|div/i);
    expect(names(out)).toContain("rect");
  });

  it("removes javascript: links, however they are written", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "&#x6A;avascript:alert(1)", "java&#x0A;script:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x"]) {
      const out = sanitizeSvg(wrap(`<a href="${href}"><rect width="1" height="1"/></a><a xlink:href="${href}" xmlns:xlink="http://www.w3.org/1999/xlink"><circle r="1"/></a>`));
      expect(out, href).not.toMatch(/javascript|vbscript|text\/html/i);
    }
  });

  it("removes links to other sites and files, but keeps local #references and embedded pictures", () => {
    const out = sanitizeSvg(
      wrap(
        '<defs><path id="p" d="M0 0h5"/></defs><use href="#p"/><use href="https://example.com/sprite.svg#a"/><use href="other.svg#a"/><image href="https://example.com/a.png" width="2" height="2"/><image href="data:image/png;base64,iVBORw0KGgo=" width="2" height="2"/>',
      ),
    );
    expect(out).toContain('href="#p"');
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("other.svg");
    expect(out).toContain("data:image/png;base64,iVBORw0KGgo=");
  });

  it("cleans CSS: no @import, no external url(), no expression()", () => {
    const out = sanitizeSvg(
      wrap(
        '<style>@import url("https://evil.example/x.css"); .a{fill:red;background:url(https://evil.example/b.png);width:expression(alert(1))} .b{fill:url(#g)}</style><rect class="a" style="fill:url(//evil.example/c.png);stroke:blue" width="1" height="1"/>',
      ),
    );
    expect(out).not.toMatch(/evil\.example|@import|expression/i);
    expect(out).toContain("fill:red");
    expect(out).toContain("fill:url(#g)");
    expect(out).toContain("stroke:blue");
  });

  it("removes animation that could turn a link into script", () => {
    const out = sanitizeSvg(wrap('<a href="#x"><rect width="1" height="1"/><animate attributeName="href" values="javascript:alert(1)"/><set attributeName="onclick" to="alert(1)"/></a>'));
    expect(out).not.toMatch(/javascript|<animate|<set/i);
  });

  it("can drop <style> blocks entirely", () => {
    expect(names(sanitizeSvg(wrap("<style>.a{fill:red}</style><rect/>"), { keepStyles: false }))).not.toContain("style");
  });
});

describe("sanitizeSvg: what is kept", () => {
  const ICON = wrap(
    '<title>Icon</title><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient><clipPath id="c"><rect width="8" height="8"/></clipPath></defs><g clip-path="url(#c)" transform="rotate(5)"><path d="M0 0L10 10" stroke="#333" stroke-width="2" fill="url(#g)"/><circle cx="5" cy="5" r="2" opacity=".5"/><text x="1" y="2" font-size="3">Hi</text></g>',
  );

  it("keeps ordinary drawing content, gradients, clip paths, text and titles", () => {
    const out = sanitizeSvg(ICON);
    for (const tag of ["title", "defs", "linearGradient", "stop", "clipPath", "g", "path", "circle", "text"]) expect(names(out), tag).toContain(tag);
    for (const a of ["path.stroke-width", "g.clip-path", "g.transform", "circle.opacity", "stop.stop-color", "svg.viewBox"]) expect(attrs(out), a).toContain(a);
  });

  it("keeps the viewBox and always has the namespace", () => {
    const out = sanitizeSvg('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>');
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("is stable: cleaning a clean file changes nothing that matters", () => {
    const once = sanitizeSvg(ICON);
    const twice = sanitizeSvg(once);
    expect(names(twice)).toEqual(names(once));
    expect(attrs(twice)).toEqual(attrs(once));
    expect(describeRemoved(once, twice).total).toBe(0);
  });
});

describe("sanitizeSvg: bad input", () => {
  it("explains text that is not an SVG, with the line", () => {
    expect(() => sanitizeSvg("<svg><g></svg>")).toThrow(/Line 1: <g> on line 1 is closed by/);
    expect(() => sanitizeSvg("hello")).toThrow(/outside the <svg> element/);
  });
});

describe("describeRemoved and reportLines", () => {
  it("lists what a cleaning took out, elements first", () => {
    const before = wrap('<script>a()</script><script>b()</script><rect width="1" height="1" onclick="x()"/><image href="https://e.example/a.png"/>', 'onload="y()"');
    const after = sanitizeSvg(before);
    const report = describeRemoved(before, after);
    expect(report.removed[0]).toEqual({ kind: "element", name: "script", count: 2 });
    expect(report.removed.some((r) => r.kind === "attribute" && r.name === "onclick")).toBe(true);
    expect(report.removed.some((r) => r.kind === "attribute" && r.name === "onload")).toBe(true);
    expect(report.removed.some((r) => r.kind === "attribute" && r.name === "href")).toBe(true);
    expect(report.total).toBeGreaterThanOrEqual(5);
    expect(reportLines(report)[0]).toBe("Removed 2 <script> elements.");
    expect(reportLines({ removed: [{ kind: "attribute", name: "onclick", count: 1 }], total: 1 })).toEqual(["Removed 1 onclick attribute."]);
  });

  it("reports nothing for identical files", () => {
    expect(describeRemoved(wrap("<rect/>"), wrap("<rect/>"))).toEqual({ removed: [], total: 0 });
  });
});
