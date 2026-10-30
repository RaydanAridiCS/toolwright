import { describe, expect, it } from "vitest";
import { formatPath, matchesToJson, queryJsonPath, queryJsonPathText } from "../src/jsonpath-tester";

const store = {
  store: {
    book: [
      { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
      { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
      { category: "fiction", author: "Herman Melville", title: "Moby Dick", isbn: "0-553-21311-3", price: 8.99 },
      { category: "fiction", author: "J. R. R. Tolkien", title: "The Lord of the Rings", isbn: "0-395-19395-8", price: 22.99 },
    ],
    bicycle: { color: "red", price: 399 },
  },
  "content-type": "json",
};

const values = (q: string, doc: unknown = store) => queryJsonPath(doc, q).matches.map((m) => m.value);
const paths = (q: string, doc: unknown = store) => queryJsonPath(doc, q).matches.map((m) => m.path);

describe("selectors", () => {
  it("selects the root", () => {
    expect(values("$", { a: 1 })).toEqual([{ a: 1 }]);
  });

  it("selects by dot and bracket names, with the same result", () => {
    expect(values("$.store.bicycle.color")).toEqual(["red"]);
    expect(values("$['store']['bicycle']['color']")).toEqual(["red"]);
    expect(values('$["store"].bicycle.color')).toEqual(["red"]);
  });

  it("allows dashes in dot names and quoted odd keys", () => {
    expect(values("$.content-type")).toEqual(["json"]);
    expect(values("$['a b']", { "a b": 1 })).toEqual([1]);
  });

  it("selects array indexes, including negative ones", () => {
    expect(values("$.store.book[0].title")).toEqual(["Sayings of the Century"]);
    expect(values("$.store.book[-1].title")).toEqual(["The Lord of the Rings"]);
    expect(values("$.store.book[9]")).toEqual([]);
    expect(values("$.store.book[-9]")).toEqual([]);
  });

  it("supports wildcards", () => {
    expect(values("$.store.book[*].price")).toEqual([8.95, 12.99, 8.99, 22.99]);
    expect(values("$.store.bicycle.*")).toEqual(["red", 399]);
  });

  it("supports unions in order", () => {
    expect(values("$.store.book[0,2].title")).toEqual(["Sayings of the Century", "Moby Dick"]);
    expect(values("$['store']['bicycle']['price','color']")).toEqual([399, "red"]);
  });

  it("supports slices like Python", () => {
    const list = [0, 1, 2, 3, 4, 5];
    expect(values("$[1:3]", list)).toEqual([1, 2]);
    expect(values("$[:2]", list)).toEqual([0, 1]);
    expect(values("$[4:]", list)).toEqual([4, 5]);
    expect(values("$[-2:]", list)).toEqual([4, 5]);
    expect(values("$[::2]", list)).toEqual([0, 2, 4]);
    expect(values("$[::-1]", list)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(values("$[3:0:-1]", list)).toEqual([3, 2, 1]);
    expect(values("$[::0]", list)).toEqual([]);
    expect(values("$[10:20]", list)).toEqual([]);
  });

  it("ignores selectors that do not fit the value", () => {
    expect(values("$.a.b", { a: 5 })).toEqual([]);
    expect(values("$[0]", { a: 5 })).toEqual([]);
    expect(values("$.a", [1, 2])).toEqual([]);
  });

  it("does not read inherited properties", () => {
    expect(values("$.constructor", {})).toEqual([]);
    expect(values("$['__proto__']", {})).toEqual([]);
  });

  it("finds keys that look like prototype names when they are own keys", () => {
    const doc = JSON.parse('{"__proto__": 1}') as unknown;
    expect(values("$['__proto__']", doc)).toEqual([1]);
  });
});

describe("descendants", () => {
  it("finds a key at any depth, parents before children", () => {
    expect(values("$..price")).toEqual([8.95, 12.99, 8.99, 22.99, 399]);
    expect(paths("$..color")).toEqual(["$['store']['bicycle']['color']"]);
  });

  it("selects every value with ..*", () => {
    expect(values("$..*", { a: { b: 1 }, c: [2] })).toEqual([{ b: 1 }, [2], 1, 2]);
  });

  it("supports ..[index]", () => {
    expect(values("$..[0]", { a: [1, 2], b: [[3]] })).toEqual([1, [3], 3]);
  });
});

describe("filters", () => {
  it("compares numbers", () => {
    expect(values("$.store.book[?(@.price < 10)].title")).toEqual(["Sayings of the Century", "Moby Dick"]);
    expect(values("$.store.book[?(@.price >= 22.99)].title")).toEqual(["The Lord of the Rings"]);
    expect(values("$.store.book[?(@.price == 8.99)].title")).toEqual(["Moby Dick"]);
  });

  it("works without the parentheses", () => {
    expect(values("$.store.book[?@.price<9].title")).toEqual(["Sayings of the Century", "Moby Dick"]);
  });

  it("compares strings with either quote style", () => {
    expect(values("$.store.book[?(@.category == 'reference')].author")).toEqual(["Nigel Rees"]);
    expect(values('$.store.book[?(@.category != "fiction")].author')).toEqual(["Nigel Rees"]);
  });

  it("tests for a key", () => {
    expect(values("$.store.book[?(@.isbn)].title")).toEqual(["Moby Dick", "The Lord of the Rings"]);
    expect(values("$.store.book[?(!@.isbn)].title")).toEqual(["Sayings of the Century", "Sword of Honour"]);
  });

  it("treats a key with a falsy value as present", () => {
    expect(values("$[?(@.n)]", [{ n: 0 }, { n: null }, {}])).toEqual([{ n: 0 }, { n: null }]);
  });

  it("combines tests with && and ||", () => {
    expect(values("$.store.book[?(@.category == 'fiction' && @.price < 10)].title")).toEqual(["Moby Dick"]);
    expect(values("$.store.book[?(@.price < 9 || @.price > 20)].title")).toEqual(["Sayings of the Century", "Moby Dick", "The Lord of the Rings"]);
    expect(values("$.store.book[?((@.price < 9 || @.price > 20) && @.isbn)].title")).toEqual(["Moby Dick", "The Lord of the Rings"]);
  });

  it("filters object values as well as array items", () => {
    expect(values("$.*[?(@.price > 100)].color")).toEqual(["red"]);
    expect(values("$[?(@ > 1)]", { a: 1, b: 2, c: 3 })).toEqual([2, 3]);
  });

  it("treats a missing key as equal only to another missing key", () => {
    const rows = [{ a: 1 }, { b: 2 }];
    expect(values("$[?(@.a == 1)]", rows)).toEqual([{ a: 1 }]);
    expect(values("$[?(@.a != 1)]", rows)).toEqual([{ b: 2 }]);
    expect(values("$[?(@.a < 5)]", rows)).toEqual([{ a: 1 }]);
    // Row 2 has neither key, and two missing values are equal; row 1 has a, so it differs from the missing key.
    expect(values("$[?(@.a == @.zzz)]", rows)).toEqual([{ b: 2 }]);
    expect(values("$[?(@.q == @.zzz)]", rows)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("never orders values of different types", () => {
    const rows = [{ v: "5" }, { v: 5 }, { v: true }, { v: null }];
    expect(values("$[?(@.v > 1)]", rows)).toEqual([{ v: 5 }]);
    expect(values("$[?(@.v <= 5)]", rows)).toEqual([{ v: 5 }]);
    expect(values("$[?(@.v == null)]", rows)).toEqual([{ v: null }]);
    expect(values("$[?(@.v == true)]", rows)).toEqual([{ v: true }]);
  });

  it("compares arrays and objects deeply", () => {
    expect(values("$[?(@.t == $.want)]", [{ t: { a: [1, 2] } }, { t: { a: [2, 1] } }]).length).toBe(0);
    const doc = { want: { a: [1, 2] }, rows: [{ t: { a: [1, 2] } }, { t: { a: [2, 1] } }] };
    expect(values("$.rows[?(@.t == $.want)]", doc)).toEqual([{ t: { a: [1, 2] } }]);
  });

  it("can refer back to the root with $", () => {
    const doc = { limit: 10, items: [{ n: 5 }, { n: 15 }] };
    expect(values("$.items[?(@.n < $.limit)]", doc)).toEqual([{ n: 5 }]);
  });

  it("supports length() and count()", () => {
    const rows = [{ tags: ["a", "b"], name: "ab" }, { tags: [], name: "héllo" }, { tags: ["x"], name: "😀😀😀" }];
    expect(values("$[?(length(@.tags) > 1)]", rows)).toEqual([rows[0]]);
    expect(values("$[?(length(@.name) == 3)]", rows)).toEqual([rows[2]]);
    expect(values("$[?(count(@.tags[*]) == 0)]", rows)).toEqual([rows[1]]);
  });

  it("supports match() and search()", () => {
    expect(values("$.store.book[?(match(@.author, 'J\\\\. R\\\\. R\\\\. .*'))].title")).toEqual(["The Lord of the Rings"]);
    expect(values("$.store.book[?(search(@.title, 'Moby'))].author")).toEqual(["Herman Melville"]);
    expect(values("$.store.book[?(match(@.title, 'Moby'))]")).toEqual([]);
    expect(values("$[?(match(@.n, 'a'))]", [{ n: 1 }])).toEqual([]);
  });

  it("reports an invalid regular expression", () => {
    expect(() => queryJsonPath([{ n: "a" }], "$[?(search(@.n, '('))]")).toThrow(/not a valid regular expression/);
  });
});

describe("results", () => {
  it("returns normalized paths", () => {
    expect(paths("$.store.book[?(@.isbn)].title")).toEqual(["$['store']['book'][2]['title']", "$['store']['book'][3]['title']"]);
  });

  it("escapes awkward keys in paths", () => {
    expect(formatPath(["it's", "a\\b", "line\nbreak", "\u0001"])).toBe("$['it\\'s']['a\\\\b']['line\\nbreak']['\\u0001']");
    expect(formatPath([])).toBe("$");
  });

  it("returns null values, not nothing", () => {
    expect(values("$.a", { a: null })).toEqual([null]);
  });

  it("limits the matches but counts all of them", () => {
    const result = queryJsonPath(Array.from({ length: 50 }, (_, i) => i), "$[*]", { limit: 10 });
    expect(result.matches).toHaveLength(10);
    expect(result.total).toBe(50);
    expect(result.truncated).toBe(true);
  });

  it("works on primitive roots and empty containers", () => {
    expect(values("$", 5)).toEqual([5]);
    expect(values("$[*]", [])).toEqual([]);
    expect(values("$..a", {})).toEqual([]);
  });

  it("copes with unicode keys", () => {
    expect(values("$.名前", { 名前: "x" })).toEqual(["x"]);
    expect(values("$['🙂']", { "🙂": 1 })).toEqual([1]);
  });

  it("formats matches as a JSON array", () => {
    expect(matchesToJson(queryJsonPath({ a: [1, 2] }, "$.a[*]").matches)).toBe("[\n  1,\n  2\n]");
    expect(matchesToJson([])).toBe("[]");
  });
});

describe("bad input", () => {
  it.each([
    ["", /Type a JSONPath/],
    ["store.book", /start with \$/],
    ["$.", /Expected a key name/],
    ["$[", /Missing a closing \]/],
    ["$[]", /Empty brackets/],
    ["$['a", /never closes/],
    ["$[?(@.a ==)]", /Unexpected/],
    ["$[?(@.a == 1]", /closing \)/],
    ["$[?(foo)]", /not a value or function/],
    ["$[?(nope(@.a))]", /Unknown function/],
    ["$[?(length(@.a, 1))]", /takes 1 argument/],
    ["$[?(count(@.a.b))]", /A filter has to test something/],
    ["$[?(count('x') == 1)]", /needs a path/],
    ["$[?(5)]", /has to test something/],
    ["$.a.[0]", /not both/],
    ["$.a)", /Unexpected/],
    ["$['a\\q']", /Unknown escape/],
    ["$[99999999999999999999]", /too large/],
  ])("rejects %j", (query, message) => {
    expect(() => queryJsonPath({}, query)).toThrow(message);
  });

  it("points at the character that went wrong", () => {
    expect(() => queryJsonPath({}, "$.a)")).toThrow(/character 4/);
  });

  it("reports invalid JSON with a line number", () => {
    expect(() => queryJsonPathText('{\n "a": }', "$.a")).toThrow(/The JSON is not valid.*line 2/);
    expect(() => queryJsonPathText("   ", "$.a")).toThrow(/Paste some JSON/);
  });

  it("parses text before querying", () => {
    expect(queryJsonPathText('{"a":[1,2]}', "$.a[1]").matches).toEqual([{ path: "$['a'][1]", value: 2 }]);
  });

  it("stops queries that would touch too many values", () => {
    const wide = Array.from({ length: 1000 }, () => Array.from({ length: 1000 }, (_, i) => i));
    expect(() => queryJsonPath(wide, "$..[?(@ > 5)]..[?(@ > 5)]")).toThrow(/too many values/);
  });

  it("does not overflow the stack on a deeply nested document", () => {
    let doc: unknown = 1;
    for (let i = 0; i < 20000; i++) doc = [doc];
    expect(() => queryJsonPath(doc, "$..*")).not.toThrow(RangeError);
  });
});
