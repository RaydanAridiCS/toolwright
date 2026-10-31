// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "../src/app/api/health/route";
import { GET as list } from "../src/app/api/requests/route";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Nothing listens on port 1, so a connection attempt fails at once with ECONNREFUSED.
const DEAD_DATABASE = "postgres://user:hunter2@127.0.0.1:1/toolwright";

beforeEach(() => {
  delete (globalThis as { __toolwrightRequests?: unknown }).__toolwrightRequests;
  delete process.env.DATABASE_URL;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.DATABASE_URL;
  delete (globalThis as { __toolwrightRequests?: unknown }).__toolwrightRequests;
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("is healthy in demo mode and says the board is not persistent", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, database: { mode: "memory", state: "ok", persistent: false } });
  });

  it("answers 503 and names the problem when the database cannot be reached, without leaking the connection string", async () => {
    process.env.DATABASE_URL = DEAD_DATABASE;
    const res = await health();
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, database: { mode: "postgres", state: "unreachable", persistent: true } });
    expect(text).not.toMatch(/hunter2|127\.0\.0\.1|user/);
  });
});

describe("a database outage on the request board", () => {
  it("is a 503 the page can explain and retry, not a 500", async () => {
    process.env.DATABASE_URL = DEAD_DATABASE;
    const res = await list(new Request("http://localhost/api/requests"));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    const body = (await res.json()) as Json;
    expect(body.error.code).toBe("unavailable");
    expect(body.error.message).toMatch(/try again/i);
    expect(JSON.stringify(body)).not.toMatch(/hunter2|127\.0\.0\.1|ECONNREFUSED/);
  });
});
