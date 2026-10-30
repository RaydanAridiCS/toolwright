"use client";

import { useMemo, useState } from "react";
import { Alert, ResultSlab, SegmentedControl, Stat, StatGrid, cn } from "@toolwright/ui";
import { BMI_CATEGORIES, BMI_CAVEATS, calculateBmi, feetInchesToCm, kgToLb, lbToKg, type BmiResult } from "@toolwright/core/bmi-calculator";
import { NumberField, num } from "../../shared/number-field";

type System = "metric" | "imperial";

const bandLabel = (from: number, next: number | undefined) => (next === undefined ? `${from} and over` : from === 0 ? `Under ${next}` : `${from} to ${(next - 0.1).toFixed(1)}`);

export default function Tool() {
  // Plain state, not the URL: height and weight are personal health information.
  const [system, setSystem] = useState<System>("metric");
  const [cm, setCm] = useState("175");
  const [kg, setKg] = useState("70");
  const [feet, setFeet] = useState("5");
  const [inches, setInches] = useState("9");
  const [lb, setLb] = useState("154");
  const [age, setAge] = useState("");

  const outcome = useMemo<{ result: BmiResult } | { error: string } | { empty: true }>(() => {
    const heightCm = system === "metric" ? num(cm) : feetInchesToCm(num(feet), num(inches) || 0);
    const weightKg = system === "metric" ? num(kg) : lbToKg(num(lb));
    if (Number.isNaN(heightCm) || Number.isNaN(weightKg)) return { empty: true };
    try {
      return { result: calculateBmi({ weightKg, heightCm, ageYears: age.trim() ? num(age) : undefined }) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not calculate that." };
    }
  }, [system, cm, kg, feet, inches, lb, age]);

  const result = "result" in outcome ? outcome.result : null;
  const weight = (value: number) => (system === "metric" ? `${value.toFixed(1)} kg` : `${kgToLb(value).toFixed(1)} lb`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 border border-border bg-card p-4">
        <SegmentedControl
          label="Units"
          value={system}
          onValueChange={setSystem}
          options={[
            { value: "metric", label: "Metric (cm, kg)" },
            { value: "imperial", label: "Imperial (ft, in, lb)" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {system === "metric" ? (
            <>
              <NumberField label="Height" suffix="cm" value={cm} onChange={setCm} min={100} max={250} />
              <NumberField label="Weight" suffix="kg" value={kg} onChange={setKg} min={20} max={500} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Height" suffix="ft" value={feet} onChange={setFeet} min={3} max={8} step={1} />
                <NumberField label="Inches" suffix="in" value={inches} onChange={setInches} min={0} max={11.9} />
              </div>
              <NumberField label="Weight" suffix="lb" value={lb} onChange={setLb} min={44} max={1100} />
            </>
          )}
          <NumberField label="Age (optional)" suffix="years" value={age} onChange={setAge} min={0} max={120} step={1} hint="BMI categories are for adults (18 and over)." />
        </div>
      </div>

      {"error" in outcome ? <Alert tone="error">{outcome.error}</Alert> : null}
      {"empty" in outcome ? <Alert tone="info">Enter your height and weight.</Alert> : null}

      {result ? (
        <>
          <ResultSlab label="Your BMI" value={result.bmi.toFixed(1)} note={`${result.category.label} on the WHO adult scale.`} valueTestId="bmi-value" />
          <StatGrid className="sm:grid-cols-3 lg:grid-cols-3">
            <Stat label="Healthy weight for your height" value={`${weight(result.healthyWeightKg.min)} to ${weight(result.healthyWeightKg.max)}`} />
            <Stat
              label={result.kgFromHealthyRange > 0 ? "Above that range by" : result.kgFromHealthyRange < 0 ? "Below that range by" : "Position"}
              value={result.kgFromHealthyRange === 0 ? "Inside the range" : weight(Math.abs(result.kgFromHealthyRange))}
            />
            <Stat label="Healthy BMI range" value="18.5 to 24.9" />
          </StatGrid>

          <div className="border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">WHO adult BMI categories</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-normal">Category</th>
                  <th className="px-3 py-2 font-normal">BMI</th>
                </tr>
              </thead>
              <tbody>
                {BMI_CATEGORIES.map((c, i) => (
                  <tr key={c.id} className={cn("border-b border-border/50 last:border-b-0", c.id === result.category.id && "bg-marker text-marker-foreground")} aria-current={c.id === result.category.id ? "true" : undefined}>
                    <td className="px-3 py-2">{c.label}</td>
                    <td className="px-3 py-2 font-mono">{bandLabel(c.from, BMI_CATEGORIES[i + 1]?.from)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <Alert tone="info" title="What BMI cannot tell you">
        <ul className="mt-1 list-disc pl-5">
          {BMI_CAVEATS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}
