import { describe, expect, it } from "vitest";
import { CONFLICT_LABELS, mergeJson, mergeJsonText } from "../src/json-merge";

const keys = (v: unknown) => Object.keys(v as object);

describe("mergeJson: objects", () => {
  it("combines changes to different keys without conflict", () => {
    const base = { name: "app", version: "1.0.0", debug: false };
    const ours = { name: "app", version: "1.1.0", debug: false };
    const theirs = { name: "app", version: "1.0.0", debug: true };
    const r = mergeJson(base, ours, theirs);
    expect(r.merged).toEqual({ name: "app", version: "1.1.0", debug: true });
    expect(r.conflicts).toEqual([]);
  });

  it("accepts a change made on only one side, including removals", () => {
    const base = { a: 1, b: 2, c: 3 };
    expect(mergeJson(base, { a: 1, b: 2 }, { a: 1, b: 2, c: 3 }).merged).toEqual({ a: 1, b: 2 });
    expect(mergeJson(base, { a: 1, b: 2, c: 3 }, { a: 9, b: 2, c: 3 }).merged).toEqual({ a: 9, b: 2, c: 3 });
    expect(mergeJson(base, { a: 1 }, { a: 1, b: 2 }).merged).toEqual({ a: 1 });
  });

  it("is fine when both sides make the same change", () => {
    const r = mergeJson({ a: 1 }, { a: 2, n: { x: 1 } }, { a: 2, n: { x: 1 } });
    expect(r.merged).toEqual({ a: 2, n: { x: 1 } });
    expect(r.conflicts).toEqual([]);
  });

  it("merges nested objects key by key", () => {
    const base = { user: { name: "Ada", tags: ["x"], prefs: { theme: "light", lang: "en" } } };
    const ours = { user: { name: "Ada", tags: ["x"], prefs: { theme: "dark", lang: "en" } } };
    const theirs = { user: { name: "Ada L.", tags: ["x"], prefs: { theme: "light", lang: "fr" } } };
    const r = mergeJson(base, ours, theirs);
    expect(r.merged).toEqual({ user: { name: "Ada L.", tags: ["x"], prefs: { theme: "dark", lang: "fr" } } });
    expect(r.conflicts).toEqual([]);
  });

  it("reports a conflict with its path and keeps your side by default", () => {
    const r = mergeJson({ a: { b: 1 } }, { a: { b: 2 } }, { a: { b: 3 } });
    expect(r.merged).toEqual({ a: { b: 2 } });
    expect(r.conflicts).toEqual([{ path: "$.a.b", kind: "both-changed", base: 1, ours: 2, theirs: 3, chosen: "ours" }]);
  });

  it("can prefer their side instead", () => {
    const r = mergeJson({ a: 1 }, { a: 2 }, { a: 3 }, { prefer: "theirs" });
    expect(r.merged).toEqual({ a: 3 });
    expect(r.conflicts[0]?.chosen).toBe("theirs");
  });

  it("flags a change on one side and a removal on the other", () => {
    const r = mergeJson({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 5 });
    expect(r.conflicts).toEqual([{ path: "$.b", kind: "changed-and-removed", base: 2, ours: undefined, theirs: 5, chosen: "ours" }]);
    expect(r.merged).toEqual({ a: 1 });
    expect(mergeJson({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 5 }, { prefer: "theirs" }).merged).toEqual({ a: 1, b: 5 });
  });

  it("flags two different additions of the same key, but not two equal ones", () => {
    expect(mergeJson({}, { x: 1 }, { x: 2 }).conflicts[0]?.kind).toBe("both-added");
    expect(mergeJson({}, { x: 1 }, { x: 1 }).conflicts).toEqual([]);
    expect(mergeJson({}, { n: { a: 1 } }, { n: { b: 2 } }).merged).toEqual({ n: { a: 1, b: 2 } });
  });

  it("flags values that changed to different kinds", () => {
    const r = mergeJson({ v: 1 }, { v: "one" }, { v: [1] });
    expect(r.conflicts[0]?.kind).toBe("type-differs");
  });

  it("treats null as a value, not as missing", () => {
    expect(mergeJson({ a: 1 }, { a: null }, { a: 1 }).merged).toEqual({ a: null });
    expect(mergeJson({}, { a: null }, {}).merged).toEqual({ a: null });
  });

  it("merges plain values at the top level", () => {
    expect(mergeJson(1, 2, 1).merged).toBe(2);
    expect(mergeJson("a", "a", "b").merged).toBe("b");
    expect(mergeJson(1, 2, 3).conflicts[0]?.path).toBe("$");
  });

  it("writes unusual keys in the path", () => {
    const r = mergeJson({ "a b": { "c.d": 1 } }, { "a b": { "c.d": 2 } }, { "a b": { "c.d": 3 } });
    expect(r.conflicts[0]?.path).toBe('$["a b"]["c.d"]');
  });
});

