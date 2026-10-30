/**
 * JSONPath queries (RFC 9535 subset) over parsed JSON. Keep this file free of React, the DOM and the network.
 *
 * Supported: `$`, `.name`, `['name']`, `[0]`, `[-1]`, `[1:3]`, `[::2]`, `.*`, `[*]`, `..name`, `..[*]`,
 * unions (`[0,2]`, `['a','b']`) and filters (`[?(@.price < 10 && @.tag == 'sale')]`) with comparisons,
 * `&&`, `||`, `!`, existence tests and the functions length(), count(), match() and search().
 * Nothing here evaluates code: queries are parsed into a small tree and walked.
 */
import { parseJson } from "./json";

export interface JsonPathMatch {
  /** Normalized path of the match, e.g. `$['store']['book'][0]`. */
  path: string;
  value: unknown;
}

export interface JsonPathResult {
  /** Matches in document order, cut off at `limit`. */
  matches: JsonPathMatch[];
  /** How many nodes matched in total. */
  total: number;
  truncated: boolean;
}

export interface JsonPathOptions {
  /** Most matches to return (default 1000). `total` still counts them all. */
  limit?: number;
}

type Primitive = string | number | boolean | null;

type Selector =
  | { t: "name"; name: string }
  | { t: "index"; index: number }
  | { t: "wild" }
  | { t: "slice"; start: number | null; end: number | null; step: number | null }
  | { t: "filter"; expr: Expr };

interface Segment {
  descendant: boolean;
  selectors: Selector[];
}

type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

type Expr =
  | { t: "lit"; value: Primitive }
  | { t: "query"; root: boolean; segments: Segment[] }
  | { t: "fn"; name: string; args: Expr[] }
  | { t: "cmp"; op: CompareOp; left: Expr; right: Expr }
  | { t: "and" | "or"; left: Expr; right: Expr }
  | { t: "not"; expr: Expr };

const NOTHING = Symbol("nothing");
type Value = unknown | typeof NOTHING;

const MAX_STEPS = 2_000_000;
const FUNCTIONS: Record<string, number> = { length: 1, count: 1, match: 2, search: 2 };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/* ------------------------------ parsing ------------------------------ */

class Parser {
  private pos = 0;
  constructor(private readonly src: string) {}

  parse(): Segment[] {
    this.ws();
    if (this.src[this.pos] !== "$") throw this.fail("A JSONPath must start with $ (the root of the document).");
    this.pos++;
    const segments = this.segments();
    this.ws();
    if (this.pos < this.src.length) throw this.fail(`Unexpected “${this.src[this.pos]}”.`);
    return segments;
  }

  private fail(message: string, at = this.pos): Error {
    return new Error(`${message} (character ${at + 1})`);
  }

