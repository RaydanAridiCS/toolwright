import { describe, expect, it } from "vitest";
import { formatGraphql, GraphqlSyntaxError, minifyGraphql, tokenizeGraphql } from "../src/graphql-formatter";

const significant = (src: string) => tokenizeGraphql(src).filter((t) => t.type !== "comment").map((t) => t.value);

describe("tokenizeGraphql", () => {
  it("reads names, numbers, strings, punctuation and spreads, and skips commas", () => {
    expect(significant('{ a(x: -1.5e3, y: "s\\"q") ...F @d }')).toEqual(["{", "a", "(", "x", ":", "-1.5e3", "y", ":", '"s\\"q"', ")", "...", "F", "@", "d", "}"]);
  });

  it("reads comments and block strings, with line numbers", () => {
    const tokens = tokenizeGraphql('# top\n"""\ndoc\n"""\ntype A');
    expect(tokens.map((t) => [t.type, t.line, t.endLine])).toEqual([
      ["comment", 1, 1],
      ["block", 2, 4],
      ["name", 5, 5],
      ["name", 5, 5],
    ]);
  });

  it("explains bad input with a line number", () => {
    expect(() => tokenizeGraphql('{ a(b: "oops) }')).toThrow(/string on line 1 is never closed/);
    expect(() => tokenizeGraphql('"""never ends')).toThrow(/block string that starts on line 1/);
    expect(() => tokenizeGraphql("{\n  a %\n}")).toThrow(/Unexpected character “%” on line 2/);
    expect(() => tokenizeGraphql("{ a(b: 12x) }")).toThrow(/runs straight into/);
    try {
      tokenizeGraphql("\n\n?");
    } catch (err) {
      expect(err).toBeInstanceOf(GraphqlSyntaxError);
      expect((err as GraphqlSyntaxError).line).toBe(3);
    }
  });
});

describe("formatGraphql: operations", () => {
  it("lays out a query one field per line", () => {
    expect(formatGraphql("query GetUser($id: ID!){user(id:$id){id name,email friends{id}}}")).toBe(
      ["query GetUser($id: ID!) {", "  user(id: $id) {", "    id", "    name", "    email", "    friends {", "      id", "    }", "  }", "}"].join("\n"),
    );
  });

  it("formats an anonymous query and keeps empty selections", () => {
    expect(formatGraphql("{a{b}}")).toBe("{\n  a {\n    b\n  }\n}");
    expect(formatGraphql("query { a {} }")).toBe("query {\n  a {}\n}");
  });

  it("formats aliases, directives, fragments and inline fragments", () => {
    const out = formatGraphql("query Q($a: Boolean = true){ me: viewer { ...Basic @include(if: $a) ... on User { id } ... @skip(if: false) { x } } } fragment Basic on User { name }");
    expect(out).toBe(
      [
        "query Q($a: Boolean = true) {",
        "  me: viewer {",
        "    ...Basic @include(if: $a)",
        "    ... on User {",
        "      id",
        "    }",
        "    ... @skip(if: false) {",
        "      x",
        "    }",
        "  }",
        "}",
        "",
        "fragment Basic on User {",
        "  name",
        "}",
      ].join("\n"),
    );
  });

  it("formats values: lists, objects, enums, nulls and variables", () => {
    expect(formatGraphql('{ search(filter:{tags:["a","b"],range:{min:1,max:2.5},kind:ADMIN,none:null},limit:$n){id} }', { width: 120 })).toBe(
      ['{', '  search(filter: { tags: ["a", "b"], range: { min: 1, max: 2.5 }, kind: ADMIN, none: null }, limit: $n) {', "    id", "  }", "}"].join("\n"),
    );
  });

  it("puts each argument on its own line, without commas, when the line is too long", () => {
    const out = formatGraphql("{ users(first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }, filter: ACTIVE_ONLY) { id } }");
    expect(out).toBe(
      ["{", "  users(", "    first: 100", "    after: $cursor", "    orderBy: { field: CREATED_AT, direction: DESC }", "    filter: ACTIVE_ONLY", "  ) {", "    id", "  }", "}"].join("\n"),
    );
  });

  it("splits long variable definitions the same way", () => {
    const out = formatGraphql("query Search($query: String!, $first: Int = 20, $after: String, $filters: [FilterInput!] = []) { a }");
    expect(out.split("\n").slice(0, 6)).toEqual(["query Search(", "  $query: String!", "  $first: Int = 20", "  $after: String", "  $filters: [FilterInput!] = []", ") {"]);
  });

  it("formats a mutation, a subscription and several operations with blank lines between", () => {
    const out = formatGraphql("mutation M{like(id:1){ok}}subscription S{tick}");
    expect(out).toBe("mutation M {\n  like(id: 1) {\n    ok\n  }\n}\n\nsubscription S {\n  tick\n}");
  });

  it("respects the indent option and the width option", () => {
    expect(formatGraphql("{a{b}}", { indent: 4 })).toBe("{\n    a {\n        b\n    }\n}");
    expect(formatGraphql("{a{b}}", { indent: "tab" })).toBe("{\n\ta {\n\t\tb\n\t}\n}");
    expect(formatGraphql("{ a(x: 1, y: 2) }", { width: 10 })).toBe("{\n  a(\n    x: 1\n    y: 2\n  )\n}");
  });
});

