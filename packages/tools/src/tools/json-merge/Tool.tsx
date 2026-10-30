"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, CopyButton, DownloadButton, Field, Input, Panel, ResultSlab, ScrollArea, Select, Textarea } from "@toolwright/ui";
import { CONFLICT_LABELS, mergeJsonText, type MergeOptions, type MergeTextResult } from "@toolwright/core/json-merge";

const SAMPLE = {
  base: { name: "web-app", version: "1.0.0", port: 3000, features: { search: true, billing: false }, owners: [{ id: 1, name: "Ada" }, { id: 2, name: "Bob" }] },
  ours: { name: "web-app", version: "1.1.0", port: 8080, features: { search: true, billing: false, beta: true }, owners: [{ id: 1, name: "Ada L." }, { id: 2, name: "Bob" }] },
  theirs: { name: "web-app", version: "1.0.0", port: 9000, features: { billing: true, search: true }, owners: [{ id: 1, name: "Ada" }, { id: 2, name: "Bob" }, { id: 3, name: "Cy" }] },
};
const pretty = (v: unknown) => JSON.stringify(v, null, 2);

const show = (v: unknown) => (v === undefined ? "(missing)" : (JSON.stringify(v) ?? "null"));

export default function Tool() {
  // Plain state, not the URL: these are often configuration files that hold secrets.
  const [base, setBase] = useState("");
  const [ours, setOurs] = useState("");
  const [theirs, setTheirs] = useState("");
  const [prefer, setPrefer] = useState<"ours" | "theirs">("ours");
  const [arrays, setArrays] = useState<"conflict" | "union" | "keyed">("conflict");
  const [arrayKey, setArrayKey] = useState("id");
  const [keyOrder, setKeyOrder] = useState<"ours" | "theirs">("ours");
  const [indent, setIndent] = useState<"2" | "4" | "tab">("2");

  const outcome = useMemo<{ result: MergeTextResult } | { error: string } | null>(() => {
    if (!base.trim() && !ours.trim() && !theirs.trim()) return null;
    try {
      const options: MergeOptions = { prefer, arrays, arrayKey, keyOrder };
      return { result: mergeJsonText(base, ours, theirs, options, indent === "tab" ? "\t" : Number(indent)) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not merge these documents." };
    }
  }, [base, ours, theirs, prefer, arrays, arrayKey, keyOrder, indent]);

  const result = outcome && "result" in outcome ? outcome.result : null;
  const conflicts = result?.conflicts ?? [];

  const loadSample = () => {
    setBase(pretty(SAMPLE.base));
    setOurs(pretty(SAMPLE.ours));
    setTheirs(pretty(SAMPLE.theirs));
    setArrays("keyed");
  };

  const box = (label: string, hint: string, value: string, set: (v: string) => void) => (
    <Panel title={label}>
      <Textarea aria-label={label} rows={11} className="min-h-44 font-mono" value={value} onChange={(e) => set(e.target.value)} placeholder={hint} spellCheck={false} />
    </Panel>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={loadSample}>
          Load a sample
        </Button>
        <p className="text-sm text-muted-foreground">Everything stays in this tab. Nothing is uploaded or put in the address bar.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {box("Base", "The common ancestor: the version you both started from", base, setBase)}
        {box("Your version", "Your edited copy", ours, setOurs)}
        {box("Their version", "The other person's edited copy", theirs, setTheirs)}
      </div>

      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="When both changed the same value" hint="That side's value is used, and the conflict is listed.">
          {(id) => (
            <Select id={id} value={prefer} onChange={(e) => setPrefer(e.target.value as "ours" | "theirs")}>
              <option value="ours">Keep your version</option>
              <option value="theirs">Keep their version</option>
            </Select>
          )}
        </Field>
        <Field label="Arrays" hint="Lists can be one value, a set, or matched by an ID.">
          {(id) => (
            <Select id={id} value={arrays} onChange={(e) => setArrays(e.target.value as "conflict" | "union" | "keyed")}>
              <option value="conflict">Treat as one value</option>
              <option value="union">Combine as a set</option>
              <option value="keyed">Match items by a property</option>
            </Select>
          )}
        </Field>
        {arrays === "keyed" ? (
          <Field label="Property that identifies an item" hint="For example id or slug.">
            {(id) => <Input id={id} mono value={arrayKey} onChange={(e) => setArrayKey(e.target.value)} />}
          </Field>
        ) : null}
        <Field label="If both reordered keys" hint="Otherwise a side that did not reorder follows the other.">
          {(id) => (
            <Select id={id} value={keyOrder} onChange={(e) => setKeyOrder(e.target.value as "ours" | "theirs")}>
              <option value="ours">Use your order</option>
              <option value="theirs">Use their order</option>
            </Select>
          )}
        </Field>
        <Field label="Indent">
          {(id) => (
            <Select id={id} value={indent} onChange={(e) => setIndent(e.target.value as "2" | "4" | "tab")}>
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tab</option>
            </Select>
          )}
        </Field>
      </div>

      {outcome && "error" in outcome ? <Alert tone="error">{outcome.error}</Alert> : null}
      {result?.notes.map((note) => (
        <Alert key={note} tone="warning">
          {note}
        </Alert>
      ))}

      {result ? (
        <>
          <ResultSlab
            label="Result"
            size="md"
            value={conflicts.length === 0 ? "Merged cleanly" : `${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}`}
            note={conflicts.length === 0 ? "No place was changed differently on both sides." : `Resolved by keeping ${prefer === "ours" ? "your" : "their"} version. Check the list below.`}
            valueTestId="merge-summary"
          />

          <Panel
            title="Merged JSON"
            actions={
              <>
                <CopyButton text={result.text} label="Copy" />
                <DownloadButton data={result.text} filename="merged.json" mime="application/json" label="Download" />
              </>
            }
          >
            <Textarea aria-label="Merged JSON" readOnly rows={14} className="min-h-56 font-mono" value={result.text} spellCheck={false} />
          </Panel>

          {conflicts.length > 0 ? (
            <Panel title="Conflicts">
              <ScrollArea label="List of conflicts" className="border border-border bg-card">
                <table className="w-full border-collapse text-left font-mono text-[13px]">
                  <caption className="sr-only">Places where both versions changed the same value</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-normal">Path</th>
                      <th className="px-3 py-2 font-normal">Base</th>
                      <th className="px-3 py-2 font-normal">Yours</th>
                      <th className="px-3 py-2 font-normal">Theirs</th>
                      <th className="px-3 py-2 font-normal">Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 align-top last:border-b-0">
                        <td className="px-3 py-2">
                          <span className="font-medium">{c.path}</span>
                          <span className="block text-xs text-muted-foreground">{CONFLICT_LABELS[c.kind]}</span>
                        </td>
                        <td className="break-all px-3 py-2">{show(c.base)}</td>
                        <td className="break-all px-3 py-2">{show(c.ours)}</td>
                        <td className="break-all px-3 py-2">{show(c.theirs)}</td>
                        <td className="px-3 py-2">
                          <Badge tone="accent">{c.chosen === "ours" ? "yours" : "theirs"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
