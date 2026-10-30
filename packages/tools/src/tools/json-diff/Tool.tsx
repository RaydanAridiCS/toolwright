"use client";

import { useMemo } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Alert, Badge, Button, CopyButton, Panel, ScrollArea, Stat, StatGrid, Textarea, Toggle, useShareableState } from "@toolwright/ui";
import { diffJsonText, formatChanges, type JsonChangeType, type JsonDiffResult } from "@toolwright/core/json-diff";

const SAMPLE_A = JSON.stringify(
  { name: "Ada Lovelace", age: 36, roles: ["admin", "editor"], address: { city: "London", zip: "W1" }, active: true },
  null,
  2,
);
const SAMPLE_B = JSON.stringify(
  { active: true, name: "Ada Lovelace", age: 37, roles: ["editor", "admin", "owner"], address: { city: "Paris" }, email: "ada@example.com" },
  null,
  2,
);

const SIGN: Record<JsonChangeType, string> = { added: "+", removed: "−", changed: "~" };
const TONE: Record<JsonChangeType, "success" | "danger" | "accent"> = { added: "success", removed: "danger", changed: "accent" };

const show = (value: unknown) => JSON.stringify(value) ?? "null";

export default function Tool() {
  const { state, setState } = useShareableState({ a: "", b: "", ignoreArrayOrder: false });
  const { a, b, ignoreArrayOrder } = state;
  const set = (patch: Partial<typeof state>) => setState((s) => ({ ...s, ...patch }));

  const outcome = useMemo<{ result: JsonDiffResult } | { error: string } | null>(() => {
    if (!a.trim() && !b.trim()) return null;
    try {
      return { result: diffJsonText(a, b, { ignoreArrayOrder }) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not compare these documents." };
    }
  }, [a, b, ignoreArrayOrder]);

  const result = outcome && "result" in outcome ? outcome.result : null;
  const report = result ? formatChanges(result.changes) : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Original"
          actions={
            <Button size="sm" variant="ghost" onClick={() => set({ a: SAMPLE_A, b: SAMPLE_B })}>
              Sample
            </Button>
          }
        >
          <Textarea aria-label="Original JSON" rows={12} className="min-h-48 font-mono" value={a} onChange={(e) => set({ a: e.target.value })} placeholder="Original JSON" spellCheck={false} />
        </Panel>
        <Panel
          title="Changed"
          actions={
            <Button size="sm" variant="ghost" disabled={!a && !b} onClick={() => set({ a: b, b: a })}>
              <ArrowLeftRight /> Swap
            </Button>
          }
        >
          <Textarea aria-label="Changed JSON" rows={12} className="min-h-48 font-mono" value={b} onChange={(e) => set({ b: e.target.value })} placeholder="Changed JSON" spellCheck={false} />
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-4">
        <Toggle label="Ignore array order" checked={ignoreArrayOrder} onCheckedChange={(v) => set({ ignoreArrayOrder: v })} />
        <p className="text-sm text-muted-foreground">Key order and spacing never count as differences.</p>
      </div>

      {outcome && "error" in outcome ? <Alert tone="error" title={outcome.error} /> : null}

      {result?.identical ? <Alert tone="success" title="The documents are identical." /> : null}

      {result && !result.identical ? (
        <>
          <StatGrid className="sm:grid-cols-3 lg:grid-cols-3">
            <Stat label="Added" value={<span className="text-success">+{result.added}</span>} />
            <Stat label="Removed" value={<span className="text-danger">−{result.removed}</span>} />
            <Stat label="Changed" value={result.changed} />
          </StatGrid>

          <Panel title="Differences" actions={<CopyButton text={report} label="Copy report" />}>
            <ScrollArea label="List of differences" className="rounded-xl border border-border bg-card">
              <table className="w-full border-collapse text-left font-mono text-[13px]">
                <caption className="sr-only">Differences between the two documents</caption>
                <thead className="sr-only">
                  <tr>
                    <th>Change</th>
                    <th>Path</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {result.changes.map((c, i) => (
                    <tr key={i} className="border-b border-border/50 align-top last:border-b-0">
                      <td className="w-24 px-3 py-2">
                        <Badge tone={TONE[c.type]}>
                          <span aria-hidden>{SIGN[c.type]}</span> {c.type}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{c.path}</td>
                      <td className="break-all px-3 py-2">
                        {c.type === "added" ? <span>{show(c.after)}</span> : null}
                        {c.type === "removed" ? <span className="line-through decoration-danger/60">{show(c.before)}</span> : null}
                        {c.type === "changed" ? (
                          <>
                            <span className="line-through decoration-danger/60">{show(c.before)}</span>
                            <span aria-hidden className="px-1.5 text-muted-foreground">→</span>
                            <span className="sr-only"> changed to </span>
                            <span>{show(c.after)}</span>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
