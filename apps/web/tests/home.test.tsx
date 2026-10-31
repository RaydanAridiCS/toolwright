import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HeroBench } from "../src/components/home/hero-bench";
import { ProofLog } from "../src/components/home/proof-log";
import { Ticket } from "../src/components/home/ticket";
import { NetworkLedger } from "../src/components/network-ledger";
import { Ruler } from "../src/components/ruler";
import { __ingestForTests, __resetForTests, classify, useOutsideRequests } from "../src/lib/use-outside-requests";
import { renderHook } from "@testing-library/react";

const entry = (name: string, initiatorType = "script", transferSize = 2048) => ({ name, initiatorType, transferSize, encodedBodySize: transferSize, entryType: "resource", duration: 1, startTime: 0 }) as unknown as PerformanceEntry;

beforeEach(() => {
  push.mockClear();
  __resetForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classify (outside-request detection)", () => {
  const origin = "https://toolwright.com";
  it("separates this site from everyone else", () => {
    expect(classify("https://toolwright.com/_next/static/a.js", origin)).toBe("same");
    expect(classify("/relative/path.css", origin)).toBe("same");
    expect(classify("https://fonts.googleapis.com/css", origin)).toBe("outside");
    expect(classify("https://toolwright.com.evil.example/x", origin)).toBe("outside");
    expect(classify("http://toolwright.com/insecure", origin)).toBe("outside"); // different scheme = different origin
    expect(classify("https://cdn.toolwright.com/x.js", origin)).toBe("outside"); // subdomains are other origins
  });
  it("ignores data:, blob: and junk", () => {
    expect(classify("data:image/png;base64,AAAA", origin)).toBeNull();
    expect(classify("blob:https://toolwright.com/1234", origin)).toBeNull();
    expect(classify("chrome-extension://abc/x.js", origin)).toBeNull();
    expect(classify("http://[bad", origin)).toBeNull();
  });
});

describe("useOutsideRequests", () => {
  it("never claims a number it has not measured on the server", () => {
    function Probe() {
      const s = useOutsideRequests();
      return <span>{s.ready ? `ready:${s.outside}` : "waiting"}</span>;
    }
    expect(renderToString(<Probe />)).toContain("waiting");
    expect(renderToString(<NetworkLedger />)).toContain("…");
    expect(renderToString(<NetworkLedger />)).not.toMatch(/data-testid="outside-requests"[^>]*>0</);
  });

  it("counts same-origin and outside requests separately and keeps a log", () => {
    const { result } = renderHook(() => useOutsideRequests());
    expect(result.current).toMatchObject({ ready: true, outside: 0, same: 0 });
    act(() => {
      __ingestForTests([entry(`${window.location.origin}/_next/static/a.js`), entry(`${window.location.origin}/api/requests`, "fetch"), entry("data:image/png;base64,AAAA"), entry("blob:abc")]);
    });
    expect(result.current).toMatchObject({ outside: 0, same: 2 });
    expect(result.current.log.map((l) => l.type)).toEqual(["script", "fetch"]);
    act(() => __ingestForTests([entry("https://tracker.example/pixel.gif", "img", 43)]));
    expect(result.current.outside).toBe(1);
    expect(result.current.log.at(-1)).toMatchObject({ outside: true, type: "img", size: 43 });
  });

  it("caps the log at 200 entries", () => {
    const { result } = renderHook(() => useOutsideRequests());
    act(() => __ingestForTests(Array.from({ length: 300 }, (_, i) => entry(`${window.location.origin}/f${i}.js`))));
    expect(result.current.same).toBe(300);
    expect(result.current.log).toHaveLength(200);
    expect(result.current.log.at(-1)?.url).toContain("/f299.js");
  });

  it("reads buffered entries from a real PerformanceObserver", () => {
    const observed: unknown[] = [];
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        constructor(private cb: (list: { getEntries: () => PerformanceEntry[] }) => void) {}
        observe(options: unknown) {
          observed.push(options);
          this.cb({ getEntries: () => [entry(`${window.location.origin}/early.js`), entry("https://other.example/x.js")] });
        }
      },
    );
    const { result } = renderHook(() => useOutsideRequests());
    expect(observed).toEqual([{ type: "resource", buffered: true }]);
    expect(result.current).toMatchObject({ ready: true, same: 1, outside: 1 });
  });

  it("stays usable when the browser has no PerformanceObserver", () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    const { result } = renderHook(() => useOutsideRequests());
    expect(result.current).toMatchObject({ ready: true, outside: 0 });
  });
});

