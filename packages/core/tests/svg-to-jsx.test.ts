import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parseStyle, reactAttrName, svgToJsx, type JsxOptions } from "../src/svg-to-jsx";

/** Syntax errors from the real TypeScript compiler, so the generated code is known to parse. */
function syntaxErrors(code: string, tsx: boolean): string[] {
  const out = ts.transpileModule(code, { reportDiagnostics: true, fileName: tsx ? "x.tsx" : "x.jsx", compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

const ICON = `<?xml version="1.0"?>
<!-- icon -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" inkscape:version="1.0">
  <title>Alert</title>
  <defs>
    <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#f00" style="stop-opacity:.5;-webkit-filter:none"/></linearGradient>
    <style><![CDATA[.a{fill:url(#g)} .b > .c{stroke:red}]]></style>
  </defs>
  <g clip-path="url(#c)" fill-rule="evenodd" data-name="layer 1" aria-hidden="true" inkscape:groupmode="layer">
    <path class="a" d="M12 2L2 22h20z" style="fill:#ff0000;stroke-width:3;--custom:1"/>
    <use xlink:href="#g"/>
    <text x="1" y="2" xml:space="preserve">a {b} &lt; c <tspan font-weight="bold">bold</tspan></text>
    <sodipodi:namedview id="n"/>
  </g>
</svg>`;

describe("attribute names and styles", () => {
  it("converts SVG attribute names to React names", () => {
    expect(reactAttrName("class")).toBe("className");
    expect(reactAttrName("stroke-width")).toBe("strokeWidth");
    expect(reactAttrName("xlink:href")).toBe("xlinkHref");
    expect(reactAttrName("xmlns:xlink")).toBe("xmlnsXlink");
    expect(reactAttrName("xml:space")).toBe("xmlSpace");
    expect(reactAttrName("clip-path")).toBe("clipPath");
    expect(reactAttrName("data-name")).toBe("data-name");
    expect(reactAttrName("aria-hidden")).toBe("aria-hidden");
    expect(reactAttrName("viewBox")).toBe("viewBox");
    expect(reactAttrName("inkscape:version")).toBeNull();
    expect(reactAttrName("xmlns")).toBe("xmlns");
  });

  it("parses a CSS style string into React style keys", () => {
    expect(parseStyle("fill:#f00; stroke-width: 3;--custom:1;-webkit-filter:none;-ms-transform:none")).toEqual([
      ["fill", "#f00"],
      ["strokeWidth", "3"],
      ["--custom", "1"],
      ["WebkitFilter", "none"],
      ["msTransform", "none"],
    ]);
    expect(parseStyle("background:url(data:image/png;base64,AAA);color:red")).toEqual([
      ["background", "url(data:image/png;base64,AAA)"],
      ["color", "red"],
    ]);
    expect(parseStyle("")).toEqual([]);
    expect(parseStyle("nonsense")).toEqual([]);
  });
});

describe("svgToJsx", () => {
  it("makes a component with converted attributes, a style object and spread props", () => {
    const { code, notes } = svgToJsx(ICON);
    expect(code).toContain("const SvgIcon = (props) => (");
    expect(code).toContain('<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" className="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" {...props}>');
    expect(code).toContain('<g clipPath="url(#c)" fillRule="evenodd" data-name="layer 1" aria-hidden="true">');
    expect(code).toContain('style={{ fill: "#ff0000", strokeWidth: "3", "--custom": "1" }}');
    expect(code).toContain('<use xlinkHref="#g" />');
    expect(code).toContain('<stop offset="0" stopColor="#f00" style={{ stopOpacity: ".5", WebkitFilter: "none" }} />');
    expect(code.trimEnd().endsWith("export default SvgIcon;")).toBe(true);
    expect(code).not.toMatch(/inkscape|sodipodi|<\?xml|<!--/);
    expect(notes.join(" ")).toMatch(/Removed editor attribute inkscape:version/);
    expect(notes.join(" ")).toMatch(/Removed editor element <sodipodi:namedview>/);
  });

  it("keeps style and text content as JavaScript strings and expressions", () => {
    const { code } = svgToJsx(ICON);
    expect(code).toContain('<style>{".a{fill:url(#g)} .b > .c{stroke:red}"}</style>');
    // Braces become expressions; &lt; is a valid JSX entity and stays as it was.
    expect(code).toContain('<text x="1" y="2" xmlSpace="preserve">a {"{"}b{"}"} &lt; c <tspan fontWeight="bold">bold</tspan></text>');
    expect(code).toContain("<title>Alert</title>");
  });

  it("generates code that the TypeScript compiler can read, as JSX and as TSX", () => {
    for (const [opts, tsx] of [
      [{}, false],
      [{ typescript: true }, true],
      [{ typescript: true, memo: true, exportStyle: "named" as const }, true],
      [{ memo: true, importReact: true }, false],
      [{ spreadProps: false, removeDimensions: true, currentColor: true }, false],
    ] as [JsxOptions, boolean][]) {
      const { code } = svgToJsx(ICON, opts);
      expect(syntaxErrors(code, tsx), JSON.stringify(opts)).toEqual([]);
    }
  });

  it("supports TypeScript, named exports, memo and a custom name", () => {
    const ts1 = svgToJsx("<svg/>", { typescript: true, componentName: "Logo" }).code;
    expect(ts1).toContain('import type { SVGProps } from "react";');
    expect(ts1).toContain("const Logo = (props: SVGProps<SVGSVGElement>) => (");
    const named = svgToJsx("<svg/>", { exportStyle: "named", componentName: "Logo" }).code;
    expect(named).toContain("export const Logo = (props) => (");
    expect(named).not.toContain("export default");
    const memo = svgToJsx("<svg/>", { memo: true }).code;
    expect(memo).toContain('import { memo } from "react";');
    expect(memo).toContain("export default memo(SvgIcon);");
    const both = svgToJsx("<svg/>", { memo: true, exportStyle: "named", componentName: "Logo" }).code;
    expect(both).toContain("export const MemoLogo = memo(Logo);");
    expect(svgToJsx("<svg/>", { importReact: true }).code.startsWith('import * as React from "react";')).toBe(true);
  });

  it("removes dimensions and uses currentColor on request", () => {
    const { code } = svgToJsx(ICON, { removeDimensions: true, currentColor: true });
    expect(code).not.toContain('width="24"');
    expect(code).toContain('stroke="currentColor"');
    expect(code).toContain('fill="none"'); // none stays none
    expect(code).toContain('stopColor="#f00"'); // only fill and stroke are replaced
    expect(code).toContain('style={{ fill: "currentColor"');
  });

  it("can leave props out", () => {
    const { code } = svgToJsx("<svg><g/></svg>", { spreadProps: false });
    expect(code).toContain("const SvgIcon = () => (");
    expect(code).not.toContain("{...props}");
  });

  it("writes an empty <svg/> as one self-closing line with the props", () => {
    expect(svgToJsx("<svg/>").code).toContain("<svg {...props} />");
  });

  it("writes attribute values with quotes as JavaScript strings", () => {
    expect(svgToJsx('<svg><path data-x="say &quot;hi&quot;" d=\'a"b\'/></svg>').code).toContain('d={"a\\"b"}');
  });

  it("rejects bad component names and invalid SVG", () => {
    expect(() => svgToJsx("<svg/>", { componentName: "icon" })).toThrow(/start with a capital letter/);
    expect(() => svgToJsx("<svg/>", { componentName: "My Icon" })).toThrow(/capital letter/);
    expect(() => svgToJsx("<svg><g></svg>")).toThrow(/closed by/);
  });

  it("copes with a large SVG", () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${'<path stroke-width="1" d="M0 0L1 1"/>'.repeat(10_000)}</svg>`;
    const t0 = Date.now();
    const { code } = svgToJsx(big);
    expect(code.split("\n").length).toBeGreaterThan(10_000);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