describe("formatGraphql: comments and blank lines", () => {
  it("keeps comments where they were, on their own line or at the end of a line", () => {
    const out = formatGraphql("# the user\nquery {\n  # who\n  me { id # primary key\n    name }\n}");
    expect(out).toBe(["# the user", "query {", "  # who", "  me {", "    id # primary key", "    name", "  }", "}"].join("\n"));
  });

  it("keeps one blank line where there were several, inside blocks and between definitions", () => {
    const out = formatGraphql("{\n  a\n\n\n  b\n}\n\n\n\nquery Q { c }");
    expect(out).toBe(["{", "  a", "", "  b", "}", "", "query Q {", "  c", "}"].join("\n"));
  });

  it("keeps a comment together with the definition it sits above", () => {
    expect(formatGraphql("type A { a: Int }\n# about B\ntype B { b: Int }")).toBe(["type A {", "  a: Int", "}", "", "# about B", "type B {", "  b: Int", "}"].join("\n"));
  });

  it("returns a comment-only document as it is", () => {
    expect(formatGraphql("# nothing here\n# at all")).toBe("# nothing here\n# at all");
    expect(formatGraphql("   ")).toBe("");
  });
});

describe("formatGraphql: schema definitions", () => {
  it("formats types, interfaces, enums, inputs, unions, scalars and directives", () => {
    const sdl = 'schema{query:Query mutation:Mutation} scalar Date type User implements Node&Entity @key(fields:"id"){id:ID! name(format:String="full"):String tags:[String!]! friends(first:Int=10,after:String):[User!]!} interface Node{id:ID!} enum Role{ADMIN USER GUEST} input NewUser{name:String! role:Role=USER} union Result=User|Error directive @cache(ttl:Int=60) repeatable on FIELD_DEFINITION|OBJECT';
    expect(formatGraphql(sdl)).toBe(
      [
        "schema {",
        "  query: Query",
        "  mutation: Mutation",
        "}",
        "",
        "scalar Date",
        "",
        'type User implements Node & Entity @key(fields: "id") {',
        "  id: ID!",
        '  name(format: String = "full"): String',
        "  tags: [String!]!",
        "  friends(first: Int = 10, after: String): [User!]!",
        "}",
        "",
        "interface Node {",
        "  id: ID!",
        "}",
        "",
        "enum Role {",
        "  ADMIN",
        "  USER",
        "  GUEST",
        "}",
        "",
        "input NewUser {",
        "  name: String!",
        "  role: Role = USER",
        "}",
        "",
        "union Result = User | Error",
        "",
        "directive @cache(ttl: Int = 60) repeatable on FIELD_DEFINITION | OBJECT",
      ].join("\n"),
    );
  });

  it("formats extensions and a field whose type is named like a keyword", () => {
    expect(formatGraphql("extend type Query{type:String input:Int}")).toBe("extend type Query {\n  type: String\n  input: Int\n}");
  });

  it("puts descriptions on their own lines, as strings or block strings", () => {
    const out = formatGraphql('"A user"\ntype User {\n  "The id"\n  id: ID!\n  """\n  Many words\n  over lines\n  """\n  bio: String\n}');
    expect(out).toBe(['"A user"', "type User {", '  "The id"', "  id: ID!", '  """', "  Many words", "  over lines", '  """', "  bio: String", "}"].join("\n"));
  });

  it("keeps a one-line block string on one line", () => {
    expect(formatGraphql('"""One line"""\ntype A { a: Int }')).toBe('"""One line"""\ntype A {\n  a: Int\n}');
  });
});

