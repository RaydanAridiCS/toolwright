/** Structural comparison of two JSON documents. Keep this file free of React, the DOM and the network. */
import { JsonSyntaxError, parseJson } from "./json";

export type JsonChangeType = "added" | "removed" | "changed";

export interface JsonChange {
  type: JsonChangeType;
  /** Where the change is, e.g. `$.users[0].name` or `$["content-type"]`. */
  path: string;
  /** Value in the original (absent for `added`). */
  before?: unknown;
  /** Value in the changed document (absent for `removed`). */
  after?: unknown;
}

export interface JsonDiffOptions {
  /** Treat arrays as unordered collections: [1, 2] equals [2, 1]. */
  ignoreArrayOrder?: boolean;
}

export interface JsonDiffResult {
  changes: JsonChange[];
  identical: boolean;
  added: number;
  removed: number;
  changed: number;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const keyPath = (parent: string, key: string) => (IDENT.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`);

/** Stable text for a value: object keys are sorted so key order never matters. */
function canonical(value: unknown, ignoreArrayOrder: boolean): string {
  if (Array.isArray(value)) {
    const parts = value.map((v) => canonical(v, ignoreArrayOrder));
    if (ignoreArrayOrder) parts.sort();
    return `[${parts.join(",")}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k], ignoreArrayOrder)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Compare two already-parsed JSON values. */
export function diffJson(original: unknown, changed: unknown, options: JsonDiffOptions = {}): JsonChange[] {
  const ignoreOrder = Boolean(options.ignoreArrayOrder);
  const changes: JsonChange[] = [];

  const walk = (a: unknown, b: unknown, path: string) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (ignoreOrder) return walkUnordered(a, b, path);
      const shared = Math.min(a.length, b.length);
      for (let i = 0; i < shared; i++) walk(a[i], b[i], `${path}[${i}]`);
      for (let i = shared; i < a.length; i++) changes.push({ type: "removed", path: `${path}[${i}]`, before: a[i] });
      for (let i = shared; i < b.length; i++) changes.push({ type: "added", path: `${path}[${i}]`, after: b[i] });
      return;
    }
    if (isObject(a) && isObject(b)) {
      for (const key of Object.keys(a)) {
        if (has(b, key)) walk(a[key], b[key], keyPath(path, key));
        else changes.push({ type: "removed", path: keyPath(path, key), before: a[key] });
      }
      for (const key of Object.keys(b)) {
        if (!has(a, key)) changes.push({ type: "added", path: keyPath(path, key), after: b[key] });
      }
      return;
    }
    // Primitives, or two values of different kinds (object vs array vs number…).
    if (canonical(a, false) !== canonical(b, false)) changes.push({ type: "changed", path, before: a, after: b });
  };

  const walkUnordered = (a: unknown[], b: unknown[], path: string) => {
    // Pair up equal items first; whatever is left over is a real difference.
    const pool = new Map<string, number[]>();
    b.forEach((item, i) => {
      const key = canonical(item, true);
      pool.set(key, [...(pool.get(key) ?? []), i]);
    });
    const unmatchedA: number[] = [];
    a.forEach((item, i) => {
      const slots = pool.get(canonical(item, true));
      if (slots?.length) slots.shift();
      else unmatchedA.push(i);
    });
    const unmatchedB = [...pool.values()].flat().sort((x, y) => x - y);
    for (const i of unmatchedA) changes.push({ type: "removed", path: `${path}[${i}]`, before: a[i] });
    for (const i of unmatchedB) changes.push({ type: "added", path: `${path}[${i}]`, after: b[i] });
  };

  try {
    walk(original, changed, "$");
  } catch (err) {
    if (err instanceof RangeError) throw new Error("These documents are nested too deeply to compare.");
    throw err;
  }
  return changes;
}

function parseSide(text: string, label: string): unknown {
  if (!text.trim()) throw new Error(`The ${label} side is empty. Paste a JSON document.`);
  const result = parseJson(text);
  if (!result.ok) throw new Error(`The ${label} side is not valid JSON: ${new JsonSyntaxError(result.error).message}.`);
  return result.value;
}

/** Parse two JSON texts and compare them. Errors say which side is at fault. */
export function diffJsonText(originalText: string, changedText: string, options: JsonDiffOptions = {}): JsonDiffResult {
  const changes = diffJson(parseSide(originalText, "original"), parseSide(changedText, "changed"), options);
  const count = (type: JsonChangeType) => changes.filter((c) => c.type === type).length;
  return { changes, identical: changes.length === 0, added: count("added"), removed: count("removed"), changed: count("changed") };
}

const show = (value: unknown) => JSON.stringify(value) ?? "null";

/** One line per change, ready to paste into a ticket or review comment. */
export function formatChanges(changes: JsonChange[]): string {
  return changes
    .map((c) => {
      if (c.type === "added") return `+ ${c.path}: ${show(c.after)}`;
      if (c.type === "removed") return `- ${c.path}: ${show(c.before)}`;
      return `~ ${c.path}: ${show(c.before)} → ${show(c.after)}`;
    })
    .join("\n");
}
