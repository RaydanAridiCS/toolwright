/**
 * Format and minify GraphQL: queries, mutations, subscriptions, fragments and schema (SDL).
 * A small tokenizer and printer, no dependencies. Keep this file free of React, the DOM and the network.
 *
 * It does not check that a document is a valid GraphQL program. It checks that it can be read as tokens and that its
 * brackets match, then lays it out the way most GraphQL tooling does. Commas are insignificant in GraphQL, so they
 * are rewritten: kept between inline arguments, left out of multi-line ones.
 */

export type GraphqlTokenType = "name" | "punct" | "int" | "float" | "string" | "block" | "comment";

export interface GraphqlToken {
  type: GraphqlTokenType;
  /** The exact source text. */
  value: string;
  /** Line the token starts on, counting from 1. */
  line: number;
  /** Line the token ends on (different from `line` for block strings). */
  endLine: number;
}

export interface GraphqlFormatOptions {
  /** Spaces per level, or "tab". Default 2. */
  indent?: number | "tab";
  /** Longest line before arguments are split one per line. Default 80. */
  width?: number;
}

export class GraphqlSyntaxError extends Error {
  constructor(message: string, readonly line: number) {
    super(message);
    this.name = "GraphqlSyntaxError";
  }
}

const PUNCT = new Set(["!", "$", "&", "(", ")", ":", "=", "@", "[", "]", "{", "|", "}"]);
const NAME_START = /[_A-Za-z]/;
const NAME_PART = /[_0-9A-Za-z]/;
const DIGIT = /[0-9]/;

/** Split GraphQL source into tokens. Commas, spaces and the byte order mark are dropped. */
export function tokenizeGraphql(src: string): GraphqlToken[] {
  const tokens: GraphqlToken[] = [];
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  const n = src.length;

  while (i < n) {
    const c = src[i] as string;
    if (c === "\n") {
      line++;
      i++;
    } else if (c === " " || c === "\t" || c === "\r" || c === ",") {
      i++;
    } else if (c === "#") {
      let j = i;
      while (j < n && src[j] !== "\n" && src[j] !== "\r") j++;
      tokens.push({ type: "comment", value: src.slice(i, j).trimEnd(), line, endLine: line });
      i = j;
    } else if (c === '"' && src.startsWith('"""', i)) {
      let j = i + 3;
      let end = -1;
      while (j < n) {
        if (src.startsWith('\\"""', j)) j += 4;
        else if (src.startsWith('"""', j)) {
          end = j + 3;
          break;
        } else j++;
      }
      if (end === -1) throw new GraphqlSyntaxError(`The block string that starts on line ${line} is never closed. It needs a closing """.`, line);
      const value = src.slice(i, end);
      const lines = value.split("\n").length - 1;
      tokens.push({ type: "block", value, line, endLine: line + lines });
      line += lines;
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === "\n" || src[j] === "\r") throw new GraphqlSyntaxError(`The string on line ${line} is not closed. Strings must end on the same line (use """ for several lines).`, line);
        j += src[j] === "\\" ? 2 : 1;
      }
      if (j >= n) throw new GraphqlSyntaxError(`The string on line ${line} is never closed. It needs a closing ".`, line);
      tokens.push({ type: "string", value: src.slice(i, j + 1), line, endLine: line });
      i = j + 1;
    } else if (src.startsWith("...", i)) {
      tokens.push({ type: "punct", value: "...", line, endLine: line });
      i += 3;
    } else if (PUNCT.has(c)) {
      tokens.push({ type: "punct", value: c, line, endLine: line });
      i++;
    } else if (c === "-" || DIGIT.test(c)) {
      const m = /^-?(?:0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(src.slice(i, i + 400));
      if (!m) throw new GraphqlSyntaxError(`“${c}” on line ${line} is not part of a valid number.`, line);
      if (NAME_START.test(src[i + m[0].length] ?? "") || DIGIT.test(src[i + m[0].length] ?? "")) {
        throw new GraphqlSyntaxError(`The number “${m[0]}” on line ${line} runs straight into other characters. Put a space after it.`, line);
      }
      tokens.push({ type: m[1] || m[2] ? "float" : "int", value: m[0], line, endLine: line });
      i += m[0].length;
    } else if (NAME_START.test(c)) {
      let j = i + 1;
      while (j < n && NAME_PART.test(src[j] as string)) j++;
      tokens.push({ type: "name", value: src.slice(i, j), line, endLine: line });
      i = j;
    } else {
      throw new GraphqlSyntaxError(`Unexpected character “${c}” on line ${line}.`, line);
    }
  }
  return tokens;
}