  private ws() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos] as string)) this.pos++;
  }

  private segments(): Segment[] {
    const out: Segment[] = [];
    for (;;) {
      const start = this.pos;
      this.ws();
      const c = this.src[this.pos];
      if (c === ".") {
        const descendant = this.src[this.pos + 1] === ".";
        this.pos += descendant ? 2 : 1;
        if (this.src[this.pos] === "[") {
          if (!descendant) throw this.fail("Use either .name or [selector], not both: write $.a['b'] or $.a.b.");
          out.push({ descendant, selectors: this.bracket() });
        } else if (this.src[this.pos] === "*") {
          this.pos++;
          out.push({ descendant, selectors: [{ t: "wild" }] });
        } else {
          out.push({ descendant, selectors: [{ t: "name", name: this.shorthand() }] });
        }
      } else if (c === "[") {
        out.push({ descendant: false, selectors: this.bracket() });
      } else {
        this.pos = start;
        return out;
      }
    }
  }

  private shorthand(): string {
    const start = this.pos;
    while (this.pos < this.src.length && !/[\s.[\](),*'"=!<>&|?:]/.test(this.src[this.pos] as string)) this.pos++;
    if (this.pos === start) throw this.fail("Expected a key name after the dot.");
    return this.src.slice(start, this.pos);
  }

  private bracket(): Selector[] {
    this.pos++; // [
    const selectors: Selector[] = [];
    for (;;) {
      this.ws();
      selectors.push(this.selector());
      this.ws();
      const c = this.src[this.pos];
      if (c === ",") {
        this.pos++;
        continue;
      }
      if (c === "]") {
        this.pos++;
        return selectors;
      }
      throw this.fail(c === undefined ? "Missing a closing ]." : `Expected , or ] but found “${c}”.`);
    }
  }

  private selector(): Selector {
    const c = this.src[this.pos];
    if (c === undefined) throw this.fail("Missing a closing ].");
    if (c === "'" || c === '"') return { t: "name", name: this.string() };
    if (c === "*") {
      this.pos++;
      return { t: "wild" };
    }
    if (c === "?") {
      this.pos++;
      const expr = this.orExpr();
      this.assertLogical(expr);
      return { t: "filter", expr };
    }
    const first = this.int();
    this.ws();
    if (this.src[this.pos] !== ":") {
      if (first === null) throw this.fail(c === "]" ? "Empty brackets: put an index, name, * or filter inside." : `Unexpected “${c}” inside the brackets.`);
      return { t: "index", index: first };
    }
    this.pos++;
    this.ws();
    const end = this.int();
    this.ws();
    let step: number | null = null;
    if (this.src[this.pos] === ":") {
      this.pos++;
      this.ws();
      step = this.int();
    }
    return { t: "slice", start: first, end, step };
  }

  private int(): number | null {
    const m = /^-?\d+/.exec(this.src.slice(this.pos));
    if (!m) return null;
    this.pos += m[0].length;
    const n = Number(m[0]);
    if (!Number.isSafeInteger(n)) throw this.fail("That number is too large to be an index.");
    return n;
  }

  private string(): string {
    const quote = this.src[this.pos] as string;
    const start = this.pos;
    this.pos++;
    let out = "";
    for (;;) {
      const c = this.src[this.pos];
      if (c === undefined) throw this.fail("This string never closes.", start);
      this.pos++;
      if (c === quote) return out;
      if (c !== "\\") {
        out += c;
        continue;
      }
      const e = this.src[this.pos++];
      const simple: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", "/": "/", "\\": "\\", "'": "'", '"': '"' };
      if (e !== undefined && has(simple, e)) out += simple[e];
      else if (e === "u" && /^[0-9a-fA-F]{4}$/.test(this.src.slice(this.pos, this.pos + 4))) {
        out += String.fromCharCode(parseInt(this.src.slice(this.pos, this.pos + 4), 16));
        this.pos += 4;
      } else throw this.fail("Unknown escape in this string.", this.pos - 2);
    }
  }

  /* filter expressions: || binds loosest, then &&, then ! and comparisons */

  private orExpr(): Expr {
    let left = this.andExpr();
    for (;;) {
      this.ws();
      if (this.src.startsWith("||", this.pos)) {
        this.pos += 2;
        left = { t: "or", left, right: this.andExpr() };
      } else return left;
    }
  }

  private andExpr(): Expr {
    let left = this.notExpr();
    for (;;) {
      this.ws();
      if (this.src.startsWith("&&", this.pos)) {
        this.pos += 2;
        left = { t: "and", left, right: this.notExpr() };
      } else return left;
    }
  }

  private notExpr(): Expr {
    this.ws();
    if (this.src[this.pos] === "!" && this.src[this.pos + 1] !== "=") {
      this.pos++;
      const expr = this.notExpr();
      this.assertLogical(expr);
      return { t: "not", expr };
    }
    const left = this.primary();
    this.ws();
    const op = /^(==|!=|<=|>=|<|>)/.exec(this.src.slice(this.pos))?.[1] as CompareOp | undefined;
    if (!op) return left;
    this.pos += op.length;
    this.ws();
    const right = this.primary();
    return { t: "cmp", op, left, right };
  }

  private primary(): Expr {
    this.ws();
    const c = this.src[this.pos];
    if (c === "(") {
      this.pos++;
      const inner = this.orExpr();
      this.ws();
      if (this.src[this.pos] !== ")") throw this.fail("Missing a closing ) in the filter.");
      this.pos++;
      return inner;
    }
    if (c === "@" || c === "$") {
      this.pos++;
      return { t: "query", root: c === "$", segments: this.segments() };
    }
    if (c === "'" || c === '"') return { t: "lit", value: this.string() };
    const num = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.src.slice(this.pos));
    if (num) {
      this.pos += num[0].length;
      return { t: "lit", value: Number(num[0]) };
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.src.slice(this.pos))?.[0];
    if (word === "true" || word === "false" || word === "null") {
      this.pos += word.length;
      return { t: "lit", value: word === "null" ? null : word === "true" };
    }
    if (word && this.src[this.pos + word.length] === "(") return this.call(word);
    if (word) throw this.fail(`“${word}” is not a value or function. Quote text values: '${word}'.`);
    throw this.fail(c === undefined ? "The filter ends too soon." : `Unexpected “${c}” in the filter.`);
  }

  private call(name: string): Expr {
    const at = this.pos;
    const arity = FUNCTIONS[name];
    if (arity === undefined) throw this.fail(`Unknown function ${name}(). Available: length, count, match, search.`);
    this.pos += name.length + 1;
    const args: Expr[] = [];
    this.ws();
    if (this.src[this.pos] !== ")") {
      for (;;) {
        args.push(this.orExpr());
        this.ws();
        if (this.src[this.pos] === ",") {
          this.pos++;
          continue;
        }
        break;
      }
    }
    if (this.src[this.pos] !== ")") throw this.fail(`Missing a closing ) after ${name}(.`);
    this.pos++;
    if (args.length !== arity) throw this.fail(`${name}() takes ${arity} argument${arity === 1 ? "" : "s"}.`, at);
    if (name === "count" && args[0]?.t !== "query") throw this.fail("count() needs a path such as count(@.items[*]).", at);
    return { t: "fn", name, args };
  }

  private assertLogical(expr: Expr) {
    if (expr.t === "lit" || (expr.t === "fn" && (expr.name === "length" || expr.name === "count"))) {
      throw this.fail("A filter has to test something, for example @.price < 10 or @.isbn.");
    }
  }
}

