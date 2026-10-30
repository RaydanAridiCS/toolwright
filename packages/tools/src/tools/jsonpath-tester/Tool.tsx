"use client";

import { useMemo } from "react";
import { Alert, Badge, Button, CopyButton, Field, Input, Panel, ScrollArea, Textarea, useDebounced, useShareableState } from "@toolwright/ui";
import { matchesToJson, queryJsonPathText, type JsonPathResult } from "@toolwright/core/jsonpath-tester";

const SAMPLE = JSON.stringify(
  {
    store: {
      book: [
        { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
        { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
        { category: "fiction", author: "Herman Melville", title: "Moby Dick", isbn: "0-553-21311-3", price: 8.99 },
        { category: "fiction", author: "J. R. R. Tolkien", title: "The Lord of the Rings", isbn: "0-395-19395-8", price: 22.99 },
      ],
      bicycle: { color: "red", price: 399 },
    },
  },
  null,
  2,
);

const EXAMPLES = [
  { label: "All titles", query: "$.store.book[*].title" },
  { label: "Cheaper than 10", query: "$.store.book[?(@.price < 10)].title" },
  { label: "Has an ISBN", query: "$.store.book[?(@.isbn)].author" },
  { label: "Every price", query: "$..price" },
  { label: "Last book", query: "$.store.book[-1]" },
  { label: "First two", query: "$.store.book[0:2].title" },
];

const show = (value: unknown) => JSON.stringify(value) ?? "null";

export default function Tool() {
  const { state, setState } = useShareableState({ json: "", query: "" });
  const set = (patch: Partial<typeof state>) => setState((s) => ({ ...s, ...patch }));
  const json = useDebounced(state.json, 150);
  const query = useDebounced(state.query, 150);

  const outcome = useMemo<{ result: JsonPathResult } | { error: string } | null>(() => {
    if (!json.trim() && !query.trim()) return null;
    try {
      return { result: queryJsonPathText(json, query) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not run this query." };
    }
  }, [json, query]);

  const result = outcome && "result" in outcome ? outcome.result : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="JSON"
          actions={
            <Button size="sm" variant="ghost" onClick={() => set({ json: SAMPLE, query: "$.store.book[?(@.price < 10)].title" })}>
              Sample
            </Button>
          }
        >
          <Textarea aria-label="JSON" rows={16} className="min-h-72 font-mono" value={state.json} onChange={(e) => set({ json: e.target.value })} placeholder="Paste JSON here" spellCheck={false} />
        </Panel>

        <div className="flex flex-col gap-4">
          <Field label="JSONPath" hint="Start with $ for the whole document.">
            {(id) => <Input id={id} mono value={state.query} onChange={(e) => set({ query: e.target.value })} placeholder="$.store.book[*].title" spellCheck={false} autoComplete="off" />}
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Example queries">
            {EXAMPLES.map((ex) => (
              <Button key={ex.query} size="sm" variant="outline" title={ex.query} onClick={() => set({ query: ex.query })}>
                {ex.label}
              </Button>
            ))}
          </div>

          {outcome && "error" in outcome ? <Alert tone="error" title={outcome.error} /> : null}
          {result && result.total === 0 ? <Alert tone="info" title="No matches.">That path does not exist in this document, or the filter excluded everything.</Alert> : null}

          {result && result.total > 0 ? (
            <Panel
              title={
                <span className="flex items-center gap-2">
                  Matches <Badge tone="accent">{result.total}</Badge>
                </span>
              }
              actions={<CopyButton text={matchesToJson(result.matches)} label="Copy values" />}
            >
              <ScrollArea label="Matches" className="max-h-96 rounded-xl border border-border bg-card">
                <table className="w-full border-collapse text-left font-mono text-[13px]">
                  <caption className="sr-only">Values that match the path</caption>
                  <thead className="sr-only">
                    <tr>
                      <th>Path</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map((m, i) => (
                      <tr key={i} className="border-b border-border/50 align-top last:border-b-0">
                        <td className="max-w-[16rem] break-all px-3 py-2 text-muted-foreground">{m.path}</td>
                        <td className="break-all px-3 py-2">{show(m.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              {result.truncated ? <p className="text-sm text-muted-foreground">Showing the first {result.matches.length} of {result.total} matches.</p> : null}
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
