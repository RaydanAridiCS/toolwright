/** Page-list editing for the PDF Page Organizer. Pure functions, no PDF library needed. */
import type { PageOp } from "./pdf";

export type Turn = 0 | 90 | 180 | 270;

export interface PlanPage {
  /** Stable key for rendering; copies get a new one. */
  id: number;
  /** Zero-based page of the original PDF. */
  source: number;
  /** Extra clockwise rotation on top of the page's own. */
  turn: Turn;
}

/** The starting plan: every page, in order, untouched. */
export function initialPlan(pageCount: number): PlanPage[] {
  return Array.from({ length: pageCount }, (_, i) => ({ id: i, source: i, turn: 0 as Turn }));
}

/** Move the page at `from` so it ends up at `to`. Out-of-range moves leave the plan unchanged. */
export function movePage(plan: PlanPage[], from: number, to: number): PlanPage[] {
  if (from === to || from < 0 || to < 0 || from >= plan.length || to >= plan.length) return plan;
  const next = [...plan];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as PlanPage);
  return next;
}

export function turnPage(plan: PlanPage[], index: number, quarterTurns: number): PlanPage[] {
  if (index < 0 || index >= plan.length) return plan;
  return plan.map((p, i) => (i === index ? { ...p, turn: ((((p.turn + quarterTurns * 90) % 360) + 360) % 360) as Turn } : p));
}

export function removePage(plan: PlanPage[], index: number): PlanPage[] {
  return plan.filter((_, i) => i !== index);
}

/** Insert a copy straight after the page at `index`. */
export function duplicatePage(plan: PlanPage[], index: number): PlanPage[] {
  const page = plan[index];
  if (!page) return plan;
  const id = plan.reduce((max, p) => Math.max(max, p.id), -1) + 1;
  const next = [...plan];
  next.splice(index + 1, 0, { ...page, id });
  return next;
}

export function reversePlan(plan: PlanPage[]): PlanPage[] {
  return [...plan].reverse();
}

/**
 * Fix a double-sided stack scanned in two passes: all fronts first, then all backs in reverse.
 * Pages 1, 2, 3 | 6, 5, 4 become 1, 6, 2, 5, 3, 4… read in the right order.
 */
export function collateDuplexScan(plan: PlanPage[]): PlanPage[] {
  if (plan.length < 2 || plan.length % 2 !== 0) throw new Error("Collating needs an even number of pages: one back for every front.");
  const half = plan.length / 2;
  const out: PlanPage[] = [];
  for (let i = 0; i < half; i++) out.push(plan[i] as PlanPage, plan[plan.length - 1 - i] as PlanPage);
  return out;
}

/** What `organizePages` needs. */
export function planToOps(plan: PlanPage[]): PageOp[] {
  return plan.map((p) => ({ source: p.source, rotate: p.turn }));
}

/** True when the plan would produce exactly the original file's pages. */
export function isUntouched(plan: PlanPage[], pageCount: number): boolean {
  return plan.length === pageCount && plan.every((p, i) => p.source === i && p.turn === 0);
}
