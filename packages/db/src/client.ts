import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DrizzleToolRequestRepository } from "./drizzle-repository";
import { InMemoryToolRequestRepository } from "./memory-repository";
import type { ToolRequestRepository } from "./repository";
import { RequestService } from "./service";
import * as schema from "./schema";

export function createDatabase(connectionString: string) {
  // One connection per serverless instance keeps connection counts low on pooled Postgres.
  // The connect timeout makes an unreachable database fail in seconds, so visitors see an error instead of a hung page.
  const client = postgres(connectionString, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

const SEED = [
  { title: "Image background remover", description: "Remove backgrounds in the browser using a local model." },
  { title: "JSON diff and merge", description: "Compare two JSON documents semantically, ignoring key order." },
  { title: "Audio trimmer and converter", description: "Cut and convert MP3/WAV without uploading." },
];

type Globals = typeof globalThis & { __toolwrightRequests?: RequestService };

/**
 * Returns the shared service. Uses Postgres when DATABASE_URL is set; otherwise an in-memory
 * store (seeded with a few ideas) so the board still works in local development.
 */
export async function getRequestService(env: Record<string, string | undefined> = process.env): Promise<RequestService> {
  const g = globalThis as Globals;
  if (g.__toolwrightRequests) return g.__toolwrightRequests;
  let repo: ToolRequestRepository;
  if (env.DATABASE_URL) {
    repo = new DrizzleToolRequestRepository(createDatabase(env.DATABASE_URL).db);
  } else {
    const memory = new InMemoryToolRequestRepository();
    for (const s of SEED) await memory.create({ ...s, creatorHash: "seed".padEnd(64, "0") });
    repo = memory;
  }
  g.__toolwrightRequests = new RequestService(repo);
  return g.__toolwrightRequests;
}
