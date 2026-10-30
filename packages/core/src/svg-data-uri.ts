/**
 * Turn an SVG into a data URI for CSS or HTML. The URL-encoded form is usually much smaller than Base64 and stays
 * readable, because most of an SVG is plain ASCII. Keep this file free of React, the DOM and the network.
 */
import { base64Encode } from "./encoding";
import { getAttr, parseSvg, serializeSvg, setAttr } from "./svg-xml";

export type DataUriEncoding = "url" | "base64";

export interface DataUriOptions {
  /** "url" (default) leaves ASCII readable and escapes only what must be; "base64" is longer but safest for odd tools. */
  encoding?: DataUriEncoding;
}

/** Characters that must be escaped in a data URI that may sit inside quotes or url(). */
const ESCAPE = /[\r\n%#()<>?[\\\]^`{|}]/g;

/** Normalise an SVG for embedding: namespace present, single-quoted attributes, no comments or declarations, tidy whitespace. */
export function prepareForDataUri(source: string): string {
  const { nodes, root } = parseSvg(source);
  if (getAttr(root, "xmlns") !== "http://www.w3.org/2000/svg") setAttr(root, "xmlns", "http://www.w3.org/2000/svg");
  const kept = nodes.filter((n) => n.type === "element");
  return serializeSvg(kept, { quote: "'" }).replace(/[\t\r\n]+/g, " ").replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
}

/** The data URI for an SVG. */
export function svgToDataUri(source: string, options: DataUriOptions = {}): string {
  const svg = prepareForDataUri(source);
  if (options.encoding === "base64") return `data:image/svg+xml;base64,${base64Encode(svg)}`;
  const encoded = svg.replace(ESCAPE, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`).replace(/[^ -~]/g, (c) => encodeURIComponent(c));
  return `data:image/svg+xml,${encoded}`;
}

export type SnippetKind = "uri" | "css-background" | "css-mask" | "img" | "markdown";

export const SNIPPETS: { id: SnippetKind; label: string }[] = [
  { id: "uri", label: "Data URI only" },
  { id: "css-background", label: "CSS background-image" },
  { id: "css-mask", label: "CSS mask-image (recolourable icon)" },
  { id: "img", label: "HTML <img> tag" },
  { id: "markdown", label: "Markdown image" },
];

/** Wrap a data URI in something ready to paste. */
export function snippetFor(kind: SnippetKind, uri: string, alt = ""): string {
  // Inside double quotes the URL-encoded form is safe, because " is never left unescaped in it. Base64 has no quotes either.
  const q = uri.replace(/"/g, "%22");
  switch (kind) {
    case "uri":
      return uri;
    case "css-background":
      return `background-image: url("${q}");\nbackground-repeat: no-repeat;\nbackground-size: contain;`;
    case "css-mask":
      return `-webkit-mask: url("${q}") no-repeat center / contain;\nmask: url("${q}") no-repeat center / contain;\nbackground-color: currentColor;`;
    case "img":
      return `<img src="${q}" alt="${alt.replace(/"/g, "&quot;")}" />`;
    case "markdown":
      return `![${alt.replace(/[\][]/g, "")}](${q.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
  }
}

/** Decode a data URI made by `svgToDataUri` back to SVG text. Used to check the round trip. */
export function decodeSvgDataUri(uri: string): string {
  const m = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(uri);
  if (!m) throw new Error("That is not an SVG data URI.");
  if (m[1]) {
    const bin = atob(m[2] as string);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  return decodeURIComponent(m[2] as string);
}
