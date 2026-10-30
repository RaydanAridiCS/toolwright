import { describe, expect, it } from "vitest";
import { diffJson, diffJsonText, formatChanges } from "../src/json-diff";

describe("diffJson", () => {
  it("reports nothing for identical documents", () => {
    expect(diffJson({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([]);
  });

  it("ignores key order and whitespace-level differences", () => {
    expect(diffJsonText('{"a":1,"b":{"c":2,"d":3}}', '{ "b": { "d": 3, "c": 2 }, "a": 1 }').identical).toBe(true);
  });

  it("finds added, removed and changed keys with paths", () => {
    const changes = diffJson({ name: "Ada", age: 36, city: "London" }, { name: "Ada", age: 37, role: "admin" });
    expect(changes).toEqual([
      { type: "changed", path: "$.age", before: 36, after: 37 },
      { type: "removed", path: "$.city", before: "London" },
      { type: "added", path: "$.role", after: "admin" },
    ]);
  });

  it("compares arrays by position by default", () => {
    expect(diffJson({ xs: [1, 2, 3] }, { xs: [1, 5] })).toEqual([
      { type: "changed", path: "$.xs[1]", before: 2, after: 5 },
      { type: "removed", path: "$.xs[2]", before: 3 },
    ]);
    expect(diffJson([1, 2], [2, 1])).toHaveLength(2);
  });

  it("can ignore array order", () => {
    expect(diffJson([1, 2, { a: 1 }], [{ a: 1 }, 2, 1], { ignoreArrayOrder: true })).toEqual([]);
    expect(diffJson({ t: ["a", "b"] }, { t: ["b", "c"] }, { ignoreArrayOrder: true })).toEqual([
      { type: "removed", path: "$.t[0]", before: "a" },
      { type: "added", path: "$.t[1]", after: "c" },
    ]);
  });

  it("counts duplicates when ignoring array order", () => {
    expect(diffJson([1, 1, 2], [1, 2], { ignoreArrayOrder: true })).toEqual([{ type: "removed", path: "$[1]", before: 1 }]);
  });

  it("treats a different type as a change, not a nested diff", () => {
    expect(diffJson({ v: 1 }, { v: "1" })).toEqual([{ type: "changed", path: "$.v", before: 1, after: "1" }]);
    expect(diffJson({ v: [] }, { v: {} })).toEqual([{ type: "changed", path: "$.v", before: [], after: {} }]);
    expect(diffJson({ v: null }, { v: 0 })).toHaveLength(1);
  });

  it("quotes keys that are not plain identifiers", () => {
    const [change] = diffJson({ "content-type": "a" }, { "content-type": "b" });
    expect(change?.path).toBe('$["content-type"]');
  });

  it("handles unicode and a literal __proto__ key", () => {
    expect(diffJson({ "😀": 1 }, { "😀": 2 })[0]?.path).toBe('$["😀"]');
    const a = JSON.parse('{"__proto__":{"x":1}}');
    const b = JSON.parse('{"__proto__":{"x":2}}');
    expect(diffJson(a, b)).toEqual([{ type: "changed", path: "$.__proto__.x", before: 1, after: 2 }]);
  });

  it("handles a large array", () => {
    const a = Array.from({ length: 20000 }, (_, i) => i);
    const b = [...a];
    b[19999] = -1;
    expect(diffJson(a, b)).toHaveLength(1);
  });

  it("reports nesting that is too deep instead of crashing", () => {
    let deep: unknown = 1;
    let other: unknown = 2;
    for (let i = 0; i < 200000; i++) {
      deep = [deep];
      other = [other];
    }
    expect(() => diffJson(deep, other)).toThrow(/nested too deeply/);
  });
});

describe("diffJsonText", () => {
  it("counts each kind of change", () => {
    const r = diffJsonText('{"a":1,"b":2}', '{"a":9,"c":3}');
    expect(r).toMatchObject({ identical: false, added: 1, removed: 1, changed: 1 });
  });

  it("names the side that is empty or invalid", () => {
    expect(() => diffJsonText("", "{}")).toThrow(/original side is empty/);
    expect(() => diffJsonText("{}", "   ")).toThrow(/changed side is empty/);
    expect(() => diffJsonText("{}", "{oops}")).toThrow(/changed side is not valid JSON/);
  });

  it("accepts top-level primitives", () => {
    expect(diffJsonText("1", "2").changes).toEqual([{ type: "changed", path: "$", before: 1, after: 2 }]);
  });
});

describe("formatChanges", () => {
  it("prints one line per change", () => {
    const text = formatChanges(diffJson({ a: 1, b: 2 }, { a: 2, c: [1] }));
    expect(text).toBe('~ $.a: 1 → 2\n- $.b: 2\n+ $.c: [1]');
  });

  it("returns an empty string for no changes", () => {
    expect(formatChanges([])).toBe("");
  });
});
