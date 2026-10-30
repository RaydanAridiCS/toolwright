import { describe, expect, it } from "vitest";
import { decodeSvgDataUri, prepareForDataUri, snippetFor, svgToDataUri } from "../src/svg-data-uri";
import { parseSvg, walkElements } from "../src/svg-xml";

const ICON = `<?xml version="1.0"?>
<!-- an icon -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#ff0000" d="M12 2L2 22h20z"/>
  <text x="1" y="2">é “quotes” & more</text>
</svg>`;

const names = (src: string) => {
  const out: string[] = [];
  walkElements(parseSvg(src).nodes, (el) => out.push(`${el.name}:${el.attrs.map((a) => `${a.name}=${a.value}`).join("|")}`));
  return out;
};

describe("prepareForDataUri", () => {
  it("drops the declaration and comments, tidies whitespace and uses single quotes", () => {
    const out = prepareForDataUri(ICON);
    expect(out).not.toMatch(/<\?xml|<!--/);
    expect(out).not.toMatch(/\n|\t/);
    expect(out).toContain("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>");
    expect(out).not.toContain('"');
  });

  it("adds the namespace when it is missing", () => {
    expect(prepareForDataUri('<svg viewBox="0 0 1 1"/>')).toBe("<svg viewBox='0 0 1 1' xmlns='http://www.w3.org/2000/svg'/>");
  });

  it("keeps attribute values that contain quotes", () => {
    const out = prepareForDataUri(`<svg xmlns="http://www.w3.org/2000/svg" data-x="it's &quot;ok&quot;"/>`);
    expect(out).toContain("data-x='it&apos;s &quot;ok&quot;'");
    expect(parseSvg(out).root.attrs.find((a) => a.name === "data-x")?.value).toBe("it&apos;s &quot;ok&quot;");
  });
});

describe("svgToDataUri", () => {
  it("matches the well-known compact form for a tiny SVG", () => {
    expect(svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>")).toBe("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect/%3E%3C/svg%3E");
  });

  it("escapes #, %, brackets and parentheses so it is safe in url() and attributes", () => {
    const uri = svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" style="fill:#f00;width:50%" data-c="(a)[b]{c}?^"/>');
    const body = uri.slice("data:image/svg+xml,".length);
    expect(body).not.toMatch(/[#()<>?[\]{}^|\\]|"/);
    expect(body).toContain("%23f00");
    expect(body).toContain("50%25");
  });

  it("round-trips: decoding gives the same elements and attributes", () => {
    for (const encoding of ["url", "base64"] as const) {
      const decoded = decodeSvgDataUri(svgToDataUri(ICON, { encoding }));
      expect(names(decoded)).toEqual(names(prepareForDataUri(ICON)));
      expect(decoded).toContain("é “quotes” & more");
    }
  });

  it("percent-encodes non-ASCII text, so the URI is pure ASCII", () => {
    expect(svgToDataUri(ICON)).toMatch(/^[\x20-\x7e]+$/);
  });

  it("the URL form is shorter than Base64 for typical SVGs", () => {
    expect(svgToDataUri(ICON).length).toBeLessThan(svgToDataUri(ICON, { encoding: "base64" }).length);
  });

  it("base64 starts with the right header and decodes", () => {
    const uri = svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg'/>", { encoding: "base64" });
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(decodeSvgDataUri(uri)).toBe("<svg xmlns='http://www.w3.org/2000/svg'/>");
  });

  it("explains input that is not an SVG, and a URI that is not an SVG data URI", () => {
    expect(() => svgToDataUri("hello")).toThrow(/outside the <svg> element/);
    expect(() => decodeSvgDataUri("data:text/plain,hi")).toThrow(/not an SVG data URI/);
  });

  it("handles a large SVG", () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg">${'<path d="M0 0L1 1"/>'.repeat(20_000)}</svg>`;
    const t0 = Date.now();
    expect(svgToDataUri(big).length).toBeGreaterThan(300_000);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe("snippetFor", () => {
  const uri = svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>");

  it("wraps the URI for CSS, HTML and Markdown", () => {
    expect(snippetFor("uri", uri)).toBe(uri);
    expect(snippetFor("css-background", uri)).toBe(`background-image: url("${uri}");\nbackground-repeat: no-repeat;\nbackground-size: contain;`);
    expect(snippetFor("css-mask", uri)).toContain("mask: url(");
    expect(snippetFor("css-mask", uri)).toContain("background-color: currentColor;");
    expect(snippetFor("img", uri, 'A "logo"')).toBe(`<img src="${uri}" alt="A &quot;logo&quot;" />`);
    expect(snippetFor("markdown", uri, "logo")).toMatch(/^!\[logo\]\(data:image\/svg\+xml,[^ ()]+\)$/);
  });
});