/* ----------------------------- evaluation ---------------------------- */

/** A value plus a link to its parent, so building a child costs O(1) however deep the document is. */
interface Node {
  value: unknown;
  parent: Node | null;
  key: string | number | null;
}

const child = (parent: Node, key: string | number, value: unknown): Node => ({ value, parent, key });

function pathOf(node: Node): (string | number)[] {
  const keys: (string | number)[] = [];
  for (let n: Node | null = node; n && n.key !== null; n = n.parent) keys.push(n.key);
  return keys.reverse();
}

class Evaluator {
  private steps = 0;
  constructor(private readonly root: unknown) {}

  run(segments: Segment[]): Node[] {
    return this.walk([{ value: this.root, parent: null, key: null }], segments, this.root);
  }

  private tick() {
    if (++this.steps > MAX_STEPS) throw new Error("This query touches too many values. Make the path more specific.");
  }

  private walk(start: Node[], segments: Segment[], current: unknown): Node[] {
    let nodes = start;
    for (const seg of segments) {
      const next: Node[] = [];
      for (const node of nodes) {
        const targets = seg.descendant ? this.descendants(node) : [node];
        for (const target of targets) this.select(target, seg.selectors, current, next);
      }
      nodes = next;
    }
    return nodes;
  }

  /** The node followed by everything below it, parents before children. */
  private descendants(node: Node): Node[] {
    const out: Node[] = [];
    const stack: Node[] = [node];
    while (stack.length) {
      const n = stack.pop() as Node;
      this.tick();
      out.push(n);
      const kids = this.children(n);
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i] as Node);
    }
    return out;
  }

  private children(node: Node): Node[] {
    const v = node.value;
    if (Array.isArray(v)) return v.map((value, i) => child(node, i, value));
    if (isObject(v)) return Object.keys(v).map((k) => child(node, k, v[k]));
    return [];
  }

  private select(node: Node, selectors: Selector[], current: unknown, out: Node[]) {
    const v = node.value;
    for (const s of selectors) {
      this.tick();
      switch (s.t) {
        case "name":
          if (isObject(v) && has(v, s.name)) out.push(child(node, s.name, v[s.name]));
          break;
        case "index":
          if (Array.isArray(v)) {
            const i = s.index < 0 ? v.length + s.index : s.index;
            if (i >= 0 && i < v.length) out.push(child(node, i, v[i]));
          }
          break;
        case "wild":
          out.push(...this.children(node));
          break;
        case "slice":
          if (Array.isArray(v)) for (const i of sliceIndexes(v.length, s.start, s.end, s.step)) out.push(child(node, i, v[i]));
          break;
        case "filter":
          for (const child of this.children(node)) if (this.truthy(s.expr, child.value, current)) out.push(child);
          break;
      }
    }
  }

  private truthy(expr: Expr, at: unknown, current: unknown): boolean {
    this.tick();
    switch (expr.t) {
      case "and":
        return this.truthy(expr.left, at, current) && this.truthy(expr.right, at, current);
      case "or":
        return this.truthy(expr.left, at, current) || this.truthy(expr.right, at, current);
      case "not":
        return !this.truthy(expr.expr, at, current);
      case "query":
        return this.nodes(expr, at).length > 0;
      case "cmp":
        return compare(expr.op, this.value(expr.left, at, current), this.value(expr.right, at, current));
      case "fn": {
        const [a, b] = expr.args as [Expr, Expr];
        const text = this.value(a, at, current);
        const pattern = this.value(b, at, current);
        if (typeof text !== "string" || typeof pattern !== "string") return false;
        try {
          return new RegExp(expr.name === "match" ? `^(?:${pattern})$` : pattern, "u").test(text);
        } catch {
          throw new Error(`“${pattern}” is not a valid regular expression.`);
        }
      }
      case "lit":
        return false;
    }
  }

  private nodes(q: Extract<Expr, { t: "query" }>, at: unknown): Node[] {
    const base = q.root ? this.root : at;
    return this.walk([{ value: base, parent: null, key: null }], q.segments, base);
  }

  private value(expr: Expr, at: unknown, current: unknown): Value {
    switch (expr.t) {
      case "lit":
        return expr.value;
      case "query": {
        const found = this.nodes(expr, at);
        return found.length === 1 ? (found[0] as Node).value : NOTHING;
      }
      case "fn": {
        if (expr.name === "count") return this.nodes(expr.args[0] as Extract<Expr, { t: "query" }>, at).length;
        if (expr.name === "length") {
          const v = this.value(expr.args[0] as Expr, at, current);
          if (typeof v === "string") return [...v].length;
          if (Array.isArray(v)) return v.length;
          if (isObject(v)) return Object.keys(v).length;
          return NOTHING;
        }
        return this.truthy(expr, at, current);
      }
      default:
        return this.truthy(expr, at, current);
    }
  }
}

