"use client";

import { useMemo } from "react";
import { Alert, ResultSlab, Stat, StatGrid, useShareableState } from "@toolwright/ui";
import { mortgageAffordability, type AffordabilityResult } from "@toolwright/core/mortgage-affordability-calculator";
import { NumberField, num } from "../../shared/number-field";
import { formatMoney, formatPercent } from "../../shared/format";

const money0 = (n: number) => formatMoney(Math.round(n)).replace(/\.00$/, "");

export default function Tool() {
  const { state, setState } = useShareableState({
    income: "90000",
    debts: "400",
    down: "50000",
    rate: "6.5",
    years: "30",
    tax: "1.1",
    insurance: "1400",
    hoa: "0",
    pmi: "0.5",
    front: "28",
    back: "36",
  });
  const set = (key: keyof typeof state) => (value: string) => setState((s) => ({ ...s, [key]: value }));

  const outcome = useMemo<{ result: AffordabilityResult } | { error: string }>(() => {
    try {
      return {
        result: mortgageAffordability({
          annualIncome: num(state.income),
          monthlyDebts: num(state.debts),
          downPayment: num(state.down),
          annualRatePercent: num(state.rate),
          years: num(state.years),
          propertyTaxPercent: num(state.tax),
          insuranceYearly: num(state.insurance),
          hoaMonthly: num(state.hoa),
          pmiPercent: num(state.pmi),
          frontRatioPercent: num(state.front),
          backRatioPercent: num(state.back),
        }),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Check the numbers above." };
    }
  }, [state]);

  const result = "result" in outcome ? outcome.result : null;
  const rows = result
    ? [
        ["Principal and interest", result.monthly.principalInterest],
        ["Property tax", result.monthly.propertyTax],
        ["Home insurance", result.monthly.insurance],
        ["HOA dues", result.monthly.hoa],
        ["Mortgage insurance (PMI)", result.monthly.pmi],
      ].filter(([label, value]) => value !== 0 || label === "Principal and interest")
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Gross income per year" suffix="$" value={state.income} onChange={set("income")} min={0} hint="Before tax, all borrowers combined." />
        <NumberField label="Other debt payments per month" suffix="$" value={state.debts} onChange={set("debts")} min={0} hint="Car, cards, student loans." />
        <NumberField label="Down payment" suffix="$" value={state.down} onChange={set("down")} min={0} />
        <NumberField label="Interest rate" suffix="%" value={state.rate} onChange={set("rate")} min={0} />
        <NumberField label="Loan term" suffix="years" value={state.years} onChange={set("years")} min={1} />
        <NumberField label="Property tax per year" suffix="%" value={state.tax} onChange={set("tax")} min={0} hint="Share of the price." />
        <NumberField label="Home insurance per year" suffix="$" value={state.insurance} onChange={set("insurance")} min={0} />
        <NumberField label="HOA dues per month" suffix="$" value={state.hoa} onChange={set("hoa")} min={0} />
        <NumberField label="Mortgage insurance rate" suffix="%" value={state.pmi} onChange={set("pmi")} min={0} hint="Per year, while the down payment is under 20%." />
        <NumberField label="Housing share of income" suffix="%" value={state.front} onChange={set("front")} min={1} max={100} hint="Lenders often use 28." />
        <NumberField label="Housing plus debts share" suffix="%" value={state.back} onChange={set("back")} min={1} max={100} hint="Lenders often use 36 to 43." />
      </div>

      {"error" in outcome ? <Alert tone="warning">{outcome.error}</Alert> : null}

      {result && !result.viable ? (
        <Alert tone="warning" title="With these numbers there is no room for a mortgage payment.">
          Your debts and fixed costs already use up the housing budget of {formatMoney(result.housingBudget)} a month. Try a bigger down payment, less debt or a higher income.
        </Alert>
      ) : null}

      {result && result.viable ? (
        <>
          <ResultSlab label="You could afford a home up to" value={money0(result.maxPrice)} valueTestId="max-price" />
          <StatGrid className="sm:grid-cols-3 lg:grid-cols-3">
            <Stat label="Loan amount" value={money0(result.maxLoan)} />
            <Stat label="Down payment" value={`${money0(result.downPayment)} (${formatPercent(result.downPaymentPercent, 1)})`} />
            <Stat label="Monthly cost" value={formatMoney(result.monthly.total)} />
          </StatGrid>

          <table className="w-full max-w-xl border-collapse text-sm">
            <caption className="pb-2 text-left font-medium">Monthly cost at that price</caption>
            <tbody className="divide-y divide-border border-y border-border">
              {rows.map(([label, value]) => (
                <tr key={label as string}>
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    {label}
                  </th>
                  <td className="py-2 text-right font-mono tabular-nums">{formatMoney(value as number)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <th scope="row" className="py-2 pr-4 text-left font-medium">
                  Total
                </th>
                <td className="py-2 text-right font-mono tabular-nums">{formatMoney(result.monthly.total)}</td>
              </tr>
            </tbody>
          </table>

          <p className="text-sm text-muted-foreground">
            The {result.limitedBy === "front" ? "housing share" : "housing plus debts share"} is what sets the limit: {formatPercent(result.frontRatioPercent, 1)} of your income goes to housing and{" "}
            {formatPercent(result.backRatioPercent, 1)} to housing and debts together.
            {result.pmiApplies ? " Your down payment is under 20%, so mortgage insurance is included." : ""}
          </p>
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        This is an estimate from common lender rules, not an approval. Real limits also depend on credit score, savings, loan type and local taxes. Closing costs and upkeep are not included.
      </p>
    </div>
  );
}
