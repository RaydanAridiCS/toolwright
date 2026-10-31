"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, Button, Input, Label } from "@toolwright/ui";
import { ApiError, requestsApi } from "../../lib/request-client";

type Outcome = { kind: "idle" } | { kind: "added"; title: string } | { kind: "failed"; message: string };

/**
 * "Missing a tool?": a ticket stub whose number is the next free catalogue number.
 * A real idea is sent to the request board from here, so the button does what it says. An empty or too-short
 * field just opens the board, where there is room to write more.
 */
export function Ticket({ nextNumber }: { nextNumber: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const id = useId();
  const no = String(nextNumber).padStart(3, "0");
  const idea = title.trim();
  const boardHref = idea ? `/requests?title=${encodeURIComponent(idea)}` : "/requests";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idea.length < 4) return router.push(boardHref);
    setSending(true);
    setOutcome({ kind: "idle" });
    try {
      await requestsApi.create({ title: idea, description: "", website: "" });
      setOutcome({ kind: "added", title: idea });
      setTitle("");
    } catch (err) {
      setOutcome({ kind: "failed", message: err instanceof Error ? err.message : "Could not send your idea." });
      // The idea is kept in the field and carried to the board by the link below, so nothing typed is lost.
      if (err instanceof ApiError && err.code === "duplicate") setTitle(idea);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative grid border border-foreground bg-card shadow-md md:grid-cols-[1fr_auto]">
      <div className="p-6 sm:p-8">
        <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">Tool {no} is yours to name.</h2>
        <p className="mt-2 max-w-md text-muted-foreground">Tell us the job you keep doing by hand. The most-wanted ideas get built first, and anyone can build one.</p>
        <div className="mt-5 flex max-w-lg flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor={id}>What should we build?</Label>
            <Input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Compare two JSON files" />
          </div>
          <Button type="submit" variant="primary" size="md" disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : null} Add to the board
          </Button>
        </div>

        {outcome.kind === "added" ? (
          <Alert tone="success" className="mt-4 max-w-lg">
            Added &ldquo;{outcome.title}&rdquo; to the board, with your vote.{" "}
            <Link href="/requests" className="font-semibold underline underline-offset-2">
              See the board
            </Link>
          </Alert>
        ) : null}
        {outcome.kind === "failed" ? (
          <Alert tone="error" className="mt-4 max-w-lg">
            {outcome.message}{" "}
            <Link href={boardHref} className="font-semibold underline underline-offset-2">
              Open the board
            </Link>
          </Alert>
        ) : null}
      </div>

      {/* The stub: a perforated edge, with a notch cut out top and bottom. */}
      <div aria-hidden className="relative hidden w-44 flex-col items-center justify-center gap-1 border-l-2 border-dashed border-foreground p-6 md:flex">
        <span className="absolute -left-[11px] -top-[11px] size-5 rounded-full border border-foreground bg-background" />
        <span className="absolute -bottom-[11px] -left-[11px] size-5 rounded-full border border-foreground bg-background" />
        <span className="label-plate">No.</span>
        <span className="font-display text-6xl font-extrabold leading-none tabular-nums">{no}</span>
        <span className="label-plate mt-2">Unclaimed</span>
      </div>
    </form>
  );
}
