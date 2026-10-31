# Tool request board

The request board (`/requests`) lets visitors suggest tools and vote on ideas. It is the only feature with a server-side data store, so it is deliberately small and privacy-preserving.

## Behaviour

- Anyone can submit an idea (title 4–120 characters, optional description up to 1,000) and vote once per idea.
- No account. The browser creates a random token (`tw-token` in `localStorage`); the server stores only a **SHA-256 hash** of it, with separate hashes for "creator" and "voter" roles.
- Duplicate titles (case- and whitespace-insensitive) are rejected with a pointer to the existing idea.
- Each browser token may create **3 ideas per 24 hours**. Titles containing links are rejected. A hidden **honeypot** field catches simple bots.
- A creator's own idea starts with their vote.
- Statuses: `open`, `planned`, `building`, `shipped`, `declined`. Maintainers change status directly in the database (or via `RequestService.setStatus`). The board can be filtered to Open, Planned, In progress or Shipped, so visitors can see what got built.
- Ideas can also be added from the home page: the "Tool 111 is yours to name" ticket sends a real idea (4 characters or more) straight to this API and confirms it in place. With an empty or too-short field it just opens the board. If the server cannot take the idea, the ticket keeps what was typed and links to the board with it prefilled.
- If the database is down the board says so calmly with a *Try again* button (see `unavailable` below), and the rest of the site keeps working.

## HTTP API

All endpoints return JSON with `Cache-Control: no-store`. The browser token is sent in the `x-tw-token` header.

### `GET /api/requests`

Query: `sort=top|new` (default `top`), `status=open|planned|…`, `limit` (1–100, default 50), `offset`.

```json
{
  "persistent": true,
  "requests": [
    { "id": "…", "title": "Image background remover", "description": "…", "status": "open",
      "createdAt": "2026-10-19T12:00:00.000Z", "votes": 12, "hasVoted": false }
  ]
}
```

`hasVoted` is computed for the calling token. `persistent: false` means the in-memory fallback is in use (the UI shows a "demo mode" notice).

### `POST /api/requests`

Body: `{ "title": string, "description"?: string, "website"?: "" }` (the `website` honeypot must be empty or absent). Returns `201` with `{ "request": { … } }`.

### `POST /api/requests/:id/vote` and `DELETE /api/requests/:id/vote`

Add or remove the caller's vote. Both are idempotent and return `{ "votes": number, "hasVoted": boolean }`.

### Errors

```json
{ "error": { "code": "duplicate", "message": "Someone already suggested this…", "details": { "existingId": "…" } } }
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| `invalid` | 400 / 413 | Validation failed, body not JSON, or too large (> 10 KB) |
| `duplicate` | 409 | Same normalized title already exists |
| `rate_limited` | 429 | Too many new ideas from this browser in 24 h |
| `not_found` | 404 | Unknown request id |
| `unavailable` | 503 | The database cannot be reached or has no tables yet. Sent with `Retry-After: 60`. The cause is logged (`Request board database problem (...)`), never returned |
| `internal` | 500 | Unexpected error (details are logged, not returned) |

### `GET /api/health`

For deploy checks and uptime monitors (`npm run check:deploy` reads it). It never contains a connection string, host or error text.

```json
{ "ok": true, "database": { "mode": "postgres", "state": "ok", "persistent": true } }
```

`mode` is `memory` when `DATABASE_URL` is unset, `postgres` otherwise. `state` is `ok`, `unreachable`, `rejected`, `not_migrated` or `error`. The status is 200 when `ok` is true and 503 otherwise. What each state means and how to fix it is in [maintainers.md](maintainers.md#the-request-boards-database).

## Data model

Defined in `packages/db/src/schema.ts` (Drizzle, Postgres):

```
tool_requests
  id             uuid  PK default gen_random_uuid()
  title          varchar(120)
  normalized_title varchar(120) UNIQUE
  description    text
  status         request_status enum  default 'open'
  creator_hash   char(64)             -- sha256("toolwright:creator:" + token)
  created_at     timestamptz default now()

tool_request_votes
  request_id     uuid  FK → tool_requests(id) ON DELETE CASCADE
  voter_hash     char(64)             -- sha256("toolwright:voter:" + token)
  created_at     timestamptz default now()
  PK (request_id, voter_hash)
```

Vote counts are computed with a subquery, so there is no counter to drift out of sync, and the composite primary key makes duplicate votes impossible at the database level.

## Architecture

```
API route ──► RequestService ──► ToolRequestRepository (interface)
 (thin)        validation,        ├─ DrizzleToolRequestRepository  (Postgres)
               hashing,           └─ InMemoryToolRequestRepository (dev / tests)
               rate limiting
```

Routes only translate HTTP ⇄ service calls and map `ServiceError` to status codes. Swapping storage means implementing `ToolRequestRepository` and running the shared contract tests (`packages/db/tests/repository.test.ts`).

## Working on it

```bash
# change packages/db/src/schema.ts, then:
npm run db:generate            # writes a new SQL migration into packages/db/drizzle
npm test -- --project db       # contract tests apply every migration to a real in-process Postgres

# apply migrations to a real database
DATABASE_URL=postgres://… npm run db:migrate
```

Set `DATABASE_URL` in `apps/web/.env.local` to use Postgres locally; leave it unset for the in-memory store.
