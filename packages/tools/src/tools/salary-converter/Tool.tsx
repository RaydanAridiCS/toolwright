"use client";

import { useMemo } from "react";
import { Alert, Badge, Field, ResultSlab, Select, useShareableState } from "@toolwright/ui";
import { PAY_PERIODS, PERIOD_LABELS, convertPay, type PayPeriod } from "@toolwright/core/salary-converter";
import { NumberField, num } from "../../shared/number-field";
import { formatMoney } from "../../shared/format";

export default function Tool() {
  const { state, setState } = useShareableState({ amount: "25", period: "hourly" as PayPeriod, hours: "40", days: "5", weeks: "52" });
  const set = (key: keyof typeof state) => (value: string) => setState((s) => ({ ...s, [key]: value }));

  const outcome = useMemo(() => {
    try {
      return { table: convertPay(num(state.amount), state.period, { hoursPerWeek: num(state.hours), daysPerWeek: num(state.days), weeksPerYear: num(state.weeks) }) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Check the numbers above." };
    }
  }, [state]);

  const table = "table" in outcome ? outcome.table : null;
  const headline: PayPeriod = state.period === "yearly" ? "hourly" : "yearly";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <NumberField label="Pay before tax" suffix="$" value={state.amount} onChange={set("amount")} min={0} className="lg:col-span-1" />
        <Field label="Paid">
          {(id) => (
            <Select id={id} value={state.period} onChange={(e) => set("period")(e.target.value)}>
              {PAY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <NumberField label="Hours per week" value={state.hours} onChange={set("hours")} min={1} max={168} />
        <NumberField label="Days per week" value={state.days} onChange={set("days")} min={1} max={7} />
        <NumberField label="Paid weeks per year" value={state.weeks} onChange={set("weeks")} min={1} max={52} hint="Use 50 for two unpaid weeks." />
      </div>

      {"error" in outcome ? <Alert tone="warning">{outcome.error}</Alert> : null}

      {table ? (
        <>
          <ResultSlab label={`${PERIOD_LABELS[headline]} pay`} value={formatMoney(table[headline])} valueTestId="headline-pay" />
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">The same pay in every period</caption>
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Period
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Pay before tax
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PAY_PERIODS.map((p) => (
                  <tr key={p} className={p === state.period ? "bg-marker text-marker-foreground" : undefined}>
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {PERIOD_LABELS[p]}
                      {p === state.period ? <Badge className="ml-2 align-middle">You entered</Badge> : null}
                    </th>
                    <td className="px-4 py-2 text-right font-mono tabular-nums" data-testid={`pay-${p}`}>
                      {formatMoney(table[p])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">These are amounts before tax and deductions. Take-home pay depends on where you live and what you pay in tax, benefits and retirement savings.</p>
    </div>
  );
}
