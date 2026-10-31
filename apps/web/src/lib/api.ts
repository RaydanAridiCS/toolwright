import { ServiceError, classifyDatabaseError } from "@toolwright/db";

export const TOKEN_HEADER = "x-tw-token";
const MAX_BODY_BYTES = 10_000;

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ServiceError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    return json(body, { status: err.status });
  }
  // A database we cannot reach or that has no tables yet is an outage to wait out, not a bug in the request.
  const problem = classifyDatabaseError(err);
  if (problem !== "error") {
    console.error(`Request board database problem (${problem}). Check /api/health and docs/maintainers.md.`, err);
    const body: ApiErrorBody = { error: { code: "unavailable", message: "The request board is taking a break. Please try again in a few minutes." } };
    return json(body, { status: 503, headers: { "Retry-After": "60" } });
  }
  console.error("Unhandled API error", err);
  const body: ApiErrorBody = { error: { code: "internal", message: "Something went wrong on our side. Please try again." } };
  return json(body, { status: 500 });
}

/** Parse a small JSON body, rejecting oversized or malformed payloads. */
export async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new ServiceError("invalid", "That request is too large.", 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ServiceError("invalid", "That request is too large.", 413);
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ServiceError("invalid", "The request body is not valid JSON.", 400);
  }
}

export function tokenFrom(request: Request): string | undefined {
  return request.headers.get(TOKEN_HEADER) ?? undefined;
}
