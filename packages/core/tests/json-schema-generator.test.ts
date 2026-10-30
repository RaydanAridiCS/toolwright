import { describe, expect, it } from "vitest";
import { jsonToSchema } from "../src/json-schema-generator";

/** Read a nested value, e.g. at(schema, "properties", "rows", "items"). */
const at = (value: unknown, ...path: string[]) => path.reduce<unknown>((v, key) => (v as Record<string, unknown>)[key], value);

const gen = (value: unknown, options = {}) => {
  const { $schema, ...rest } = JSON.parse(jsonToSchema(JSON.stringify(value), options)) as Record<string, unknown>;
  void $schema;
  return rest;
};

describe("jsonToSchema", () => {
  it("names the draft", () => {
    const schema = (draft?: "2020-12" | "2019-09" | "draft-07") => JSON.parse(jsonToSchema("1", { draft })).$schema;
    expect(schema()).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema("2019-09")).toBe("https://json-schema.org/draft/2019-09/schema");
    expect(schema("draft-07")).toBe("http://json-schema.org/draft-07/schema#");
  });

  it("describes primitives, distinguishing integers from numbers", () => {
    expect(gen("x")).toEqual({ type: "string" });
    expect(gen(3)).toEqual({ type: "integer" });
    expect(gen(3.5)).toEqual({ type: "number" });
    expect(gen(true)).toEqual({ type: "boolean" });
    expect(gen(null)).toEqual({ type: "null" });
  });

  it("describes objects and marks every key required", () => {
    expect(gen({ id: 1, name: "Ada" })).toEqual({
      type: "object",
      properties: { id: { type: "integer" }, name: { type: "string" } },
      required: ["id", "name"],
    });
  });

  it("can skip required and forbid extra keys", () => {
    expect(gen({ a: 1 }, { markRequired: false, noAdditionalProperties: true })).toEqual({
      type: "object",
      properties: { a: { type: "integer" } },
      additionalProperties: false,
    });
  });

  it("handles empty objects and arrays", () => {
    expect(gen({})).toEqual({ type: "object" });
    expect(gen([])).toEqual({ type: "array" });
    expect(gen({ xs: [] })).toMatchObject({ properties: { xs: { type: "array" } } });
  });

  it("merges array items: keys missing from some become optional", () => {
    expect(gen([{ id: 1, tag: "a" }, { id: 2 }])).toEqual({
      type: "array",
      items: { type: "object", properties: { id: { type: "integer" }, tag: { type: "string" } }, required: ["id"] },
    });
  });

  it("widens integer and number to number", () => {
    expect(gen([1, 2.5])).toEqual({ type: "array", items: { type: "number" } });
  });

  it("uses a type list for mixed simple types", () => {
    expect(gen([1, "a", null])).toEqual({ type: "array", items: { type: ["integer", "string", "null"] } });
  });

  it("uses anyOf when a mix includes objects or arrays", () => {
    expect(gen([{ a: 1 }, "x"])).toEqual({
      type: "array",
      items: { anyOf: [{ type: "object", properties: { a: { type: "integer" } }, required: ["a"] }, { type: "string" }] },
    });
  });

  it("merges nested arrays of objects", () => {
    const schema = gen({ rows: [{ cells: [{ v: 1 }] }, { cells: [{ v: 1, w: "x" }] }] });
    expect(at(schema, "properties", "rows", "items", "properties", "cells", "items", "required")).toEqual(["v"]);
  });

  it("detects formats only when every sample agrees", () => {
    expect(gen({ at: "2024-05-01T10:00:00Z", on: "2024-05-01", id: "123e4567-e89b-12d3-a456-426614174000", to: "ada@example.com", home: "https://example.com/a?b=1", ip: "192.168.0.1" })).toMatchObject({
      properties: {
        at: { format: "date-time" },
        on: { format: "date" },
        id: { format: "uuid" },
        to: { format: "email" },
        home: { format: "uri" },
        ip: { format: "ipv4" },
      },
    });
    expect(gen(["ada@example.com", "not an email"])).toEqual({ type: "array", items: { type: "string" } });
    expect(gen("ada@example.com", { detectFormats: false })).toEqual({ type: "string" });
  });

  it("does not misread near-misses as formats", () => {
    expect(gen("999.1.1.1")).toEqual({ type: "string" });
    expect(gen("2024-5-1")).toEqual({ type: "string" });
    expect(gen("a@b")).toEqual({ type: "string" });
  });

  it("skips format checks on huge strings quickly", () => {
    const start = Date.now();
    expect(gen("a@" + "b.".repeat(100000))).toEqual({ type: "string" });
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("keeps awkward keys, including __proto__ and unicode", () => {
    const schema = gen(JSON.parse('{"__proto__": 1, "😀": "x", "a b": null}'));
    expect(Object.keys(at(schema, "properties") as object)).toEqual(["__proto__", "😀", "a b"]);
    expect(at(schema, "required")).toEqual(["__proto__", "😀", "a b"]);
  });

  it("reads sample data with a single object first and many rows quickly", () => {
    const rows = Array.from({ length: 20000 }, (_, i) => ({ id: i, name: `n${i}`, ...(i % 2 ? { extra: true } : {}) }));
    const schema = gen(rows);
    expect(at(schema, "items", "required")).toEqual(["id", "name"]);
    expect(at(schema, "items", "properties", "extra")).toEqual({ type: "boolean" });
  });

  it("explains empty and invalid input", () => {
    expect(() => jsonToSchema("")).toThrow(/Paste a JSON sample/);
    expect(() => jsonToSchema("   ")).toThrow(/Paste a JSON sample/);
    expect(() => jsonToSchema("{oops}")).toThrow(/line 1/);
  });

  it("reports excessive nesting instead of crashing", () => {
    const deep = "[".repeat(100000) + "]".repeat(100000);
    expect(() => jsonToSchema(deep)).toThrow(/nested too deeply|Maximum call stack/);
  });
});
