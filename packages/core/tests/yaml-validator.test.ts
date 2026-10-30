import { describe, expect, it } from "vitest";
import { validateYaml } from "../src/yaml-validator";

const rules = (text: string) => validateYaml(text).issues.map((i) => i.rule);

describe("validateYaml: valid documents", () => {
  it("accepts a mapping and shows it as JSON", () => {
    const r = validateYaml("name: app\nports:\n  - 80\n  - 443\nenabled: true\n");
    expect(r).toMatchObject({ valid: true, documents: 1, kind: "mapping", issues: [] });
    expect(JSON.parse(r.json as string)).toEqual({ name: "app", ports: [80, 443], enabled: true });
  });

  it("accepts lists, single values and several documents", () => {
    expect(validateYaml("- a\n- b\n").kind).toBe("list");
    expect(validateYaml("42\n").kind).toBe("value");
    const multi = validateYaml("a: 1\n---\nb: 2\n");
    expect(multi.documents).toBe(2);
    expect(JSON.parse(multi.json as string)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("treats empty input as valid and empty", () => {
    expect(validateYaml("")).toMatchObject({ valid: true, documents: 0, kind: "empty" });
    expect(validateYaml("   \n  ")).toMatchObject({ valid: true, kind: "empty" });
    expect(validateYaml("# just a comment\n").kind).toBe("empty");
  });

  it("understands anchors, aliases, block scalars and quoted strings", () => {
    const r = validateYaml("base: &b\n  x: 1\nuse: *b\ntext: |\n  line one\n  line two\nq: \"a: b\"\n");
    expect(r.valid).toBe(true);
    expect(JSON.parse(r.json as string).use).toEqual({ x: 1 });
  });
});

describe("validateYaml: errors", () => {
  it("reports the line and column of bad indentation", () => {
    const r = validateYaml("a:\n  b: 1\n c: 2\n");
    expect(r.valid).toBe(false);
    expect(r.issues[0]).toMatchObject({ severity: "error", rule: "Y000", line: 3 });
    expect(r.issues[0]?.message).toMatch(/\.$/);
  });

  it("reports duplicate keys", () => {
    const r = validateYaml("a: 1\nb: 2\na: 3\n");
    expect(r.valid).toBe(false);
    expect(r.issues[0]?.message).toMatch(/duplicated mapping key/i);
    expect(r.issues[0]?.line).toBe(3);
  });

  it("reports unclosed quotes and tabs", () => {
    expect(validateYaml('a: "oops\nb: 1\n').valid).toBe(false);
    expect(validateYaml("a:\n\t- b\n").valid).toBe(false);
    expect(validateYaml("a: [1, 2\n").valid).toBe(false);
  });

  it("does not run code from tags", () => {
    const r = validateYaml("a: !!js/function 'function () { return 1 }'\n");
    expect(r.valid).toBe(false);
  });
});

describe("validateYaml: traps", () => {
  it("warns about yes, no, on, off, y and n, in values and lists, but not when quoted or in comments", () => {
    const r = validateYaml('a: yes\nb: No\nc: ON\nd: off\ne: y\nlist:\n  - n\nok: "yes"\nalso: \'no\'\ntrue_one: true\nnote: hello yes\nx: 1 # yes\n');
    const lines = r.issues.filter((i) => i.rule === "Y003").map((i) => i.line);
    expect(lines).toEqual([1, 2, 3, 4, 5, 7]);
    expect(r.valid).toBe(true);
  });

  it("warns about values with a leading zero", () => {
    const r = validateYaml("mode: 0755\nzip: 02134\nzero: 0\nfloat: 0.5\n");
    expect(r.issues.filter((i) => i.rule === "Y004").map((i) => i.line)).toEqual([1, 2]);
    expect(r.issues[0]?.message).toContain("493");
  });

  it("suggests quoting versions that lose a trailing zero", () => {
    const r = validateYaml("python-version: 3.10\nname: 1.10\nnode: 18\n");
    expect(r.issues.filter((i) => i.rule === "Y005").map((i) => i.line)).toEqual([1]);
  });

  it("ignores lines inside block scalars", () => {
    const r = validateYaml("script: |\n  enabled: yes\n  mode: 0755\nafter: no\n");
    expect(r.issues.filter((i) => i.rule === "Y003" || i.rule === "Y004").map((i) => i.line)).toEqual([4]);
  });

  it("notes trailing spaces, a missing final newline and very long lines", () => {
    const r = validateYaml(`a: 1  \nb: ${"x".repeat(170)}`);
    expect(rules(`a: 1  \nb: ${"x".repeat(170)}`)).toEqual(expect.arrayContaining(["Y001", "Y002", "Y006"]));
    expect(r.valid).toBe(true);
  });

  it("limits how many trailing-space notes it lists", () => {
    const text = Array.from({ length: 20 }, (_, i) => `k${i}: 1 `).join("\n") + "\n";
    const issues = validateYaml(text).issues.filter((i) => i.rule === "Y001");
    expect(issues.length).toBe(6);
    expect(issues[5]?.message).toMatch(/15 more lines/);
  });
});

describe("validateYaml: limits", () => {
  it("hides the JSON view for a document that expands hugely through aliases", () => {
    const levels = ["a0: &a0 [x, x, x, x, x, x, x, x, x]"];
    for (let i = 1; i <= 9; i++) levels.push(`a${i}: &a${i} [*a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}]`);
    const r = validateYaml(levels.join("\n"));
    expect(r.valid).toBe(true);
    expect(r.json).toBeUndefined();
    expect(r.issues.some((i) => i.rule === "Y007")).toBe(true);
  });

  it("handles a large ordinary document", () => {
    const text = Array.from({ length: 20_000 }, (_, i) => `key${i}: value${i}`).join("\n") + "\n";
    const t0 = Date.now();
    const r = validateYaml(text);
    expect(r.valid).toBe(true);
    expect(Date.now() - t0).toBeLessThan(4000);
  });
});
