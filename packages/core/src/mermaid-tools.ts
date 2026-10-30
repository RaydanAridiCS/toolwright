/**
 * The parts of the Mermaid editor that need no browser: telling which kind of diagram a text is, ready-made samples,
 * and getting an SVG ready to save as a file or turn into a PNG. Drawing the diagram itself is done by the mermaid
 * library, loaded on demand in the browser. Keep this file free of React, the DOM and the network.
 */

/** Mermaid's own limit on diagram text. Longer text is refused before drawing. */
export const MAX_DIAGRAM_CHARS = 50_000;
/** The largest PNG, in pixels, that browsers can draw on a canvas reliably. */
export const MAX_PNG_PIXELS = 16_000_000;

export interface DiagramKind {
  id: string;
  label: string;
  /** First words of the diagram text that select this kind. */
  keywords: string[];
}

export const DIAGRAM_KINDS: DiagramKind[] = [
  { id: "flowchart", label: "Flowchart", keywords: ["graph", "flowchart", "flowchart-elk"] },
  { id: "sequence", label: "Sequence diagram", keywords: ["sequenceDiagram"] },
  { id: "class", label: "Class diagram", keywords: ["classDiagram", "classDiagram-v2"] },
  { id: "state", label: "State diagram", keywords: ["stateDiagram", "stateDiagram-v2"] },
  { id: "er", label: "Entity relationship diagram", keywords: ["erDiagram"] },
  { id: "gantt", label: "Gantt chart", keywords: ["gantt"] },
  { id: "pie", label: "Pie chart", keywords: ["pie"] },
  { id: "journey", label: "User journey", keywords: ["journey"] },
  { id: "git", label: "Git graph", keywords: ["gitGraph"] },
  { id: "mindmap", label: "Mind map", keywords: ["mindmap"] },
  { id: "timeline", label: "Timeline", keywords: ["timeline"] },
  { id: "quadrant", label: "Quadrant chart", keywords: ["quadrantChart"] },
  { id: "requirement", label: "Requirement diagram", keywords: ["requirementDiagram"] },
  { id: "c4", label: "C4 diagram", keywords: ["C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment"] },
  { id: "xychart", label: "XY chart", keywords: ["xychart-beta", "xychart"] },
  { id: "sankey", label: "Sankey diagram", keywords: ["sankey-beta", "sankey"] },
  { id: "block", label: "Block diagram", keywords: ["block-beta", "block"] },
  { id: "packet", label: "Packet diagram", keywords: ["packet-beta", "packet"] },
  { id: "kanban", label: "Kanban board", keywords: ["kanban"] },
  { id: "architecture", label: "Architecture diagram", keywords: ["architecture-beta", "architecture"] },
  { id: "radar", label: "Radar chart", keywords: ["radar-beta", "radar"] },
];

export interface DiagramInfo {
  kind: DiagramKind | null;
  /** The title from a front-matter block (`---\ntitle: My diagram\n---`), if any. */
  title?: string;
  /** The text with front matter, comments and directives removed. */
  body: string;
}

