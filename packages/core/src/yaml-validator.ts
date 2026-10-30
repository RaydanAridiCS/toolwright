/**
 * Validate YAML and point out the classic traps. Parsing is done by js-yaml with its default (safe) schema, so no
 * tags can run code. Keep this file free of React, the DOM and the network.
 */
import yaml from "js-yaml";

export type YamlSeverity = "error" | "warning" | "info";

export interface YamlIssue {
  /** Line, counting from 1. */
  line: number;
  /** Column, counting from 1 (0 when the issue concerns the whole line). */
  column: number;
  severity: YamlSeverity;
  rule: string;
  message: string;
}

export interface YamlReport {
  valid: boolean;
  /** Number of documents (separated by ---). */
  documents: number;
  issues: YamlIssue[];
  /** The parsed content as JSON, when it is valid and small enough to show. */
  json?: string;
  /** What the first document is: mapping, list or a single value. */
  kind?: "mapping" | "list" | "value" | "empty";
}

const JSON_LIMIT = 1_000_000;

class TooBig extends Error {}

/** JSON.stringify with a size cap, so a document full of aliases cannot be expanded without limit. */
function boundedJson(value: unknown, indent: number): string {
  let size = 0;
  const seen = new Set<object>();
  const walk = (v: unknown, depth: number): string => {
    let out: string;
    if (v === null || v === undefined) out = "null";
    else if (typeof v === "string") out = JSON.stringify(v);
    else if (typeof v === "number") out = Number.isFinite(v) ? String(v) : JSON.stringify(String(v));
    else if (typeof v === "boolean") out = String(v);
    else if (v instanceof Date) out = JSON.stringify(v.toISOString());
    else if (typeof v === "object") {
      if (seen.has(v as object)) throw new Error("The document refers to itself.");
      seen.add(v as object);
      const pad = " ".repeat(indent * (depth + 1));
      const close = " ".repeat(indent * depth);
      if (Array.isArray(v)) out = v.length ? `[\n${v.map((x) => pad + walk(x, depth + 1)).join(",\n")}\n${close}]` : "[]";
      else {
        const entries = Object.entries(v as Record<string, unknown>);
        out = entries.length ? `{\n${entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${walk(x, depth + 1)}`).join(",\n")}\n${close}}` : "{}";
      }
      seen.delete(v as object);
    } else out = JSON.stringify(String(v));
    size += out.length;
    if (size > JSON_LIMIT * 4) throw new TooBig();
    return out;
  };
  const result = walk(value, 0);
  if (result.length > JSON_LIMIT) throw new TooBig();
  return result;
}

const TRUTHY = /^(y|n|yes|no|on|off)$/i;
const BLOCK_START = /[:-]\s+[|>][+-]?\d*\s*(#.*)?$/;
const indentOf = (line: string) => /^ */.exec(line)![0].length;

/** Remove a trailing comment from a plain value, if the `#` is clearly a comment. */
const stripComment = (v: string) => v.replace(/\s+#.*$/, "").trim();

/** Checks that need the text, not the parsed result. Lines inside block scalars are skipped. */
function lintText(text: string): YamlIssue[] {
  const issues: YamlIssue[] = [];
  const lines = text.split(/\r?\n/);
  let blockIndent = -1;
  let trailing = 0;

  lines.forEach((line, i) => {
    const n = i + 1;
    if (blockIndent >= 0) {
      if (!line.trim() || indentOf(line) > blockIndent) return;
      blockIndent = -1;
    }
    if (BLOCK_START.test(line)) blockIndent = indentOf(line);

    if (/[ \t]+$/.test(line) && line.trim()) {
      trailing++;
      if (trailing <= 5) issues.push({ line: n, column: 0, severity: "info", rule: "Y001", message: "Trailing spaces at the end of the line." });
    }
    if (line.length > 160) issues.push({ line: n, column: 161, severity: "info", rule: "Y002", message: `The line is ${line.length} characters long. Long lines are hard to review.` });

    const body = line.replace(/^\s*-\s+/, "").trimStart();
    const m = /^(?:[^\s#'"][^:#]*|"[^"]*"|'[^']*'):\s+(\S.*)$/.exec(body) ?? (/^\s*-\s+(\S.*)$/.exec(line) as RegExpExecArray | null);
    if (!m) return;
    const value = stripComment(m[1] as string);
    const column = line.indexOf(m[1] as string) + 1;
    if (/^["'[{|>&*!]/.test(value)) return;
    if (TRUTHY.test(value)) {
      issues.push({ line: n, column, severity: "warning", rule: "Y003", message: `“${value}” is a boolean in YAML 1.1 (used by PyYAML, Ansible and many others) but a string in YAML 1.2. Quote it ("${value}") or use true or false.` });
    } else if (/^0\d+$/.test(value)) {
      issues.push({ line: n, column, severity: "warning", rule: "Y004", message: `“${value}” starts with 0, so some parsers read it as an octal number (${parseInt(value, 8) || "invalid"}). Quote it if it is an identifier such as a code or mode.` });
    } else if (/^\d+\.\d*0$/.test(value) && /version|release|tag|python|node|ruby|java|go|php/i.test(body.split(":")[0] ?? "")) {
      issues.push({ line: n, column, severity: "info", rule: "Y005", message: `${value} is read as the number ${Number(value)}, which drops the trailing zero. Quote it ("${value}") if it is a version.` });
    }
  });

  if (trailing > 5) issues.push({ line: 0, column: 0, severity: "info", rule: "Y001", message: `${trailing - 5} more lines have trailing spaces.` });
  if (text.length > 0 && !text.endsWith("\n")) issues.push({ line: lines.length, column: 0, severity: "info", rule: "Y006", message: "The file does not end with a newline." });
  return issues;
}

/** Parse and check YAML text. */
export function validateYaml(text: string): YamlReport {
  if (!text.trim()) return { valid: true, documents: 0, issues: [], kind: "empty" };
  let docs: unknown[];
  try {
    docs = yaml.loadAll(text);
  } catch (err) {
    const e = err as { reason?: string; message?: string; mark?: { line: number; column: number } };
    const reason = (e.reason ?? e.message ?? "The YAML could not be read.").replace(/\s*\(\d+:\d+\)\s*$/, "");
    return {
      valid: false,
      documents: 0,
      issues: [{ line: (e.mark?.line ?? 0) + 1, column: (e.mark?.column ?? 0) + 1, severity: "error", rule: "Y000", message: reason.charAt(0).toUpperCase() + reason.slice(1) + "." }],
    };
  }
  const first = docs[0];
  const kind = Array.isArray(first) ? "list" : first !== null && typeof first === "object" ? "mapping" : first === undefined || first === null ? "empty" : "value";
  const report: YamlReport = { valid: true, documents: docs.length, issues: lintText(text), kind };
  try {
    report.json = boundedJson(docs.length === 1 ? docs[0] : docs, 2);
  } catch (err) {
    report.issues.push({ line: 0, column: 0, severity: "info", rule: "Y007", message: err instanceof TooBig ? "The JSON view is hidden because it would be very large." : (err as Error).message });
  }
  return report;
}
