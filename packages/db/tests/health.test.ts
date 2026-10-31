import { describe, expect, it } from "vitest";
import { checkDatabase, classifyDatabaseError } from "../src";

/** An error shaped like the ones postgres-js and Node produce. */
const withCode = (code: string, extra: object = {}) => Object.assign(new Error(code), { code, ...extra });

describe("classifyDatabaseError", () => {
  it("recognises a database that cannot be reached", () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "57P03", "53300", "08006"]) {
      expect(classifyDatabaseError(withCode(code)), code).toBe("unreachable");
    }
  });

  it("recognises credentials, database names and SSL settings the server rejected", () => {
    for (const code of ["28P01", "28000", "3D000"]) expect(classifyDatabaseError(withCode(code)), code).toBe("rejected");
  });

  it("recognises tables that have not been migrated yet", () => {
    expect(classifyDatabaseError(withCode("42P01"))).toBe("not_migrated");
  });

  it("looks inside Drizzle's wrapper error and Node's list of failed attempts", () => {
    expect(classifyDatabaseError(new Error("Failed query", { cause: withCode("42P01") }))).toBe("not_migrated");
    expect(classifyDatabaseError(Object.assign(new Error("all attempts failed"), { errors: [withCode("ECONNREFUSED"), withCode("ECONNREFUSED")] }))).toBe("unreachable");
  });

  it("calls anything else an error, and copes with values that are not errors", () => {
    expect(classifyDatabaseError(new Error("boom"))).toBe("error");
    expect(classifyDatabaseError(withCode("23505"))).toBe("error");
    for (const odd of [null, undefined, "text", 42]) expect(classifyDatabaseError(odd)).toBe("error");
  });

  it("does not loop forever on an error that wraps itself", () => {
    const loop = new Error("loop") as Error & { cause?: unknown };
    loop.cause = loop;
    expect(classifyDatabaseError(loop)).toBe("error");
  });
});

describe("checkDatabase", () => {
  it("reports the in-memory store as healthy but not persistent", async () => {
    expect(await checkDatabase({})).toEqual({ mode: "memory", state: "ok" });
  });

  it("reports a database nothing is listening on as unreachable, without throwing", async () => {
    expect(await checkDatabase({ DATABASE_URL: "postgres://user:secret@127.0.0.1:1/toolwright" })).toEqual({ mode: "postgres", state: "unreachable" });
  });

  it("never puts the connection string in what it returns", async () => {
    const status = await checkDatabase({ DATABASE_URL: "postgres://user:hunter2@127.0.0.1:1/toolwright" });
    expect(JSON.stringify(status)).not.toMatch(/hunter2|127\.0\.0\.1|user/);
  });
});