/** Remove a leading `---` front-matter block and return its title. */
function frontMatter(text: string): { rest: string; title?: string } {
  const m = /^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(text);
  if (!m) return { rest: text };
  const t = /^\s*title:\s*(.+?)\s*$/m.exec(m[1] as string);
  return { rest: text.slice(m[0].length), title: t ? (t[1] as string).replace(/^["']|["']$/g, "") : undefined };
}

/** Work out what kind of diagram some Mermaid text is. */
export function detectDiagram(text: string): DiagramInfo {
  const { rest, title } = frontMatter(text);
  const body = rest
    .split(/\r?\n/)
    .filter((line) => !/^\s*%%/.test(line))
    .join("\n")
    .trim();
  const first = /^([A-Za-z][A-Za-z0-9-]*)/.exec(body)?.[1];
  const kind = first ? (DIAGRAM_KINDS.find((k) => k.keywords.includes(first)) ?? null) : null;
  return { kind, title, body };
}

/** A readable reason the text cannot be drawn, or null when it can be tried. Checked before the library is loaded. */
export function checkDiagramText(text: string): string | null {
  if (!text.trim()) return "Write or paste a diagram to see it here.";
  if (text.length > MAX_DIAGRAM_CHARS) return `This diagram is ${text.length.toLocaleString("en-US")} characters long. The limit is ${MAX_DIAGRAM_CHARS.toLocaleString("en-US")}.`;
  const info = detectDiagram(text);
  if (!info.body) return "There is only a title or comments so far. Add a diagram, for example: flowchart TD";
  if (!info.kind) {
    const first = /^\S+/.exec(info.body)?.[0] ?? "";
    return `“${first.slice(0, 30)}” is not a Mermaid diagram type. Start with one of: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, journey, gitGraph, mindmap, timeline and others.`;
  }
  return null;
}

/** Make a library error message short and plain. */
export function cleanDiagramError(message: string): string {
  const lines = message
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !/^\s*at\s/.test(l));
  const text = lines.slice(0, 6).join("\n");
  return text.length > 600 ? `${text.slice(0, 600)}…` : text || "The diagram could not be drawn.";
}

/* ----------------------------------------------------------------------------------------------- */
/* SVG preparation                                                                                   */
/* ----------------------------------------------------------------------------------------------- */

const ROOT = /<svg\b[^>]*>/i;

/** The drawing's size in CSS pixels, from its viewBox or its width and height. */
export function svgSize(svg: string): { width: number; height: number; x: number; y: number } | null {
  const root = ROOT.exec(svg)?.[0];
  if (!root) return null;
  const vb = /\bviewBox\s*=\s*["']\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(root);
  if (vb) {
    const [x, y, width, height] = [Number(vb[1]), Number(vb[2]), Number(vb[3]), Number(vb[4])];
    if (width > 0 && height > 0) return { width, height, x, y };
  }
  const w = /\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(root);
  const h = /\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(root);
  return w && h && Number(w[1]) > 0 && Number(h[1]) > 0 ? { width: Number(w[1]), height: Number(h[1]), x: 0, y: 0 } : null;
}

const escapeAttr = (v: string) => v.replace(/[^A-Za-z0-9#(),.%\s-]/g, "");

/**
 * Turn a drawing made for a web page (width 100%, a max-width style) into a file that stands on its own: an
 * XML namespace, a fixed width and height, and optionally a solid background behind everything.
 */
export function standaloneSvg(svg: string, options: { background?: string } = {}): string {
  const size = svgSize(svg);
  const root = ROOT.exec(svg)?.[0];
  if (!size || !root) throw new Error("The diagram has no size, so it cannot be saved.");
  let tag = root
    .replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sstyle\s*=\s*["'][^"']*["']/i, "")
    .replace(/^<svg/i, `<svg width="${Math.ceil(size.width)}" height="${Math.ceil(size.height)}"`);
  if (!/\sxmlns\s*=/.test(tag)) tag = tag.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  let out = svg.replace(root, tag);
  if (options.background) {
    const rect = `<rect x="${size.x}" y="${size.y}" width="${size.width}" height="${size.height}" fill="${escapeAttr(options.background)}"/>`;
    out = out.replace(tag, `${tag}${rect}`);
  }
  return /^\s*<\?xml/.test(out) ? out : `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;
}

/** Pixel size of the PNG for a drawing and a scale, lowered when it would be too large for a canvas. */
export function pngSize(width: number, height: number, scale: number, maxPixels = MAX_PNG_PIXELS): { width: number; height: number; scale: number; capped: boolean } {
  let s = scale;
  let capped = false;
  if (width * s * height * s > maxPixels) {
    s = Math.sqrt(maxPixels / (width * height));
    capped = true;
  }
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)), scale: s, capped };
}

/** A safe file name (no extension) from a diagram title, falling back to its kind. */
export function diagramFileName(title: string | undefined, kind: DiagramKind | null): string {
  const base = (title || kind?.label || "diagram")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "diagram";
}

/* ----------------------------------------------------------------------------------------------- */
/* Samples                                                                                           */
/* ----------------------------------------------------------------------------------------------- */

export interface DiagramSample {
  id: string;
  label: string;
  /** The `DIAGRAM_KINDS` id this sample should be recognised as. */
  kind: string;
  code: string;
}

export const DIAGRAM_SAMPLES: DiagramSample[] = [
  {
    id: "flowchart",
    label: "Flowchart: sign-in",
    kind: "flowchart",
    code: `---
title: Sign-in flow
---
flowchart TD
  A[Open the app] --> B{Signed in?}
  B -- Yes --> C[Show dashboard]
  B -- No --> D[Show sign-in form]
  D --> E{Password correct?}
  E -- Yes --> C
  E -- No --> F[Show error]
  F --> D`,
  },
  {
    id: "sequence",
    label: "Sequence: checkout",
    kind: "sequence",
    code: `sequenceDiagram
  autonumber
  participant U as Customer
  participant S as Shop
  participant P as Payments
  U->>S: Place order
  S->>P: Charge card
  alt Approved
    P-->>S: OK
    S-->>U: Receipt
  else Declined
    P-->>S: Declined
    S-->>U: Try another card
  end`,
  },
  {
    id: "class",
    label: "Class diagram",
    kind: "class",
    code: `classDiagram
  class Animal {
    +String name
    +eat()
  }
  class Dog {
    +bark()
  }
  class Cat {
    +purr()
  }
  Animal <|-- Dog
  Animal <|-- Cat`,
  },
  {
    id: "state",
    label: "State diagram",
    kind: "state",
    code: `stateDiagram-v2
  [*] --> Draft
  Draft --> Review: submit
  Review --> Draft: request changes
  Review --> Published: approve
  Published --> [*]`,
  },
  {
    id: "er",
    label: "Entity relationship",
    kind: "er",
    code: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "appears in"
  CUSTOMER {
    string name
    string email
  }`,
  },
  {
    id: "gantt",
    label: "Gantt chart",
    kind: "gantt",
    code: `gantt
  title Launch plan
  dateFormat YYYY-MM-DD
  section Build
  Design      :a1, 2026-03-02, 7d
  Develop     :after a1, 14d
  section Launch
  Test        :2026-03-23, 5d
  Release     :milestone, 2026-03-30, 0d`,
  },
  {
    id: "pie",
    label: "Pie chart",
    kind: "pie",
    code: `pie showData
  title Where the day goes
  "Work" : 8
  "Sleep" : 7
  "Family" : 4
  "Other" : 5`,
  },
  {
    id: "journey",
    label: "User journey",
    kind: "journey",
    code: `journey
  title A morning commute
  section Leave home
    Make tea: 5: Me
    Find keys: 2: Me
  section Travel
    Catch the bus: 3: Me, Bus driver
    Read a book: 5: Me`,
  },
  {
    id: "git",
    label: "Git graph",
    kind: "git",
    code: `gitGraph
  commit
  branch feature
  checkout feature
  commit
  commit
  checkout main
  merge feature
  commit tag: "v1.0"`,
  },
  {
    id: "mindmap",
    label: "Mind map",
    kind: "mindmap",
    code: `mindmap
  root((Toolwright))
    PDF
      Merge
      Sign
    Developer
      JSON
      Docker
    Privacy
      No uploads`,
  },
  {
    id: "timeline",
    label: "Timeline",
    kind: "timeline",
    code: `timeline
  title History of the web
  1991 : First website
  1998 : Google founded
  2007 : First iPhone
  2020 : Remote work everywhere`,
  },
  {
    id: "quadrant",
    label: "Quadrant chart",
    kind: "quadrant",
    code: `quadrantChart
  title Reach and effort
  x-axis Low effort --> High effort
  y-axis Low reach --> High reach
  quadrant-1 Plan
  quadrant-2 Do first
  quadrant-3 Maybe
  quadrant-4 Skip
  Newsletter: [0.3, 0.6]
  Redesign: [0.8, 0.7]
  Ad campaign: [0.7, 0.3]`,
  },
];
