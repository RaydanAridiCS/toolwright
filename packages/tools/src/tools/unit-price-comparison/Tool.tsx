"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, ResultSlab, Select, cn, useShareableState } from "@toolwright/ui";
import { compareUnitPrices, DISPLAY_UNITS, UNITS, unitById, type Comparison, type ItemInput } from "@toolwright/core/unit-price-comparison";
import { num } from "../../shared/number-field";

interface Row {
  name: string;
  price: string;
  quantity: string;
  unit: string;
  packs: string;
}

const blank = (unit = "g"): Row => ({ name: "", price: "", quantity: "", unit, packs: "1" });
const MAX_ROWS = 10;

const money = (symbol: string, value: number) => `${symbol}${value < 1 ? value.toFixed(3) : value.toFixed(2)}`;
const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

export default function Tool() {
  const { state, setState } = useShareableState({
    symbol: "$",
    display: "",
    rows: [
      { name: "Store brand", price: "2.49", quantity: "500", unit: "g", packs: "1" },
      { name: "Family pack", price: "5.99", quantity: "1.5", unit: "kg", packs: "1" },
      { name: "Name brand", price: "3.79", quantity: "400", unit: "g", packs: "1" },
    ] as Row[],
  });
  const { symbol, display, rows } = state;
  const setRow = (index: number, patch: Partial<Row>) => setState((s) => ({ ...s, rows: s.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));

  const outcome = useMemo<{ result: Comparison } | { error: string }>(() => {
    const items: ItemInput[] = rows.map((r) => ({ name: r.name, price: num(r.price), quantity: num(r.quantity), unit: r.unit, packs: r.packs.trim() ? num(r.packs) : 1 }));
    // Rows that are completely empty are ignored; half-filled ones are reported by the comparison.
    const used = items.filter((_, i) => rows[i]?.price.trim() || rows[i]?.quantity.trim());
    try {
      return { result: compareUnitPrices(used, display || undefined) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not compare these." };
    }
  }, [rows, display]);

  const result = "result" in outcome ? outcome.result : null;
  const best = result?.ranked[0];
  const displayChoices = DISPLAY_UNITS.filter((d) => d.dimension === (result?.dimension ?? unitById(rows[0]?.unit ?? "g")?.dimension));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Currency symbol">{(id) => <Input id={id} value={symbol} maxLength={4} onChange={(e) => setState((s) => ({ ...s, symbol: e.target.value }))} />}</Field>
        <Field label="Show prices">
          {(id) => (
            <Select id={id} value={result?.display.id ?? display} onChange={(e) => setState((s) => ({ ...s, display: e.target.value }))}>
              {displayChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <ol className="flex flex-col gap-3" aria-label="Products">
        {rows.map((row, i) => (
          <li key={i} className="grid gap-3 border border-border bg-card p-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr_0.6fr_auto] sm:items-end">
            <Field label={`Product ${i + 1} name`}>{(id) => <Input id={id} value={row.name} placeholder={`Product ${i + 1}`} onChange={(e) => setRow(i, { name: e.target.value })} />}</Field>
            <Field label={`Product ${i + 1} price`}>{(id) => <Input id={id} mono inputMode="decimal" value={row.price} onChange={(e) => setRow(i, { price: e.target.value })} />}</Field>
            <Field label={`Product ${i + 1} size of one item`}>{(id) => <Input id={id} mono inputMode="decimal" value={row.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} />}</Field>
            <Field label={`Product ${i + 1} unit`}>
              {(id) => (
                <Select id={id} value={row.unit} onChange={(e) => setRow(i, { unit: e.target.value })}>
                  {UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={`Product ${i + 1} items in the pack`}>{(id) => <Input id={id} mono inputMode="numeric" value={row.packs} onChange={(e) => setRow(i, { packs: e.target.value })} />}</Field>
            <Button variant="ghost" size="icon" aria-label={`Remove product ${i + 1}`} disabled={rows.length <= 2} onClick={() => setState((s) => ({ ...s, rows: s.rows.filter((_, j) => j !== i) }))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <div>
        <Button variant="outline" size="sm" disabled={rows.length >= MAX_ROWS} onClick={() => setState((s) => ({ ...s, rows: [...s.rows, blank(s.rows[s.rows.length - 1]?.unit)] }))}>
          <Plus /> Add a product
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">Price is what is on the tag. For a multipack, enter the size of one item and how many are in the pack (a 6-pack of 330 ml cans is 330 ml, 6 items). Leave items at 1 for a single package.</p>
      </div>

      {"error" in outcome ? <Alert tone="info">{outcome.error}</Alert> : null}

      {result && best ? (
        <>
          <ResultSlab
            label={`Best buy ${result.display.label}`}
            size="md"
            value={`${best.name}: ${money(symbol, best.unitPrice)}`}
            note={result.ranked.length > 1 ? `${percent(result.savingVsDearest)} cheaper per unit than the most expensive option.` : undefined}
            valueTestId="best-buy"
          />
          <div className="border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Products ranked by price {result.display.label}</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-normal">Rank</th>
                  <th className="px-3 py-2 font-normal">Product</th>
                  <th className="px-3 py-2 font-normal">Price {result.display.label}</th>
                  <th className="px-3 py-2 font-normal">Compared with the best</th>
                </tr>
              </thead>
              <tbody>
                {result.ranked.map((r) => (
                  <tr key={r.index} className={cn("border-b border-border/50 last:border-b-0", r.rank === 1 && "bg-marker text-marker-foreground")}>
                    <td className="px-3 py-2 font-mono">{r.rank}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 font-mono">{money(symbol, r.unitPrice)}</td>
                    <td className="px-3 py-2">{r.moreThanBest === 0 ? "Cheapest" : `${percent(r.moreThanBest)} more`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.skipped.length > 0 ? (
            <Alert tone="warning">
              {result.skipped.map((s) => `Product ${s.index + 1} was left out: ${s.reason}.`).join(" ")}
            </Alert>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
