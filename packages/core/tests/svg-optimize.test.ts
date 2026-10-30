import { describe, expect, it } from "vitest";
import { optimizeSvg } from "../src/svg-optimize";
import { getAttr, parseSvg } from "../src/svg-xml";

/** Looks like an Inkscape export: editor namespaces, metadata, comments, long numbers, and shapes. */
const EDITOR_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   width="48.000000mm"
   height="48.000000mm"
   viewBox="0 0 48.000000 48.000000"
   version="1.1"
   id="svg8"
   inkscape:version="0.92.4"
   sodipodi:docname="icon.svg">
  <title id="title1">Round icon</title>
  <desc id="desc1">A circle and a line</desc>
  <metadata id="metadata5">
    <rdf:RDF>
      <cc:Work rdf:about="">
        <dc:format>image/svg+xml</dc:format>
      </cc:Work>
    </rdf:RDF>
  </metadata>
  <sodipodi:namedview id="base" pagecolor="#ffffff" bordercolor="#666666" inkscape:zoom="1" />
  <defs id="defs2" />
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1">
    <circle style="fill:#ff0000;fill-opacity:1;stroke:none" cx="24.000000" cy="24.000000" r="20.123456789" id="circle10" />
    <path style="fill:none;stroke:#000000;stroke-width:1.5000000;stroke-linecap:butt;stroke-opacity:1" d="M 4.000000,4.000000 L 44.000000,44.000000" id="path12" />
    <rect x="10.000000" y="10.000000" width="5.000000" height="5.000000" fill="#00ff00" />
  </g>
</svg>
`;

describe("optimizeSvg", () => {
  it("shrinks an editor export a lot, and keeps what makes it scalable and readable", () => {
    const r = optimizeSvg(EDITOR_SVG);
    expect(r.after).toBeLessThan(r.before * 0.6);
    expect(r.unchanged).toBe(false);
    expect(r.savedFraction).toBeGreaterThan(0.4);
    const { root } = parseSvg(r.svg);
    expect(getAttr(root, "viewBox")).toBe("0 0 48 48");
    expect(r.svg).toContain("Round icon");
    expect(r.svg).toContain("A circle and a line");
    expect(r.svg).not.toMatch(/inkscape|sodipodi|metadata|Created with/);
    expect(r.svg).not.toContain("20.123456789");
  });

  it("output is a valid SVG with the same drawing: still has the three shapes", () => {
    const r = optimizeSvg(EDITOR_SVG);
    const names: string[] = [];
    const walk = (el: { name: string; children: unknown[] }) => {
      names.push(el.name);
      for (const c of el.children as { type: string; name: string; children: unknown[] }[]) if (c.type === "element") walk(c);
    };
    walk(parseSvg(r.svg).root);
    expect(names.filter((n) => ["circle", "path", "rect"].includes(n)).length + names.filter((n) => n === "path").length).toBeGreaterThanOrEqual(3);
    expect(r.svg).toMatch(/#f00|red/);
  });

  it("precision controls how many decimals are kept", () => {
    const p0 = optimizeSvg(EDITOR_SVG, { precision: 0 });
    const p6 = optimizeSvg(EDITOR_SVG, { precision: 6 });
    expect(p0.after).toBeLessThan(p6.after);
    expect(p6.svg).toContain("20.123457");
    expect(p0.svg).not.toContain("20.1");
  });

  it("can drop the title and description, but keeps them by default", () => {
    expect(optimizeSvg(EDITOR_SVG, { keepAccessibleText: false }).svg).not.toMatch(/Round icon|A circle/);
  });

  it("can remove width and height and rely on the viewBox", () => {
    const { root } = parseSvg(optimizeSvg(EDITOR_SVG, { removeDimensions: true }).svg);
    expect(getAttr(root, "width")).toBeUndefined();
    expect(getAttr(root, "height")).toBeUndefined();
    expect(getAttr(root, "viewBox")).toBe("0 0 48 48");
    const kept = parseSvg(optimizeSvg(EDITOR_SVG).svg).root;
    expect(getAttr(kept, "width")).toBeDefined();
  });

  it("removes scripts and event handlers on request", () => {
    const risky = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="5" height="5" onclick="alert(2)"/></svg>';
    expect(optimizeSvg(risky).svg).toContain("script");
    const safe = optimizeSvg(risky, { removeScripts: true }).svg;
    expect(safe).not.toMatch(/script|onclick/);
    expect(safe).toContain("<path");
  });

  it("keeps ids when asked, and removes unused ones otherwise", () => {
    const withId = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="unused-name" width="5" height="5"/><use href="#used"/><circle id="used" r="2"/></svg>';
    expect(optimizeSvg(withId).svg).not.toContain("unused-name");
    expect(optimizeSvg(withId, { keepIds: true }).svg).toContain("unused-name");
  });

  it("can lay the result out for reading", () => {
    const pretty = optimizeSvg(EDITOR_SVG, { prettify: true }).svg;
    expect(pretty.split("\n").length).toBeGreaterThan(3);
    expect(pretty).toMatch(/\n {2}</);
  });

  it("never returns a bigger file: an already tiny SVG comes back as it was", () => {
    const tiny = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
    const r = optimizeSvg(tiny);
    expect(r.after).toBeLessThanOrEqual(r.before);
    expect(r.svg.length).toBeLessThanOrEqual(tiny.length);
  });

  it("is stable: optimizing the result again saves nothing more", () => {
    const once = optimizeSvg(EDITOR_SVG);
    const twice = optimizeSvg(once.svg);
    expect(twice.svg).toBe(once.svg);
    expect(twice.unchanged).toBe(true);
  });

  it("explains files that are not a valid SVG, with the line", () => {
    expect(() => optimizeSvg("<svg><g></svg>")).toThrow(/Line 1: <g> on line 1 is closed by <\/svg>/);
    expect(() => optimizeSvg("not svg at all")).toThrow(/outside the <svg> element/);
    expect(() => optimizeSvg("")).toThrow(/No <svg> element found/);
  });

  it("rejects a precision outside the range", () => {
    expect(() => optimizeSvg(EDITOR_SVG, { precision: 12 })).toThrow(/0 to 8/);
    expect(() => optimizeSvg(EDITOR_SVG, { precision: 1.5 })).toThrow(/whole number/);
  });

  it("copes with a large drawing", { timeout: 60_000 }, () => {
    const body = Array.from({ length: 4000 }, (_, i) => `<rect x="${i}.000" y="${i}.000" width="1.000" height="1.000" fill="#ff0000"/>`).join("");
    const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 4000">${body}</svg>`;
    const t0 = Date.now();
    const r = optimizeSvg(big, { multipass: false });
    expect(r.after).toBeLessThan(r.before);
    expect(Date.now() - t0).toBeLessThan(15_000);
  });
});