describe("mergeJson: key order", () => {
  it("keeps your order when only you reordered", () => {
    const base = { a: 1, b: 2, c: 3 };
    const r = mergeJson(base, { c: 3, a: 1, b: 2 }, { a: 1, b: 2, c: 3 });
    expect(keys(r.merged)).toEqual(["c", "a", "b"]);
  });

  it("keeps their order when only they reordered", () => {
    const base = { a: 1, b: 2, c: 3 };
    const r = mergeJson(base, { a: 1, b: 2, c: 3 }, { b: 2, c: 3, a: 1 });
    expect(keys(r.merged)).toEqual(["b", "c", "a"]);
  });

  it("uses the chosen side's order when both reordered", () => {
    const base = { a: 1, b: 2, c: 3 };
    const ours = { c: 3, b: 2, a: 1 };
    const theirs = { b: 2, a: 1, c: 3 };
    expect(keys(mergeJson(base, ours, theirs).merged)).toEqual(["c", "b", "a"]);
    expect(keys(mergeJson(base, ours, theirs, { keyOrder: "theirs" }).merged)).toEqual(["b", "a", "c"]);
  });

  it("puts a key added by the other side right after the key that precedes it there", () => {
    const base = { a: 1, c: 3 };
    const ours = { a: 1, c: 3, z: 26 };
    const theirs = { a: 1, b: 2, c: 3 };
    expect(keys(mergeJson(base, ours, theirs).merged)).toEqual(["a", "b", "c", "z"]);
  });

  it("puts a key that comes first on the other side first", () => {
    expect(keys(mergeJson({ b: 2 }, { b: 2 }, { a: 1, b: 2 }).merged)).toEqual(["a", "b"]);
  });

  it("drops removed keys from the order", () => {
    expect(keys(mergeJson({ a: 1, b: 2, c: 3 }, { a: 1, c: 3 }, { a: 1, b: 2, c: 3 }).merged)).toEqual(["a", "c"]);
  });
});

describe("mergeJson: arrays", () => {
  it("treats an array as one value by default", () => {
    const base = { tags: ["a"] };
    expect(mergeJson(base, { tags: ["a", "b"] }, { tags: ["a"] }).merged).toEqual({ tags: ["a", "b"] });
    const r = mergeJson(base, { tags: ["a", "b"] }, { tags: ["a", "c"] });
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]?.path).toBe("$.tags");
  });

  it("unions arrays: keeps additions from both, drops removals from either", () => {
    const base = { tags: ["a", "b", "c"] };
    const ours = { tags: ["a", "b", "x"] }; // removed c, added x
    const theirs = { tags: ["a", "c", "y"] }; // removed b, added y
    const r = mergeJson(base, ours, theirs, { arrays: "union" });
    expect(r.merged).toEqual({ tags: ["a", "x", "y"] });
    expect(r.conflicts).toEqual([]);
  });

  it("unions arrays of objects by content, whatever their key order", () => {
    const r = mergeJson({ l: [{ a: 1, b: 2 }] }, { l: [{ b: 2, a: 1 }, { a: 3 }] }, { l: [{ a: 1, b: 2 }, { a: 4 }] }, { arrays: "union" });
    expect(r.merged).toEqual({ l: [{ a: 1, b: 2 }, { a: 3 }, { a: 4 }] });
  });

  const people = (...p: Record<string, unknown>[]) => ({ people: p });

  it("matches objects by a key and merges each one", () => {
    const base = people({ id: 1, name: "Ada", role: "dev" }, { id: 2, name: "Bob", role: "ops" });
    const ours = people({ id: 1, name: "Ada", role: "lead" }, { id: 2, name: "Bob", role: "ops" });
    const theirs = people({ id: 1, name: "Ada L.", role: "dev" }, { id: 2, name: "Bob", role: "ops" }, { id: 3, name: "Cy", role: "qa" });
    const r = mergeJson(base, ours, theirs, { arrays: "keyed", arrayKey: "id" });
    expect(r.merged).toEqual(people({ id: 1, name: "Ada L.", role: "lead" }, { id: 2, name: "Bob", role: "ops" }, { id: 3, name: "Cy", role: "qa" }));
    expect(r.conflicts).toEqual([]);
  });

  it("removes an item one side removed and the other left alone, and names conflicts by key", () => {
    const base = people({ id: 1, n: "a" }, { id: 2, n: "b" });
    const ours = people({ id: 1, n: "a" });
    const theirs = people({ id: 1, n: "z" }, { id: 2, n: "b" });
    expect(mergeJson(base, ours, theirs, { arrays: "keyed", arrayKey: "id" }).merged).toEqual(people({ id: 1, n: "z" }));
    const clash = mergeJson(base, people({ id: 1, n: "x" }, { id: 2, n: "b" }), theirs, { arrays: "keyed", arrayKey: "id" });
    expect(clash.conflicts[0]?.path).toBe("$.people[id=1].n");
  });

  it("falls back to a single-value merge, with a note, when items cannot be matched", () => {
    const r = mergeJson({ l: [{ a: 1 }] }, { l: [{ a: 2 }] }, { l: [{ a: 1 }, { a: 3 }] }, { arrays: "keyed", arrayKey: "id" });
    expect(r.notes[0]).toMatch(/could not be matched by “id”/);
    expect(r.merged).toEqual({ l: [{ a: 2 }] });
    const dupes = mergeJson({ l: [] }, { l: [{ id: 1 }, { id: 1 }] }, { l: [] }, { arrays: "keyed", arrayKey: "id" });
    expect(dupes.notes).toHaveLength(1);
  });

  it("needs a key name for keyed arrays", () => {
    expect(() => mergeJson({}, {}, {}, { arrays: "keyed" })).toThrow(/identifies each array item/);
  });
});

