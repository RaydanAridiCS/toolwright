import { z } from "zod";
import { DuplicateRequestError, type ListOptions, type RequestStatus, type ToolRequest, type ToolRequestRepository } from "./repository";

/** Domain rules for the request board: validation, anonymous identity and rate limiting. */

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

// zod's default message for a missing field is "expected string, received undefined": say something human instead.
const TOKEN_MESSAGE = "Missing or invalid browser token.";

export const createRequestSchema = z.object({
  title: z
    .string({ error: "Give your idea a short title (at least 4 characters)." })
    .trim()
    .min(4, "Give your idea a short title (at least 4 characters).")
    .max(120, "Keep the title under 120 characters.")
    .refine((v) => !/https?:\/\//i.test(v), "Please leave links out of the title."),
  description: z.string({ error: "The description must be text." }).trim().max(1000, "Keep the description under 1,000 characters.").default(""),
  token: z.string({ error: TOKEN_MESSAGE }).regex(TOKEN_PATTERN, TOKEN_MESSAGE),
  /** Honeypot: real users never fill this in. */
  website: z.string().max(0).optional(),
});

export const voteSchema = z.object({ token: z.string({ error: TOKEN_MESSAGE }).regex(TOKEN_PATTERN, TOKEN_MESSAGE) });

export type CreateRequestInput = z.input<typeof createRequestSchema>;

export class ServiceError extends Error {
  constructor(
    readonly code: "invalid" | "duplicate" | "rate_limited" | "not_found" | "unavailable",
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** SHA-256 hex digest of the anonymous browser token. The raw token is never stored. */
export async function hashToken(token: string, purpose: "creator" | "voter"): Promise<string> {
  const data = new TextEncoder().encode(`toolwright:${purpose}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ServiceOptions {
  /** Maximum new requests per browser token within the window. */
  maxCreatesPerWindow?: number;
  windowMs?: number;
  now?: () => Date;
}

export class RequestService {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly repo: ToolRequestRepository,
    options: ServiceOptions = {},
  ) {
    this.max = options.maxCreatesPerWindow ?? 3;
    this.windowMs = options.windowMs ?? 24 * 60 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
  }

  get persistent(): boolean {
    return this.repo.persistent;
  }

  async list(options: Omit<ListOptions, "voterHash"> & { token?: string } = {}): Promise<ToolRequest[]> {
    const { token, ...rest } = options;
    const voterHash = token && TOKEN_PATTERN.test(token) ? await hashToken(token, "voter") : undefined;
    return this.repo.list({ ...rest, limit: Math.min(rest.limit ?? 50, 100), voterHash });
  }

  async create(input: unknown): Promise<ToolRequest> {
    const parsed = createRequestSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError("invalid", parsed.error.issues[0]?.message ?? "Invalid request.", 400, { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    const { title, description, token } = parsed.data;
    const creatorHash = await hashToken(token, "creator");
    const since = new Date(this.now().getTime() - this.windowMs);
    if ((await this.repo.countCreatedSince(creatorHash, since)) >= this.max) {
      throw new ServiceError("rate_limited", `You can suggest up to ${this.max} tools per day. Vote on existing ideas in the meantime.`, 429);
    }
    try {
      const created = await this.repo.create({ title, description, creatorHash });
      // The creator's own idea starts with their vote.
      await this.repo.vote(created.id, await hashToken(token, "voter"));
      return (await this.repo.getById(created.id, await hashToken(token, "voter"))) ?? created;
    } catch (err) {
      if (err instanceof DuplicateRequestError) throw new ServiceError("duplicate", "Someone already suggested this. Find it in the list and give it a vote!", 409, { existingId: err.existingId });
      throw err;
    }
  }

  async vote(requestId: string, input: unknown, remove = false): Promise<{ votes: number; hasVoted: boolean }> {
    const parsed = voteSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError("invalid", parsed.error.issues[0]?.message ?? "Invalid vote.", 400);
    const voterHash = await hashToken(parsed.data.token, "voter");
    const result = remove ? await this.repo.unvote(requestId, voterHash) : await this.repo.vote(requestId, voterHash);
    if (!result) throw new ServiceError("not_found", "That request no longer exists.", 404);
    return { votes: result.votes, hasVoted: !remove };
  }

  /** For maintainers: change a request's status. */
  async setStatus(id: string, status: RequestStatus): Promise<void> {
    if (!(await this.repo.setStatus(id, status))) throw new ServiceError("not_found", "That request does not exist.", 404);
  }
}