describe("formatGraphql: guarantees", () => {
  const corpus = [
    "query GetUser($id: ID!){user(id:$id){id name,email friends{id}}}",
    "{ search(filter:{tags:[\"a\",\"b\"],kind:ADMIN},limit:$n){...F @include(if:true) ... on X{y}} }",
    "type A implements B&C @d(x:1){a(p:Int=1,q:[String!]=[\"x\"]):[A!]! \"desc\" b:Int}",
    "# c\nquery{a # t\n b}\n\n\nfragment F on T{x}",
    "enum E{A B C} union U=A|B|C scalar S directive @x on FIELD",
    "mutation($input:CreateInput!,$a:Int,$b:Int,$c:Int,$d:Int,$e:Int,$f:Int,$g:Int){create(input:$input){id}}",
    '{ a(s: "with # hash and , comma") }',
  ];

  it("is idempotent: formatting formatted output changes nothing", () => {
    for (const src of corpus) {
      const once = formatGraphql(src);
      expect(formatGraphql(once), src).toBe(once);
    }
  });

  it("loses and adds no tokens, only layout", () => {
    for (const src of corpus) expect(significant(formatGraphql(src)), src).toEqual(significant(src));
  });

  it("produces output that tokenizes and matches brackets again, with and without minify", () => {
    for (const src of corpus) {
      expect(significant(minifyGraphql(src)), src).toEqual(significant(src));
      expect(minifyGraphql(formatGraphql(src))).toBe(minifyGraphql(src));
    }
  });

  it("explains unbalanced brackets with line numbers", () => {
    expect(() => formatGraphql("{\n  a {\n    b\n}")).toThrow(/“\{” on line 1 is never closed/);
    expect(() => formatGraphql("{ a } }")).toThrow(/“\}” on line 1 with nothing to close/);
    expect(() => formatGraphql("{ a(x: [1) }")).toThrow(/“\[” on line 1 is closed by “\)”/);
  });

  it("handles a very large document", () => {
    const big = `{ ${Array.from({ length: 5000 }, (_, i) => `f${i}(a: ${i}) { x y }`).join(" ")} }`;
    const t0 = Date.now();
    const out = formatGraphql(big);
    expect(out.split("\n").length).toBeGreaterThan(20_000);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe("minifyGraphql", () => {
  it("removes comments and spaces that are not needed", () => {
    expect(minifyGraphql("# hi\nquery GetUser($id: ID!) {\n  user(id: $id) { id, name }\n}")).toBe("query GetUser($id:ID!){user(id:$id){id name}}");
  });

  it("keeps the space between two words, and spreads", () => {
    expect(minifyGraphql("{ ...F ... on User { id } }")).toBe("{...F...on User{id}}");
    expect(minifyGraphql("query Q { a b }")).toBe("query Q{a b}");
  });

  it("keeps strings as they are", () => {
    expect(minifyGraphql('{ a(s: "x # y, z") }')).toBe('{a(s:"x # y, z")}');
  });
});
