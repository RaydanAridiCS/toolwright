/**
 * Three-way merge of JSON documents, in the spirit of `git merge`: a common ancestor ("base") and two edited
 * versions ("ours" and "theirs") become one document. Objects merge key by key, and key order is kept.
 * Keep this file free of React, the DOM and the network.
 */

export type ConflictKind = "both-changed" | "both-added" | "changed-and-removed" | "type-differs";

export interface MergeConflict {
  /** Where it happened, written like JSONPath: $.user.roles[0] */
  path: string;
  kind: ConflictKind;
  /** The three values. Missing means the key or item did not exist on that side. */
  base?: unknown;
  ours?: unknown;
  theirs?: unknown;
  /** Which side's value ended up in the result. */
  chosen: "ours" | "theirs";
}

export interface MergeOptions {
  /** Which side wins when both changed the same place. Default "ours". */
  prefer?: "ours" | "theirs";
  /**
   * What to do with arrays.
   *  - "conflict": an array is one value; if both sides changed it differently, that is a conflict.
   *  - "union": treat arrays as sets of values: keep what either side added, drop what either side removed.
   *  - "keyed": match objects in the arrays by `arrayKey` (such as "id") and merge each one.
   */
  arrays?: "conflict" | "union" | "keyed";
  /** The property that identifies an array item, for `arrays: "keyed"`. */
  arrayKey?: string;
  /** Whose key order wins when both sides reordered the same object. Default "ours". */
  keyOrder?: "ours" | "theirs";
}

export interface MergeResult {
  merged: unknown;
  conflicts: MergeConflict[];
  /** Plain-language remarks, for example when "keyed" arrays had to fall back to "conflict". */
  notes: string[];
}

const ABSENT = Symbol("absent");
type Slot = unknown | typeof ABSENT;

interface PathNode {
  parent: PathNode | null;
  segment: string;
}

