"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ChevronUp, Loader2, RotateCw, Send } from "lucide-react";
import { Alert, Badge, Button, Field, Input, SegmentedControl, Textarea, cn, type BadgeTone } from "@toolwright/ui";
import { ApiError, requestsApi, type RequestItem, type Status } from "../lib/request-client";

const STATUS_LABEL: Record<Status, string> = { open: "Open", planned: "Planned", building: "In progress", shipped: "Shipped", declined: "Not planned" };
type StatusFilter = "all" | "open" | "planned" | "building" | "shipped";
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "building", label: "In progress" },
  { value: "shipped", label: "Shipped" },
];
const STATUS_TONE: Record<Status, BadgeTone> = { open: "neutral", planned: "primary", building: "accent", shipped: "success", declined: "danger" };

export function RequestBoard() {
  const formId = useId();
  const [sort, setSort] = useState<"top" | "new">("top");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [items, setItems] = useState<RequestItem[] | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "unavailable" means the server's database is down: say so calmly and offer a retry, rather than a bug-style error.
  const [unavailable, setUnavailable] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { requests, persistent: p } = await requestsApi.list(sort, filter === "all" ? undefined : filter);
      setItems(requests);
      setPersistent(p);
      setLoadError(null);
      setUnavailable(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load requests.");
      setUnavailable(err instanceof ApiError && err.code === "unavailable");
    }
  }, [sort, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // The home page ticket links here with ?title=… so the idea carries over.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("title");
    if (prefill) setTitle(prefill.slice(0, 120));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      const { request } = await requestsApi.create({ title, description, website });
      setItems((current) => [request, ...(current ?? [])]);
      setTitle("");
      setDescription("");
      setNotice("Thanks! Your idea is on the board and has your vote.");
      if (sort === "top") void load();
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate") {
        setFormError(err.message);
        void load();
      } else setFormError(err instanceof Error ? err.message : "Could not submit your idea.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVote = async (item: RequestItem) => {
    if (pending.has(item.id)) return;
    setPending((p) => new Set(p).add(item.id));
    // Optimistic update, rolled back on failure.
    const apply = (hasVoted: boolean, votes: number) => setItems((cur) => cur?.map((r) => (r.id === item.id ? { ...r, hasVoted, votes } : r)) ?? cur);
    apply(!item.hasVoted, item.votes + (item.hasVoted ? -1 : 1));
    try {
      const result = item.hasVoted ? await requestsApi.unvote(item.id) : await requestsApi.vote(item.id);
      apply(result.hasVoted, result.votes);
    } catch (err) {
      apply(item.hasVoted, item.votes);
      setLoadError(err instanceof Error ? err.message : "Your vote could not be saved.");
      setUnavailable(err instanceof ApiError && err.code === "unavailable");
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[22rem_1fr]">
      <form onSubmit={submit} className="flex h-fit flex-col gap-4 border border-foreground bg-card p-5 shadow-md lg:sticky lg:top-24" aria-labelledby={`${formId}-title`}>
        <h2 id={`${formId}-title`} className="font-display text-2xl font-extrabold tracking-tight">
          Suggest a tool
        </h2>
        <Field label="What should we build?" hint="Be specific: &ldquo;Compare two JSON files ignoring key order&rdquo; beats &ldquo;JSON tool&rdquo;.">
          {(id) => <Input id={id} value={title} maxLength={120} required minLength={4} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Image background remover" />}
        </Field>
        <Field label="Why would it help? (optional)">
          {(id) => <Textarea id={id} mono={false} rows={4} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the problem it solves." />}
        </Field>
        {/* Honeypot: hidden from people, irresistible to bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <Button type="submit" variant="primary" size="lg" disabled={submitting || title.trim().length < 4}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />} Submit idea
        </Button>
        <p className="text-xs text-muted-foreground">No account needed. A random code stored in your browser keeps votes to one per idea. We never see your email or IP address.</p>
      </form>

      <section aria-labelledby={`${formId}-list`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${formId}-list`} className="font-display text-2xl font-extrabold tracking-tight">
            Ideas {items ? <span className="font-normal text-muted-foreground">({items.length})</span> : null}
          </h2>
          <SegmentedControl
            label="Sort ideas"
            value={sort}
            onValueChange={setSort}
            options={[
              { value: "top", label: "Most voted" },
              { value: "new", label: "Newest" },
            ]}
          />
        </div>
        <div className="mb-4">
          <SegmentedControl label="Show ideas that are" value={filter} onValueChange={setFilter} options={FILTERS} />
        </div>

        {!persistent ? (
          <Alert tone="info" title="Demo mode" className="mb-4">
            No database is connected, so ideas are kept in memory and reset when the server restarts.
          </Alert>
        ) : null}
        {loadError ? (
          <div className="mb-4 flex flex-col items-start gap-3">
            {unavailable ? (
              <Alert tone="warning" title="The board is taking a break" className="w-full">
                {loadError} Your idea is not lost: it stays in the form until it is sent.
              </Alert>
            ) : (
              <Alert tone="error" className="w-full">
                {loadError}
              </Alert>
            )}
            {items === null ? (
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RotateCw /> Try again
              </Button>
            ) : null}
          </div>
        ) : null}

        {items === null && !loadError ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading ideas">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : null}
        {items?.length === 0 && filter === "all" ? <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No ideas yet. Be the first to suggest one!</p> : null}
        {items?.length === 0 && filter !== "all" ? <p className="border border-dashed border-border p-10 text-center text-muted-foreground">Nothing is marked &ldquo;{FILTERS.find((f) => f.value === filter)?.label}&rdquo; yet.</p> : null}

        <ul className="border-t border-foreground">
          {items?.map((item) => (
            <li key={item.id} className="flex gap-4 border-b border-border py-4">
              <button
                type="button"
                onClick={() => toggleVote(item)}
                disabled={pending.has(item.id)}
                aria-pressed={item.hasVoted}
                aria-label={`${item.hasVoted ? "Remove your vote from" : "Vote for"} ${item.title}. ${item.votes} vote${item.votes === 1 ? "" : "s"}`}
                className={cn(
                  "flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 border text-sm font-bold transition-colors",
                  item.hasVoted ? "border-foreground bg-marker text-marker-foreground shadow-md" : "border-foreground/60 bg-card hover:bg-muted",
                )}
              >
                <ChevronUp aria-hidden className="size-4" />
                <span className="tabular-nums">{item.votes}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-bold leading-tight">{item.title}</h3>
                  {item.status !== "open" ? <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge> : null}
                </div>
                {item.description ? <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">{item.description}</p> : null}
                <p className="label-plate mt-2">Suggested {new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