function sliceIndexes(len: number, start: number | null, end: number | null, step: number | null): number[] {
  const by = step ?? 1;
  if (by === 0) return [];
  const norm = (i: number) => (i >= 0 ? i : len + i);
  const out: number[] = [];
  if (by > 0) {
    const lower = Math.min(Math.max(norm(start ?? 0), 0), len);
    const upper = Math.min(Math.max(norm(end ?? len), 0), len);
    for (let i = lower; i < upper; i += by) out.push(i);
  } else {
    const upper = Math.min(Math.max(norm(start ?? len - 1), -1), len - 1);
    const lower = Math.min(Math.max(norm(end ?? -len - 1), -1), len - 1);
    for (let i = upper; lower < i; i += by) out.push(i);
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => has(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function compare(op: CompareOp, a: Value, b: Value): boolean {
  const equal = a === NOTHING || b === NOTHING ? a === b : deepEqual(a, b);
  if (op === "==") return equal;
  if (op === "!=") return !equal;
  const ordered = (typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string");
  if (op === "<=" || op === ">=") {
    if (equal) return true;
    if (!ordered) return false;
  } else if (!ordered) return false;
  const x = a as number | string;
  const y = b as number | string;
  return op === "<" || op === "<=" ? x < y : x > y;
}

/* ------------------------------- API --------------------------------- */

const ESCAPES: Record<string, string> = { "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t", "\\": "\\\\", "'": "\\'" };

/** Escape a key for use inside a single-quoted normalized path. */
function escapeName(name: string): string {
  let out = "";
  for (const ch of name) out += ESCAPES[ch] ?? (ch.charCodeAt(0) < 0x20 ? `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}` : ch);
  return out;
}

/** Format a path the way RFC 9535 writes normalized paths: `$['a'][0]`. */
export function formatPath(path: readonly (string | number)[]): string {
  return (
    "$" +
    path
      .map((p) =>
        typeof p === "number"
          ? `[${p}]`
          : `['${escapeName(p)}']`,
      )
      .join("")
  );
}

/** Run a JSONPath query against an already parsed value. Throws an Error with a readable message for bad queries. */
export function queryJsonPath(json: unknown, query: string, options: JsonPathOptions = {}): JsonPathResult {
  const limit = Math.max(0, options.limit ?? 1000);
  if (!query.trim()) throw new Error("Type a JSONPath such as $.store.book[*].title.");
  const segments = new Parser(query).parse();
  let nodes: Node[];
  try {
    nodes = new Evaluator(json).run(segments);
  } catch (err) {
    if (err instanceof RangeError) throw new Error("The document is nested too deeply to search.");
    throw err;
  }
  return {
    matches: nodes.slice(0, limit).map((n) => ({ path: formatPath(pathOf(n)), value: n.value })),
    total: nodes.length,
    truncated: nodes.length > limit,
  };
}

/** Parse JSON text, then run the query. */
export function queryJsonPathText(jsonText: string, query: string, options: JsonPathOptions = {}): JsonPathResult {
  if (!jsonText.trim()) throw new Error("Paste some JSON to search.");
  const parsed = parseJson(jsonText);
  if (!parsed.ok) throw new Error(`The JSON is not valid: ${parsed.error.message} (line ${parsed.error.line}, column ${parsed.error.column})`);
  return queryJsonPath(parsed.value, query, options);
}

/** The matched values as a JSON array, ready to copy. */
export function matchesToJson(matches: JsonPathMatch[]): string {
  return JSON.stringify(
    matches.map((m) => m.value),
    null,
    2,
  );
}
