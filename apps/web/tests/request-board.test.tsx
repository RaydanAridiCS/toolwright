import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getToken, requestsApi, type RequestItem } from "../src/lib/request-client";
import { RequestBoard } from "../src/components/request-board";

const item = (over: Partial<RequestItem> = {}): RequestItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Image background remover",
  description: "Remove backgrounds locally.",
  status: "open",
  createdAt: "2026-10-01T00:00:00.000Z",
  votes: 3,
  hasVoted: false,
  ...over,
});

type Handler = (url: string, init: RequestInit) => { status?: number; body: unknown };

function mockFetch(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const { status = 200, body } = handler(url, init);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("browser token", () => {
  it("is created once, well-formed, and reused", () => {
    const first = getToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(getToken()).toBe(first);
    expect(window.localStorage.getItem("tw-token")).toBe(first);
  });

  it("replaces a corrupted stored token", () => {
    window.localStorage.setItem("tw-token", "bad token!!");
    expect(getToken()).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("falls back to a per-page token when storage is blocked", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const token = getToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(getToken()).toBe(token);
    get.mockRestore();
  });
});

describe("requestsApi", () => {
  it("sends the token header and no cookies", async () => {
    const calls = mockFetch(() => ({ body: { requests: [], persistent: true } }));
    await requestsApi.list("new", "planned");
    expect(calls[0]!.url).toBe("/api/requests?sort=new&status=planned");
    expect((calls[0]!.init.headers as Record<string, string>)["x-tw-token"]).toBe(getToken());
    expect(calls[0]!.init.credentials).toBeUndefined();
  });

  it("uses POST to vote and DELETE to un-vote", async () => {
    const calls = mockFetch(() => ({ body: { votes: 1, hasVoted: true } }));
    await requestsApi.vote("abc");
    await requestsApi.unvote("abc");
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual(["POST /api/requests/abc/vote", "DELETE /api/requests/abc/vote"]);
  });

  it("turns API errors into ApiError with the server's message", async () => {
    mockFetch(() => ({ status: 409, body: { error: { code: "duplicate", message: "Already there", details: { existingId: "x" } } } }));
    const err = await requestsApi.create({ title: "Hello", description: "" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "duplicate", status: 409, message: "Already there", details: { existingId: "x" } });
  });

  it("copes with non-JSON error responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    await expect(requestsApi.list("top")).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/try again/i) });
  });
});

describe("RequestBoard", () => {
  it("lists ideas, explains demo mode, and shows empty and loading states", async () => {
    mockFetch(() => ({ body: { requests: [item(), item({ id: "2", title: "JSON diff", status: "planned", votes: 0 })], persistent: false } }));
    render(<RequestBoard />);
    expect(screen.getByRole("status", { name: "Loading ideas" })).toBeInTheDocument();
    expect(await screen.findByText("Image background remover")).toBeInTheDocument();
    expect(screen.getByText("Demo mode")).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText("Planned")).toBeInTheDocument();
  });

  it("shows a friendly message when nothing is there yet", async () => {
    mockFetch(() => ({ body: { requests: [], persistent: true } }));
    render(<RequestBoard />);
    expect(await screen.findByText(/Be the first to suggest one/)).toBeInTheDocument();
  });

  it("surfaces load failures", async () => {
    mockFetch(() => ({ status: 500, body: { error: { code: "internal", message: "Something went wrong on our side." } } }));
    render(<RequestBoard />);
    expect(await screen.findByText("Something went wrong on our side.")).toBeInTheDocument();
  });

  it("shows a calm message and a retry button when the server's database is down", async () => {
    let up = false;
    mockFetch(() => (up ? { body: { requests: [item()], persistent: true } } : { status: 503, body: { error: { code: "unavailable", message: "The request board is taking a break. Please try again in a few minutes." } } }));
    render(<RequestBoard />);
    expect(await screen.findByText("The board is taking a break")).toBeInTheDocument();
    expect(screen.getByText(/Your idea is not lost/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    up = true;
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByText("Image background remover")).toBeInTheDocument();
    expect(screen.queryByText("The board is taking a break")).not.toBeInTheDocument();
  });

  it("filters by status and says so when nothing matches", async () => {
    const calls = mockFetch((url) => ({ body: { requests: url.includes("status=shipped") ? [] : [item()], persistent: true } }));
    render(<RequestBoard />);
    await screen.findByText("Image background remover");
    await userEvent.click(screen.getByText("Shipped"));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/requests?sort=top&status=shipped")).toBe(true));
    expect(await screen.findByText(/Nothing is marked/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("All"));
    expect(await screen.findByText("Image background remover")).toBeInTheDocument();
  });

  it("re-fetches when the sort order changes", async () => {
    const calls = mockFetch(() => ({ body: { requests: [item()], persistent: true } }));
    render(<RequestBoard />);
    await screen.findByText("Image background remover");
    await userEvent.click(screen.getByText("Newest"));
    await waitFor(() => expect(calls.some((c) => c.url.includes("sort=new"))).toBe(true));
  });

  it("votes optimistically and keeps the server's count", async () => {
    mockFetch((url, init) => (init.method === "POST" && url.includes("/vote") ? { body: { votes: 4, hasVoted: true } } : { body: { requests: [item()], persistent: true } }));
    render(<RequestBoard />);
    const vote = await screen.findByRole("button", { name: /^Vote for Image background remover. 3 votes/ });
    await userEvent.click(vote);
    expect(await screen.findByRole("button", { name: /^Remove your vote from Image background remover. 4 votes/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back a failed vote and reports the error", async () => {
    mockFetch((url, init) => (init.method === "POST" && url.includes("/vote") ? { status: 500, body: { error: { code: "internal", message: "Vote failed." } } } : { body: { requests: [item()], persistent: true } }));
    render(<RequestBoard />);
    await userEvent.click(await screen.findByRole("button", { name: /^Vote for/ }));
    expect(await screen.findByText("Vote failed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Vote for Image background remover. 3 votes/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("submits an idea, clears the form and shows a thank-you", async () => {
    const created = item({ id: "3", title: "Regex railroad diagrams", votes: 1, hasVoted: true });
    const calls = mockFetch((url, init) => (init.method === "POST" && url === "/api/requests" ? { status: 201, body: { request: created } } : { body: { requests: [], persistent: true } }));
    render(<RequestBoard />);
    await screen.findByText(/Be the first/);
    const submit = screen.getByRole("button", { name: /Submit idea/ });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("What should we build?"), "Regex railroad diagrams");
    await userEvent.type(screen.getByLabelText(/Why would it help/), "Visualise patterns.");
    await userEvent.click(submit);
    expect(await screen.findByText(/Your idea is on the board/)).toBeInTheDocument();
    expect(screen.getByLabelText("What should we build?")).toHaveValue("");
    const post = calls.find((c) => c.init.method === "POST")!;
    expect(JSON.parse(post.init.body as string)).toEqual({ title: "Regex railroad diagrams", description: "Visualise patterns.", website: "" });
  });

  it("shows the duplicate message and refreshes the list", async () => {
    mockFetch((url, init) =>
      init.method === "POST" && url === "/api/requests"
        ? { status: 409, body: { error: { code: "duplicate", message: "Someone already suggested this.", details: { existingId: "x" } } } }
        : { body: { requests: [item()], persistent: true } },
    );
    render(<RequestBoard />);
    await screen.findByText("Image background remover");
    await userEvent.type(screen.getByLabelText("What should we build?"), "Image background remover");
    await userEvent.click(screen.getByRole("button", { name: /Submit idea/ }));
    const alert = await screen.findByText("Someone already suggested this.");
    expect(within(alert.closest('[role="alert"]') as HTMLElement).getByText(/already suggested/)).toBeInTheDocument();
  });

  it("includes a honeypot field that is hidden from people and assistive tech", async () => {
    mockFetch(() => ({ body: { requests: [], persistent: true } }));
    const { container } = render(<RequestBoard />);
    await screen.findByText(/Be the first/);
    const honeypot = container.querySelector('input[tabindex="-1"]') as HTMLInputElement;
    expect(honeypot).toBeTruthy();
    expect(honeypot.closest('[aria-hidden="true"]')).toBeTruthy();
    expect(honeypot).toHaveAttribute("autocomplete", "off");
  });
});