describe("mergeJson: safety and scale", () => {
  it("does not let a __proto__ key touch the prototype", () => {
    const parse = (s: string) => JSON.parse(s) as unknown;
    const r = mergeJson(parse('{"__proto__":{"x":1}}'), parse('{"__proto__":{"x":2}}'), parse('{"__proto__":{"x":1},"y":1}'));
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(r.merged, "__proto__")).toBe(true);
    expect(JSON.stringify(r.merged)).toBe('{"__proto__":{"x":2},"y":1}');
  });

  it("reports documents that are too deeply nested instead of crashing", () => {
    let doc: unknown = 1;
    for (let i = 0; i < 100_000; i++) doc = { a: doc };
    expect(() => mergeJson(doc, doc, doc)).toThrow(/nested too deeply/);
  });

  it("merges large documents quickly", () => {
    const big = (n: number, tweak: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, { id: i, v: i === tweak ? "changed" : i }]));
    const t0 = Date.now();
    const r = mergeJson(big(20_000, -1), big(20_000, 5), big(20_000, 15_000));
    expect(r.conflicts).toEqual([]);
    expect((r.merged as Record<string, { v: unknown }>).k5?.v).toBe("changed");
    expect((r.merged as Record<string, { v: unknown }>).k15000?.v).toBe("changed");
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("merges long keyed arrays quickly", () => {
    const list = (tweak: number) => ({ items: Array.from({ length: 20_000 }, (_, i) => ({ id: i, v: i === tweak ? "x" : i })) });
    const r = mergeJson(list(-1), list(3), list(19_999), { arrays: "keyed", arrayKey: "id" });
    expect(r.conflicts).toEqual([]);
  });
});

describe("mergeJsonText", () => {
  const base = '{"a":1,"b":{"c":2}}';

  it("formats the result and counts conflicts", () => {
    const r = mergeJsonText(base, '{"a":2,"b":{"c":2}}', '{"a":1,"b":{"c":3}}');
    expect(r.text).toBe('{\n  "a": 2,\n  "b": {\n    "c": 3\n  }\n}');
    expect(r.conflicts).toEqual([]);
    expect(mergeJsonText(base, base, base, {}, 4).text).toContain('    "c": 2');
    expect(mergeJsonText(base, base, base, {}, "\t").text).toContain('\t"a"');
  });

  it("names the document that is not valid JSON, or empty", () => {
    expect(() => mergeJsonText("{", base, base)).toThrow(/The base \(common ancestor\) is not valid JSON/);
    expect(() => mergeJsonText(base, "nope", base)).toThrow(/Your version is not valid JSON/);
    expect(() => mergeJsonText(base, base, "")).toThrow(/Their version is empty/);
  });

  it("has a label for every kind of conflict", () => {
    for (const kind of ["both-changed", "both-added", "changed-and-removed", "type-differs"] as const) expect(CONFLICT_LABELS[kind]).toBeTruthy();
  });
});
