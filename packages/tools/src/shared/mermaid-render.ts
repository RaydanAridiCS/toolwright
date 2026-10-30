/**
 * Draws Mermaid diagrams. This is the only file that may import `mermaid` (a test enforces it), and the library is
 * loaded here with a dynamic import, only when a diagram is first drawn. Its diagram types are split into many small
 * files that load as they are needed, all from this site.
 *
 * Settings that matter for privacy and safety:
 *  - securityLevel "strict": diagram text cannot add links that run script or change the page.
 *  - htmlLabels off: labels are plain SVG text, which also lets the drawing be saved as a PNG reliably.
 * The result is shown through an <img>, which cannot run script, and never inserted into the page as markup.
 */
import { cleanDiagramError, MAX_DIAGRAM_CHARS } from "@toolwright/core/mermaid-tools";

export type MermaidTheme = "default" | "neutral" | "forest" | "dark";

let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

/** Draw a diagram and return its SVG text. Drawing is one at a time, because the library keeps global state. Throws a readable error. */
export function renderMermaid(code: string, theme: MermaidTheme): Promise<string> {
  const job = queue.then(async () => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      fontFamily: "Arial, Helvetica, sans-serif",
      maxTextSize: MAX_DIAGRAM_CHARS,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    });
    // Syntax errors are thrown here, with the line, before anything is drawn.
    await mermaid.parse(code);
    const id = `mermaid-render-${++counter}`;
    try {
      return (await mermaid.render(id, code)).svg;
    } finally {
      // The library may leave its temporary elements behind, especially after an error.
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  });
  queue = job.catch(() => undefined);
  return job.catch((err: unknown) => {
    throw new Error(cleanDiagramError(err instanceof Error ? err.message : String(err)));
  });
}