const CLOSER: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Throws a readable error if brackets do not match. Returns, for every opening bracket, the index of its partner. */
function matchBrackets(tokens: GraphqlToken[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  tokens.forEach((t, i) => {
    if (t.type !== "punct") return;
    if (t.value in CLOSER) stack.push(i);
    else if (t.value === ")" || t.value === "]" || t.value === "}") {
      const open = stack.pop();
      if (open === undefined) throw new GraphqlSyntaxError(`There is a “${t.value}” on line ${t.line} with nothing to close.`, t.line);
      const opener = tokens[open] as GraphqlToken;
      if (CLOSER[opener.value] !== t.value) {
        throw new GraphqlSyntaxError(`The “${opener.value}” on line ${opener.line} is closed by “${t.value}” on line ${t.line}. Expected “${CLOSER[opener.value]}”.`, t.line);
      }
      pairs.set(open, i);
    }
  });
  const left = stack.pop();
  if (left !== undefined) {
    const opener = tokens[left] as GraphqlToken;
    throw new GraphqlSyntaxError(`The “${opener.value}” on line ${opener.line} is never closed. It needs a “${CLOSER[opener.value]}”.`, opener.line);
  }
  return pairs;
}

const DEFINITION_WORDS = new Set(["query", "mutation", "subscription", "fragment", "type", "interface", "union", "enum", "scalar", "input", "directive", "extend", "schema"]);
/** Tokens after which the next word continues the same definition instead of starting a new one. */
const CONTINUES = new Set(["=", "|", "&", "@", ":", "on", "implements", "extend", "repeatable"]);

const isWordy = (t: GraphqlToken) => t.type === "name" || t.type === "int" || t.type === "float";
const completesValue = (t: GraphqlToken) => t.type === "name" || t.type === "int" || t.type === "float" || t.type === "string" || t.type === "block" || t.value === "]" || t.value === "}" || t.value === ")" || t.value === "!";
const startsValue = (t: GraphqlToken) => t.type === "name" || t.type === "int" || t.type === "float" || t.type === "string" || t.type === "block" || t.value === "[" || t.value === "{" || t.value === "$";

/** Is there a space between two neighbours on one line? */
function spaceBetween(prev: GraphqlToken | null, cur: GraphqlToken): boolean {
  if (!prev) return false;
  const p = prev.type === "punct" ? prev.value : "";
  const c = cur.type === "punct" ? cur.value : "";
  if (c === ")" || c === "]" || c === ":" || c === "!") return false;
  if (p === "(" || p === "[" || p === "$" || p === "@") return false;
  if (c === "(") return false;
  if (p === "...") return c === "@" || c === "{" || (cur.type === "name" && cur.value === "on");
  if (c === "{") return true;
  if (c === "}") return p !== "{";
  if (p === "{") return true;
  return true;
}

/** One line for a group of tokens such as `(id: 1, name: "x")`. Commas are put back between neighbours. */
function flat(tokens: GraphqlToken[]): string {
  let out = "";
  let prev: GraphqlToken | null = null;
  tokens.forEach((t) => {
    if (prev) {
      if (completesValue(prev) && startsValue(t)) out += ", ";
      else if (spaceBetween(prev, t)) out += " ";
    }
    out += t.value;
    prev = t;
  });
  return out;
}

/** Split the inside of a group into top-level arguments (or list items). */
function splitArguments(inner: GraphqlToken[]): GraphqlToken[][] {
  const parts: GraphqlToken[][] = [];
  let depth = 0;
  let current: GraphqlToken[] = [];
  for (const t of inner) {
    if (t.type === "punct" && (t.value === "(" || t.value === "[" || t.value === "{")) depth++;
    if (t.type === "punct" && (t.value === ")" || t.value === "]" || t.value === "}")) depth--;
    const last = current[current.length - 1];
    const prevPrev = current[current.length - 2];
    const afterAt = last?.value === "@" || (last?.type === "name" && prevPrev?.value === "@");
    if (depth === 0 && last && completesValue(last) && startsValue(t) && !afterAt && t.value !== "[" && t.value !== "{") {
      parts.push(current);
      current = [];
    }
    current.push(t);
  }
  if (current.length) parts.push(current);
  return parts;
}

/** Re-indent a block string so its text lines up with the surrounding code. */
function blockLines(raw: string): string[] {
  const body = raw.slice(3, -3);
  if (!body.includes("\n")) return [raw];
  const lines = body.split(/\r?\n/);
  const sizes = lines.slice(1).filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length);
  const common = sizes.length ? Math.min(...sizes) : 0;
  const cleaned = lines.map((l, i) => (i === 0 ? l.trim() : l.slice(Math.min(common, /^[ \t]*/.exec(l)![0].length)).trimEnd()));
  while (cleaned.length && !cleaned[0]) cleaned.shift();
  while (cleaned.length && !cleaned[cleaned.length - 1]) cleaned.pop();
  return ['"""', ...cleaned, '"""'];
}

