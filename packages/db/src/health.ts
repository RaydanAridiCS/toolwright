import postgres from "postgres";

/**
 * What is wrong with the request board's database, in words a deploy checklist can act on.
 * Never contains the connection string, host or any other secret, so it is safe to return from /api/health.
 */
export type DatabaseProblem = "unreachable" | "rejected" | "not_migrated" | "error";
export type DatabaseState = "ok" | DatabaseProblem;

export interface DatabaseStatus {
  /** `memory` when DATABASE_URL is unset: ideas live in the server's memory and reset on restart. */
  mode: "memory" | "postgres";
  state: DatabaseState;
}

// Node and postgres.js connection errors: the server could not be reached, or the connection dropped.
const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "57P03", // the database is starting up
  "53300", // too many connections
]);

// Postgres refused us: wrong password, wrong database name, or SSL required (usually fixed with ?sslmode=require).
const REJECTED_CODES = new Set(["28P01", "28000", "3D000"]);

/** The error and everything it wraps: Drizzle puts the Postgres error in `cause`, Node puts several attempts in `errors`. */
function* chain(err: unknown, depth = 0): Generator<unknown> {
  if (!err || typeof err !== "object" || depth > 5) return;
  yield err;
  yield* chain((err as { cause?: unknown }).cause, depth + 1);
  const many = (err as { errors?: unknown }).errors;
  if (Array.isArray(many)) for (const e of many) yield* chain(e, depth + 1);
}

/** Sorts a database failure into one of the problems above. "error" means we do not recognise it. */
export function classifyDatabaseError(err: unknown): DatabaseProblem {
  for (const e of chain(err)) {
    const code = String((e as { code?: unknown }).code ?? "");
    if (code === "42P01") return "not_migrated"; // undefined_table
    if (REJECTED_CODES.has(code)) return "rejected";
    if (UNREACHABLE_CODES.has(code) || code.startsWith("08")) return "unreachable";
  }
  return "error";
}

/** Connects once and reads both tables. Used by /api/health; it never throws. */
export async function checkDatabase(env: Record<string, string | undefined> = process.env): Promise<DatabaseStatus> {
  if (!env.DATABASE_URL) return { mode: "memory", state: "ok" };
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 1 });
  try {
    await sql`select 1 from tool_requests limit 1`;
    await sql`select 1 from tool_request_votes limit 1`;
    return { mode: "postgres", state: "ok" };
  } catch (err) {
    return { mode: "postgres", state: classifyDatabaseError(err) };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}
