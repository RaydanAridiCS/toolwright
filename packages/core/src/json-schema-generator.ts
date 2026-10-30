/** Infer a JSON Schema from a sample document. Keep this file free of React, the DOM and the network. */
import { JsonSyntaxError, parseJson } from "./json";

export type SchemaDraft = "2020-12" | "2019-09" | "draft-07";

export interface JsonSchemaOptions {
  /** Which draft the `$schema` keyword names. The generated keywords are valid in all three. */
  draft?: SchemaDraft;
  /** List keys that appear in every sample under `required`. */
  markRequired?: boolean;
  /** Add `format` (date, email, uuid…) when every sample string looks like one. */
  detectFormats?: boolean;
  /** Forbid keys that are not listed. */
  noAdditionalProperties?: boolean;
}

const DRAFT_URI: Record<SchemaDraft, string> = {
  "2020-12": "https://json-schema.org/draft/2020-12/schema",
  "2019-09": "https://json-schema.org/draft/2019-09/schema",
  "draft-07": "http://json-schema.org/draft-07/schema#",
};

type Shape =
  | { kind: "null" | "boolean" | "integer" | "number" }
  | { kind: "string"; format?: string }
  | { kind: "array"; item: Shape | null }
  | { kind: "object"; props: Map<string, { shape: Shape; count: number }>; total: number }
  | { kind: "union"; members: Shape[] };

/** Strings longer than this are never checked against format patterns. */
const MAX_FORMAT_LENGTH = 256;
const FORMATS: [string, RegExp][] = [
  ["date-time", /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2})$/],
  ["date", /^\d{4}-\d{2}-\d{2}$/],
  ["uuid", /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/],
  ["email", /^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/],
  ["uri", /^https?:\/\/[^\s/?#]+[^\s]*$/],
  ["ipv4", /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/],
];

function formatOf(s: string): string | undefined {
  if (s.length > MAX_FORMAT_LENGTH) return undefined;
  return FORMATS.find(([, re]) => re.test(s))?.[0];
}

function infer(value: unknown, detectFormats: boolean): Shape {
  if (value === null) return { kind: "null" };
  if (Array.isArray(value)) {
    let item: Shape | null = null;
    for (const v of value) {
      const shape = infer(v, detectFormats);
      item = item ? merge(item, shape) : shape;
    }
    return { kind: "array", item };
  }
  switch (typeof value) {
    case "boolean":
      return { kind: "boolean" };
    case "number":
      return { kind: Number.isInteger(value) ? "integer" : "number" };
    case "string": {
      const format = detectFormats ? formatOf(value) : undefined;
      return format ? { kind: "string", format } : { kind: "string" };
    }
    default: {
      const props = new Map<string, { shape: Shape; count: number }>();
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) props.set(key, { shape: infer(v, detectFormats), count: 1 });
      return { kind: "object", props, total: 1 };
    }
  }
}

/** integer and number are one family: a mix of both is just "number". */
const family = (s: Shape) => (s.kind === "integer" ? "number" : s.kind);

/** Combine two shapes seen in the same position. Strings only keep a format both agree on. */
function merge(a: Shape, b: Shape): Shape {
  if (a.kind === "union" || b.kind === "union") {
    const members: Shape[] = [];
    for (const s of [...(a.kind === "union" ? a.members : [a]), ...(b.kind === "union" ? b.members : [b])]) {
      const at = members.findIndex((m) => family(m) === family(s));
      if (at === -1) members.push(s);
      else members[at] = merge(members[at] as Shape, s);
    }
    return members.length === 1 ? (members[0] as Shape) : { kind: "union", members };
  }
  if (family(a) !== family(b)) return { kind: "union", members: [a, b] };
  if (a.kind === "string" && b.kind === "string") return a.format && a.format === b.format ? a : { kind: "string" };
  if (a.kind === "array" && b.kind === "array") return { kind: "array", item: a.item && b.item ? merge(a.item, b.item) : (a.item ?? b.item) };
  if (a.kind === "object" && b.kind === "object") {
    const props = new Map(a.props);
    for (const [key, entry] of b.props) {
      const seen = props.get(key);
      props.set(key, seen ? { shape: merge(seen.shape, entry.shape), count: seen.count + entry.count } : entry);
    }
    return { kind: "object", props, total: a.total + b.total };
  }
  // Same simple type, or integer + number.
  return a.kind === "number" || b.kind === "number" ? { kind: "number" } : a;
}

type Schema = Record<string, unknown>;

function render(shape: Shape, o: Required<Omit<JsonSchemaOptions, "draft">>): Schema {
  switch (shape.kind) {
    case "string":
      return shape.format ? { type: "string", format: shape.format } : { type: "string" };
    case "array":
      return shape.item ? { type: "array", items: render(shape.item, o) } : { type: "array" };
    case "object": {
      const schema: Schema = { type: "object" };
      if (shape.props.size) {
        // fromEntries creates own properties, so a key named "__proto__" stays a key.
        schema.properties = Object.fromEntries([...shape.props].map(([key, { shape: s }]) => [key, render(s, o)]));
        const required = [...shape.props].filter(([, { count }]) => count === shape.total).map(([key]) => key);
        if (o.markRequired && required.length) schema.required = required;
      }
      if (o.noAdditionalProperties) schema.additionalProperties = false;
      return schema;
    }
    case "union": {
      const plain = shape.members.every((m) => m.kind !== "array" && m.kind !== "object" && !(m.kind === "string" && m.format));
      return plain ? { type: shape.members.map((m) => m.kind) } : { anyOf: shape.members.map((m) => render(m, o)) };
    }
    default:
      return { type: shape.kind };
  }
}

/** Build a JSON Schema from a sample document. Arrays are merged so keys missing from some items become optional. */
export function jsonToSchema(text: string, options: JsonSchemaOptions = {}): string {
  const { draft = "2020-12", markRequired = true, detectFormats = true, noAdditionalProperties = false } = options;
  if (!text.trim()) throw new Error("Paste a JSON sample to build a schema from.");
  const parsed = parseJson(text);
  if (!parsed.ok) throw new JsonSyntaxError(parsed.error);

  let schema: Schema;
  try {
    schema = render(infer(parsed.value, detectFormats), { markRequired, detectFormats, noAdditionalProperties });
  } catch (err) {
    if (err instanceof RangeError) throw new Error("This sample is nested too deeply to analyse.");
    throw err;
  }
  return JSON.stringify({ $schema: DRAFT_URI[draft], ...schema }, null, 2);
}