/** Built only for conflicts, from parent pointers, so walking deep documents stays linear. */
function renderPath(node: PathNode | null): string {
  const parts: string[] = [];
  for (let n = node; n !== null; n = n.parent) parts.push(n.segment);
  return `$${parts.reverse().join("")}`;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const keySegment = (key: string) => (IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`);

const isObject = (v: Slot): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const get = (o: Record<string, unknown> | undefined, k: string): Slot => (o && has(o, k) ? o[k] : ABSENT);

/** A stable text for a value, ignoring object key order, so "same content" can be compared cheaply. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (isObject(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

const same = (a: Slot, b: Slot): boolean => {
  if (a === ABSENT || b === ABSENT) return a === b;
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return canon(a) === canon(b);
};

const typeName = (v: Slot) => (v === ABSENT ? "absent" : v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
const visible = (v: Slot): unknown => (v === ABSENT ? undefined : v);

const sequence = (keys: string[], keep: (k: string) => boolean) => keys.filter(keep);
const sameSequence = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i]);

/**
 * Put the keys of two orderings together: the primary order is kept, and each key that only the secondary order
 * has is placed right after the key that precedes it there.
 */
function mergeOrder(primary: string[], secondary: string[], wanted: Set<string>): string[] {
  const out = primary.filter((k) => wanted.has(k));
  const seen = new Set(out);
  let previous: string | undefined;
  for (const key of secondary) {
    if (!wanted.has(key)) continue;
    if (!seen.has(key)) {
      const at = previous === undefined ? 0 : out.indexOf(previous) + 1;
      out.splice(at, 0, key);
      seen.add(key);
    }
    previous = key;
  }
  return out;
}

class Merger {
  readonly conflicts: MergeConflict[] = [];
  readonly notes = new Set<string>();
  readonly prefer: "ours" | "theirs";
  readonly arrays: "conflict" | "union" | "keyed";
  readonly arrayKey: string | undefined;
  readonly keyOrder: "ours" | "theirs";

  constructor(options: MergeOptions) {
    this.prefer = options.prefer ?? "ours";
    this.arrays = options.arrays ?? "conflict";
    this.arrayKey = options.arrayKey?.trim() || undefined;
    this.keyOrder = options.keyOrder ?? "ours";
    if (this.arrays === "keyed" && !this.arrayKey) throw new Error("Enter the property that identifies each array item, for example id.");
  }

  private conflict(path: PathNode | null, base: Slot, ours: Slot, theirs: Slot): Slot {
    let kind: ConflictKind;
    if (ours === ABSENT || theirs === ABSENT) kind = "changed-and-removed";
    else if (base === ABSENT) kind = "both-added";
    else if (typeName(ours) !== typeName(theirs)) kind = "type-differs";
    else kind = "both-changed";
    this.conflicts.push({ path: renderPath(path), kind, base: visible(base), ours: visible(ours), theirs: visible(theirs), chosen: this.prefer });
    return this.prefer === "ours" ? ours : theirs;
  }

  /** Merge one place. Returns ABSENT when the result has nothing there. */
  merge(base: Slot, ours: Slot, theirs: Slot, path: PathNode | null): Slot {
    if (ours === ABSENT && theirs === ABSENT) return ABSENT;
    if (isObject(ours) && isObject(theirs) && (base === ABSENT || isObject(base))) return this.mergeObjects(base === ABSENT ? undefined : (base as Record<string, unknown>), ours, theirs, path);
    if (Array.isArray(ours) && Array.isArray(theirs) && (base === ABSENT || Array.isArray(base)) && this.arrays !== "conflict") {
      if (same(ours, theirs)) return ours;
      const merged = this.arrays === "union" ? this.mergeUnion(base === ABSENT ? [] : (base as unknown[]), ours, theirs) : this.mergeKeyed(base === ABSENT ? [] : (base as unknown[]), ours, theirs, path);
      if (merged !== null) return merged;
    }
    // A single value: take whichever side changed it, or report a conflict.
    if (same(ours, theirs)) return ours;
    if (same(ours, base)) return theirs;
    if (same(theirs, base)) return ours;
    return this.conflict(path, base, ours, theirs);
  }

  private mergeObjects(base: Record<string, unknown> | undefined, ours: Record<string, unknown>, theirs: Record<string, unknown>, path: PathNode | null): Record<string, unknown> {
    const baseKeys = base ? Object.keys(base) : [];
    const oursKeys = Object.keys(ours);
    const theirsKeys = Object.keys(theirs);

    const values = new Map<string, unknown>();
    const all = new Set([...baseKeys, ...oursKeys, ...theirsKeys]);
    for (const key of all) {
      const merged = this.merge(get(base, key), get(ours, key), get(theirs, key), { parent: path, segment: keySegment(key) });
      if (merged !== ABSENT) values.set(key, merged);
    }

    // Key order: a side that did not reorder the keys it inherited should not undo the other side's reordering.
    const baseSet = new Set(baseKeys);
    const reordered = (keys: string[]) => {
      const inherited = new Set(keys.filter((k) => baseSet.has(k)));
      return !sameSequence(sequence(keys, (k) => inherited.has(k)), sequence(baseKeys, (k) => inherited.has(k)));
    };
    const oursMoved = reordered(oursKeys);
    const theirsMoved = reordered(theirsKeys);
    const useOurs = oursMoved === theirsMoved ? this.keyOrder === "ours" : oursMoved;
    const order = useOurs ? mergeOrder(oursKeys, theirsKeys, new Set(values.keys())) : mergeOrder(theirsKeys, oursKeys, new Set(values.keys()));
    // Keys that exist only in the base cannot be in `values`, so nothing is lost here.
    return Object.fromEntries(order.map((k) => [k, values.get(k)]));
  }

  /** Arrays as sets of values. Returns null to fall back to a single-value merge. */
  private mergeUnion(base: unknown[], ours: unknown[], theirs: unknown[]): unknown[] {
    const inBase = new Set(base.map(canon));
    const inOurs = new Set(ours.map(canon));
    const inTheirs = new Set(theirs.map(canon));
    const keep = (item: unknown) => {
      const c = canon(item);
      const survives = inOurs.has(c) || inTheirs.has(c);
      const removed = inBase.has(c) && (!inOurs.has(c) || !inTheirs.has(c));
      return survives && !removed;
    };
    const out: unknown[] = [];
    const seen = new Set<string>();
    for (const item of [...ours, ...theirs]) {
      const c = canon(item);
      if (seen.has(c) || !keep(item)) continue;
      seen.add(c);
      out.push(item);
    }
    return out;
  }

  /** Arrays of objects matched by a key property. Returns null (and notes why) when that is not possible. */
  private mergeKeyed(base: unknown[], ours: unknown[], theirs: unknown[], path: PathNode | null): unknown[] | null {
    const key = this.arrayKey as string;
    const index = (items: unknown[]): Map<string, Record<string, unknown>> | null => {
      const map = new Map<string, Record<string, unknown>>();
      for (const item of items) {
        if (!isObject(item) || !has(item, key)) return null;
        const id = item[key];
        if (typeof id !== "string" && typeof id !== "number") return null;
        const text = `${typeof id}:${id}`;
        if (map.has(text)) return null;
        map.set(text, item);
      }
      return map;
    };
    const b = index(base);
    const o = index(ours);
    const t = index(theirs);
    if (!b || !o || !t) {
      this.notes.add(`Some arrays could not be matched by “${key}” (an item has no ${key}, or two items share one), so they were merged as single values.`);
      return null;
    }
    const order = mergeOrder([...o.keys()], [...t.keys()], new Set([...b.keys(), ...o.keys(), ...t.keys()]));
    // Items on only one side keep that side's relative position; ours leads unless prefer says otherwise.
    const ids = this.prefer === "theirs" ? mergeOrder([...t.keys()], [...o.keys()], new Set(order)) : order;
    const out: unknown[] = [];
    for (const id of ids) {
      const item = this.merge(b.get(id) ?? ABSENT, o.get(id) ?? ABSENT, t.get(id) ?? ABSENT, { parent: path, segment: `[${key}=${id.slice(id.indexOf(":") + 1)}]` });
      if (item !== ABSENT) out.push(item);
    }
    return out;
  }
}

/** Merge three parsed JSON values. */
export function mergeJson(base: unknown, ours: unknown, theirs: unknown, options: MergeOptions = {}): MergeResult {
  const merger = new Merger(options);
  let merged: Slot;
  try {
    merged = merger.merge(base, ours, theirs, null);
  } catch (err) {
    if (err instanceof RangeError) throw new Error("These documents are nested too deeply to merge.");
    throw err;
  }
  return { merged: merged === ABSENT ? null : merged, conflicts: merger.conflicts, notes: [...merger.notes] };
}

function parseSide(text: string, label: string): unknown {
  if (!text.trim()) throw new Error(`${label} is empty. Paste the JSON for it.`);
  try {
    return JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message.replace(/^JSON\.parse: /, "") : "it could not be read";
    throw new Error(`${label} is not valid JSON: ${detail}`);
  }
}

export interface MergeTextResult extends MergeResult {
  /** The merged document, formatted. */
  text: string;
}

/** Merge three JSON texts. Throws a readable error naming the one that cannot be read. */
export function mergeJsonText(base: string, ours: string, theirs: string, options: MergeOptions = {}, indent: number | "\t" = 2): MergeTextResult {
  const result = mergeJson(parseSide(base, "The base (common ancestor)"), parseSide(ours, "Your version"), parseSide(theirs, "Their version"), options);
  return { ...result, text: JSON.stringify(result.merged, null, indent) ?? "null" };
}

export const CONFLICT_LABELS: Record<ConflictKind, string> = {
  "both-changed": "Both changed it",
  "both-added": "Both added it, differently",
  "changed-and-removed": "One changed it, the other removed it",
  "type-differs": "Both changed it to different kinds of value",
};
