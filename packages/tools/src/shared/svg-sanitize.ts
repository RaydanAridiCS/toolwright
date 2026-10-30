/**
 * Clean an SVG of anything that can run script or reach outside the file. The heavy lifting is done by DOMPurify, with
 * extra rules for SVG: references to other files and addresses are removed, @import and external url() in CSS are
 * removed, and animation that could set a link to javascript: is removed.
 * Needs a DOM (it runs in the browser, or in jsdom in tests).
 */
import DOMPurify from "dompurify";
import { parseSvg, SvgSyntaxError } from "@toolwright/core/svg-xml";

const LOCAL_HREF = /^\s*(?:#|data:image\/(?:png|jpe?g|gif|webp|svg\+xml)[;,])/i;

/** Remove @import and anything in url(...) that is not a local #reference or an embedded data: picture. */
function cleanCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(["']?)([^)]*?)\1\s*\)/gi, (m, _q: string, target: string) => (/^\s*(?:#|data:image\/)/i.test(target) ? m : "none"))
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

export interface SanitizeOptions {
  /** Keep <style> elements (their contents are still cleaned). Default true. */
  keepStyles?: boolean;
}

/** Return a cleaned copy of the SVG. Throws a readable error for text that is not an SVG. */
export function sanitizeSvg(source: string, options: SanitizeOptions = {}): string {
  const { keepStyles = true } = options;
  try {
    parseSvg(source);
  } catch (err) {
    if (err instanceof SvgSyntaxError) throw new Error(`Line ${err.line}: ${err.message}`);
    throw err;
  }

  const purify = DOMPurify(window);
  purify.addHook("uponSanitizeAttribute", (node, data) => {
    const name = data.attrName.toLowerCase();
    if ((name === "href" || name === "xlink:href" || name === "src") && !LOCAL_HREF.test(data.attrValue)) {
      data.keepAttr = false;
    } else if (name === "style") {
      data.attrValue = cleanCss(data.attrValue);
    }
    void node;
  });
  purify.addHook("uponSanitizeElement", (node, data) => {
    const tag = data.tagName.toLowerCase();
    if (tag === "style") {
      if (!keepStyles) return void node.parentNode?.removeChild(node);
      node.textContent = cleanCss(node.textContent ?? "");
    }
    // Animation can change an attribute over time, including turning a link into javascript:.
    if (tag === "animate" || tag === "set" || tag === "animatetransform" || tag === "animatemotion") {
      const target = (node as Element).getAttribute?.("attributeName") ?? "";
      if (/href|^on/i.test(target)) node.parentNode?.removeChild(node);
    }
  });

  try {
    const body = purify.sanitize(source, {
      USE_PROFILES: { svg: true, svgFilters: true },
      // <use> reuses shapes in the same file. DOMPurify drops it by default; it is safe here because the hook above keeps only local #references.
      ADD_TAGS: ["use"],
      FORBID_TAGS: ["script", "foreignObject", "iframe", "embed", "object", "audio", "video", "handler", "listener"],
      FORBID_ATTR: ["onload", "onclick", "onerror", "onmouseover", "onfocus", "onbegin", "onend", "onrepeat"],
      RETURN_DOM: true,
    }) as HTMLElement;
    const svg = body.querySelector("svg");
    if (!svg) throw new Error("Nothing safe was left to keep. The file may contain only unsafe content.");
    if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(svg);
  } finally {
    purify.removeAllHooks();
  }
}