describe("NetworkLedger", () => {
  it("shows 0 once measured, and turns into a warning if anything goes outside", () => {
    render(<NetworkLedger showSameOrigin />);
    expect(screen.getByTestId("outside-requests")).toHaveTextContent("0");
    expect(screen.getByTestId("outside-requests")).not.toHaveClass("text-danger");
    act(() => __ingestForTests([entry(`${window.location.origin}/a.js`)]));
    expect(screen.getByText(/1 files from this site/)).toBeInTheDocument();
    act(() => __ingestForTests([entry("https://example.com/leak", "fetch")]));
    expect(screen.getByTestId("outside-requests")).toHaveTextContent("1");
    expect(screen.getByTestId("outside-requests")).toHaveClass("text-danger");
  });

  it("links to the verification steps unless told not to", () => {
    const { rerender } = render(<NetworkLedger />);
    expect(screen.getByRole("link", { name: "How to check" })).toHaveAttribute("href", "/privacy#verify");
    rerender(<NetworkLedger link={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("HeroBench", () => {
  it("starts on Merge PDF and loads the real tool once the page is idle", async () => {
    render(<HeroBench />);
    expect(screen.getByRole("radio", { name: "Merge PDF" })).toBeChecked();
    expect(await screen.findByText(/Drop PDFs here/, undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("outside-requests")).toHaveTextContent("0");
  }, 20_000);

  it("offers the most useful tools and links to the full page of the one you are on", async () => {
    render(<HeroBench />);
    for (const name of ["Merge PDF", "Compress PDF", "Organize pages", "Images to PDF", "Compress images"]) expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the full Merge PDF page/ })).toHaveAttribute("href", "/tools/merge-pdf");
    await userEvent.click(screen.getByRole("radio", { name: "Compress PDF" }));
    expect(screen.getByRole("link", { name: /Open the full Compress PDF page/ })).toHaveAttribute("href", "/tools/compress-pdf");
    await userEvent.click(screen.getByRole("radio", { name: "Organize pages" }));
    expect(screen.getByRole("link", { name: /Open the full PDF Page Organizer page/ })).toHaveAttribute("href", "/tools/pdf-organizer");
  }, 20_000);

  it("keeps a tab's tool mounted when you switch away, and loads each tab only when it is opened", async () => {
    render(<HeroBench />);
    const merge = await screen.findByText(/Drop PDFs here/, undefined, { timeout: 5000 });
    expect(screen.queryByText(/Drop a PDF here/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Compress PDF" }));
    expect(await screen.findByText(/Drop a PDF here/, undefined, { timeout: 5000 })).toBeVisible();
    expect(merge).toBeInTheDocument();
    expect(merge).not.toBeVisible();
  }, 20_000);
});

describe("ProofLog", () => {
  it("lists real requests and marks outside ones", () => {
    render(<ProofLog />);
    expect(screen.getByText(/Waiting for the browser/)).toBeInTheDocument();
    act(() => __ingestForTests([entry(`${window.location.origin}/_next/static/chunks/app.js`, "script", 14336), entry("https://leak.example/p.gif", "img", 0)]));
    expect(screen.getByText("/_next/static/chunks/app.js")).toBeInTheDocument();
    expect(screen.getByText("14 KB")).toBeInTheDocument();
    expect(screen.getByText("this site")).toBeInTheDocument();
    expect(screen.getByText("outside")).toBeInTheDocument();
  });

  it("shows that the browser blocked the leak attempt and names the policy directive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        document.dispatchEvent(Object.assign(new Event("securitypolicyviolation"), { violatedDirective: "connect-src" }));
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<ProofLog />);
    await userEvent.click(screen.getByRole("button", { name: "Try to make it leak" }));
    expect(await screen.findByText(/Blocked\./)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("connect-src");
    expect(screen.getByRole("status")).toHaveTextContent("Nothing left your device.");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/collect");
    expect(init.method).toBe("POST");
  });

  it("raises an alarm instead of a green tick if the request ever succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    render(<ProofLog />);
    await userEvent.click(screen.getByRole("button", { name: "Try to make it leak" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That request was sent");
    expect(screen.queryByText(/Blocked\./)).not.toBeInTheDocument();
  });
});

/** Answers /api/requests with the given status and body, and records what was sent. */
function stubRequestsApi(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Ticket", () => {
  it("is numbered with the next free catalogue number", () => {
    render(<Ticket nextNumber={72} />);
    expect(screen.getByRole("heading", { name: "Tool 072 is yours to name." })).toBeInTheDocument();
  });

  it("sends a real idea to the request board and confirms it, without leaving the page", async () => {
    const fetchMock = stubRequestsApi(201, { request: { id: "1", title: "Compare JSON & YAML", description: "", status: "open", createdAt: "2026-10-31T00:00:00.000Z", votes: 1, hasVoted: true } });
    render(<Ticket nextNumber={72} />);
    await userEvent.type(screen.getByLabelText("What should we build?"), "Compare JSON & YAML");
    await userEvent.click(screen.getByRole("button", { name: "Add to the board" }));
    expect(await screen.findByText(/Added .Compare JSON & YAML. to the board/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the board" })).toHaveAttribute("href", "/requests");
    expect(screen.getByLabelText("What should we build?")).toHaveValue("");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/requests");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ title: "Compare JSON & YAML", description: "", website: "" });
    expect(push).not.toHaveBeenCalled();
  });

  it("explains a duplicate and links to the board with the idea carried over", async () => {
    stubRequestsApi(409, { error: { code: "duplicate", message: "Someone already suggested this. Find it in the list and give it a vote!" } });
    render(<Ticket nextNumber={72} />);
    await userEvent.type(screen.getByLabelText("What should we build?"), "JSON diff and merge");
    await userEvent.click(screen.getByRole("button", { name: "Add to the board" }));
    expect(await screen.findByText(/already suggested this/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the board" })).toHaveAttribute("href", "/requests?title=JSON%20diff%20and%20merge");
    expect(screen.getByLabelText("What should we build?")).toHaveValue("JSON diff and merge");
  });

  it("keeps what was typed and points to the board when the server is down", async () => {
    stubRequestsApi(503, { error: { code: "unavailable", message: "The request board is taking a break. Please try again in a few minutes." } });
    render(<Ticket nextNumber={72} />);
    await userEvent.type(screen.getByLabelText("What should we build?"), "Audio trimmer");
    await userEvent.click(screen.getByRole("button", { name: "Add to the board" }));
    expect(await screen.findByText(/taking a break/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the board" })).toHaveAttribute("href", "/requests?title=Audio%20trimmer");
  });

  it("opens the board instead of sending when the field is empty or too short to be an idea", async () => {
    const fetchMock = stubRequestsApi(201, {});
    render(<Ticket nextNumber={72} />);
    await userEvent.click(screen.getByRole("button", { name: "Add to the board" }));
    expect(push).toHaveBeenLastCalledWith("/requests");
    await userEvent.type(screen.getByLabelText("What should we build?"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Add to the board" }));
    expect(push).toHaveBeenLastCalledWith("/requests?title=abc");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Ruler", () => {
  it("is decorative: hidden from assistive tech, with an optional scale label", () => {
    const { container } = render(<Ruler label="71 tools" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(within(container.firstElementChild as HTMLElement).getByText("71 tools")).toBeInTheDocument();
  });
});
