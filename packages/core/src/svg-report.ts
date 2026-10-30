/**
 * Compare an SVG before and after cleaning, and list what was taken out. Built on the small reader in svg-xml.ts.
 * Keep this file free of React, the DOM and the network.
 */
import { parseSvg, walkElements } from "./svg-xml";

export interface RemovedItem {
  kind: "element" | "attribute";
  /** The element name, or the attribute name. */
  name: string;
  count: number;
}

export interface CleaningReport {
  removed: RemovedItem[];
  /** Total number of elements and attributes taken out. */
  total: number;
}

function tally(svg: string) {
  const elements = new Map<string, number>();
  const attributes = new Map<string, number>();
  walkElements(parseSvg(svg).nodes, (el) => {
    elements.set(el.name, (elements.get(el.name) ?? 0) + 1);
    for (const a of el.attrs) attributes.set(a.name.toLowerCase(), (attributes.get(a.name.toLowerCase()) ?? 0) + 1);
  });
  return { elements, attributes };
}

/** What is in `before` that is not in `after`, counted by element name and attribute name. */
export function describeRemoved(before: string, after: string): CleaningReport {
  const a = tally(before);
  const b = tally(after);
  const removed: RemovedItem[] = [];
  for (const [name, count] of a.elements) {
    const left = b.elements.get(name) ?? 0;
    if (count > left) removed.push({ kind: "element", name, count: count - left });
  }
  for (const [name, count] of a.attributes) {
    const left = b.attributes.get(name) ?? 0;
    if (count > left) removed.push({ kind: "attribute", name, count: count - left });
  }
  removed.sort((x, y) => (x.kind === y.kind ? y.count - x.count || x.name.localeCompare(y.name) : x.kind === "element" ? -1 : 1));
  return { removed, total: removed.reduce((n, r) => n + r.count, 0) };
}

/** One line of plain words for each removed item. */
export function reportLines(report: CleaningReport): string[] {
  return report.removed.map((r) => (r.kind === "element" ? `Removed ${r.count} <${r.name}> element${r.count === 1 ? "" : "s"}.` : `Removed ${r.count} ${r.name} attribute${r.count === 1 ? "" : "s"}.`));
}