/** Lay out GraphQL source. Throws a `GraphqlSyntaxError` naming the line of the first problem. */
export function formatGraphql(source: string, options: GraphqlFormatOptions = {}): string {
  const { indent = 2, width = 80 } = options;
  const unit = indent === "tab" ? "\t" : " ".repeat(indent);
  const tokens = tokenizeGraphql(source);
  if (!tokens.some((t) => t.type !== "comment")) return tokens.map((t) => t.value).join("\n");
  const pairs = matchBrackets(tokens);

  const lines: string[] = [];
  let cur = "";
  let level = 0;
  /** Brackets we are inside: "block" is a selection set or a schema body. */
  const stack: "block"[] = [];
  let prev: GraphqlToken | null = null; // previous token that is not a comment
  let onLine: GraphqlToken | null = null; // previous token on the current output line
  let lastLine = 0; // source line where the last thing (token or comment) ended
  let pending = 0; // words that still belong to the current item (after ":", "@", "...", "=")
  let afterOwnLineComment = false;
  const pad = (l: number) => unit.repeat(l);

  const flush = () => {
    if (cur) {
      lines.push(pad(level) + cur);
      afterOwnLineComment = false;
    }
    cur = "";
    onLine = null;
  };
  const blank = () => {
    flush();
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
  };
  const put = (token: GraphqlToken, text = token.value) => {
    if (cur && spaceBetween(onLine, token)) cur += " ";
    cur += text;
    onLine = token;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as GraphqlToken;

    if (t.type === "comment") {
      if (cur && t.line === lastLine) {
        cur += ` ${t.value}`;
        flush();
      } else {
        flush();
        const gap = lastLine > 0 && t.line - lastLine > 1;
        const afterClose = stack.length === 0 && prev?.value === "}";
        if (lines.length && prev?.value !== "{" && (gap || afterClose) && lines[lines.length - 1] !== "") lines.push("");
        lines.push(pad(level) + t.value);
        afterOwnLineComment = true;
      }
      lastLine = t.endLine;
      continue;
    }

    const top = stack.length === 0;
    const inBlock = !top;
    const wasPending = pending > 0;
    let startsItem = false;
    let startsDefinition = false;

    if (top) {
      const continuing = wasPending || (prev !== null && (CONTINUES.has(prev.value) || prev.type === "string" || prev.type === "block"));
      if (t.type === "name" && DEFINITION_WORDS.has(t.value) && !continuing) startsDefinition = true;
      else if ((t.type === "string" || t.type === "block") && !continuing) startsDefinition = true;
      else if (t.value === "{" && (prev === null || prev.value === "}")) startsDefinition = true;
    } else if (!wasPending && (t.type === "name" || t.value === "..." || t.type === "string" || t.type === "block")) {
      startsItem = true;
    }

    if (startsDefinition) {
      if (afterOwnLineComment && !cur) afterOwnLineComment = false;
      else if (lines.length || cur) blank();
      level = 0;
    } else if (startsItem) {
      flush();
      const gap = prev !== null && prev.value !== "{" && t.line - lastLine > 1 && !afterOwnLineComment;
      if (gap && lines.length && lines[lines.length - 1] !== "") lines.push("");
    }

    // --- brackets and groups ---
    if (t.type === "punct" && t.value === "(") {
      const close = pairs.get(i) as number;
      const group = tokens.slice(i, close + 1);
      const hasComment = group.some((g) => g.type === "comment");
      const text = flat(group.filter((g) => g.type !== "comment"));
      if (!hasComment && pad(level).length + cur.length + text.length + 2 <= width) {
        cur += text;
        onLine = tokens[close] as GraphqlToken;
      } else {
        cur += "(";
        flush();
        level++;
        const inner = group.slice(1, -1);
        const parts: GraphqlToken[][] = [];
        let chunk: GraphqlToken[] = [];
        for (const g of inner) {
          if (g.type === "comment") {
            if (chunk.length) {
              parts.push(chunk);
              chunk = [];
            }
            parts.push([g]);
          } else chunk.push(g);
        }
        if (chunk.length) parts.push(chunk);
        for (const part of parts) {
          if (part[0]?.type === "comment") {
            lines.push(pad(level) + part[0].value);
            continue;
          }
          for (const arg of splitArguments(part)) lines.push(pad(level) + flat(arg));
        }
        level--;
        cur = ")";
        onLine = tokens[close] as GraphqlToken;
      }
      prev = tokens[close] as GraphqlToken;
      lastLine = (tokens[close] as GraphqlToken).endLine;
      i = close;
      continue;
    }

    if (t.type === "punct" && (t.value === "[" || (t.value === "{" && prev?.value === "="))) {
      const close = pairs.get(i) as number;
      put(t, flat(tokens.slice(i, close + 1).filter((g) => g.type !== "comment")));
      onLine = tokens[close] as GraphqlToken;
      if (wasPending) pending--;
      prev = tokens[close] as GraphqlToken;
      lastLine = (tokens[close] as GraphqlToken).endLine;
      i = close;
      continue;
    }

    if (t.type === "punct" && t.value === "{") {
      const close = pairs.get(i) as number;
      put(t);
      if (close === i + 1) {
        cur += "}";
        i = close;
        prev = tokens[close] as GraphqlToken;
        lastLine = (tokens[close] as GraphqlToken).endLine;
        onLine = prev;
        continue;
      }
      flush();
      level++;
      stack.push("block");
      pending = 0;
      prev = t;
      lastLine = t.endLine;
      continue;
    }

    if (t.type === "punct" && t.value === "}") {
      flush();
      level--;
      stack.pop();
      pending = 0;
      put(t);
      prev = t;
      lastLine = t.endLine;
      if (stack.length === 0) flush();
      continue;
    }

    // --- everything else ---
    if (t.type === "block") {
      const bl = blockLines(t.value);
      if (bl.length === 1) put(t);
      else {
        flush();
        for (const l of bl) lines.push(l ? pad(level) + l : l);
      }
      if (stack.length || top) pending = Math.max(0, pending - (wasPending ? 1 : 0));
      if (bl.length > 1) {
        onLine = null;
        // A description sits on its own lines; what it describes starts on the next line.
        if (!wasPending) flush();
      } else if (!wasPending && (inBlock || top)) flush();
      prev = t;
      lastLine = t.endLine;
      continue;
    }

    if (t.type === "string" && !wasPending && (inBlock || top) && prev?.value !== "=") {
      put(t);
      flush();
      prev = t;
      lastLine = t.endLine;
      continue;
    }

    put(t);
    if (wasPending) pending--;
    if (t.type === "punct" && (t.value === ":" || t.value === "=" || t.value === "@")) pending = 1;
    else if (t.value === "...") {
      const next = tokens.slice(i + 1).find((g) => g.type !== "comment");
      pending = next?.type === "name" ? (next.value === "on" ? 2 : 1) : 0;
    }
    prev = t;
    lastLine = t.endLine;
  }
  flush();
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/** Remove comments and every space that is not needed. */
export function minifyGraphql(source: string): string {
  const tokens = tokenizeGraphql(source).filter((t) => t.type !== "comment");
  matchBrackets(tokens);
  let out = "";
  let prev: GraphqlToken | null = null;
  for (const t of tokens) {
    const value = t.type === "block" ? `"""${blockLines(t.value).slice(1, -1).join("\n") || t.value.slice(3, -3).trim()}"""` : t.value;
    if (prev && ((isWordy(prev) && isWordy(t)) || (prev.type === "string" && t.type === "string"))) out += " ";
    out += value;
    prev = t;
  }
  return out;
}
