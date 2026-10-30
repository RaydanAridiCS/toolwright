"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, ResultSlab, Select, Toggle, cn, useShareableState } from "@toolwright/ui";
import { COMMON_ZONES, formatInZone, isValidZone, listTimeZones, planMeeting, type PlanResult, type SlotStatus } from "@toolwright/core/meeting-planner";
import { num } from "../../shared/number-field";

interface Person {
  zone: string;
  label: string;
  start: string;
  end: string;
}

const DEFAULTS: Person[] = [
  { zone: "America/New_York", label: "New York", start: "9", end: "17" },
  { zone: "Europe/London", label: "London", start: "9", end: "17" },
  { zone: "Asia/Kolkata", label: "Mumbai", start: "9", end: "17" },
];

const STATUS_CLASS: Record<SlotStatus, string> = { working: "bg-primary", edge: "bg-marker", outside: "bg-muted" };
const STATUS_TEXT: Record<SlotStatus, string> = { working: "Working hours", edge: "Possible", outside: "Off hours" };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Tool() {
  const { state, setState } = useShareableState({ date: "", duration: "60", people: DEFAULTS, hour12: false, weekends: false });
  const [adding, setAdding] = useState("");
  const zones = useMemo(() => listTimeZones(), []);
  const { date, duration, people, hour12, weekends } = state;

  // Today's date and the visitor's own zone are only known in the browser.
  useEffect(() => {
    if (!state.date) setState((s) => ({ ...s, date: today() }));
  }, [state.date, setState]);

  const setPerson = (i: number, patch: Partial<Person>) => setState((s) => ({ ...s, people: s.people.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const addZone = (zone: string, label?: string) => {
    const known = COMMON_ZONES.find((z) => z.zone === zone);
    setState((s) => ({ ...s, people: [...s.people, { zone, label: label ?? known?.label ?? zone.split("/").pop()?.replaceAll("_", " ") ?? zone, start: "9", end: "17" }] }));
  };

  const outcome = useMemo<{ plan: PlanResult } | { error: string } | null>(() => {
    if (!date) return null;
    try {
      return {
        plan: planMeeting(
          people.map((p) => ({ zone: p.zone.trim(), label: p.label, start: num(p.start), end: num(p.end) })),
          { date, durationMin: Math.round(num(duration)), workDays: weekends ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5] },
        ),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not plan that." };
    }
  }, [date, duration, people, weekends]);

  const plan = outcome && "plan" in outcome ? outcome.plan : null;
  const base = people[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-3">
        <Field label={`Date in ${base?.label || base?.zone || "the first city"}`}>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))} />}</Field>
        <Field label="Meeting length">
          {(id) => (
            <Select id={id} value={duration} onChange={(e) => setState((s) => ({ ...s, duration: e.target.value }))}>
              {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutes` : m % 60 ? `${m / 60} hours` : `${m / 60} hour${m === 60 ? "" : "s"}`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col justify-end gap-3">
          <Toggle label="12-hour clock" checked={hour12} onCheckedChange={(v) => setState((s) => ({ ...s, hour12: v }))} />
          <Toggle label="Count weekends as working days" checked={weekends} onCheckedChange={(v) => setState((s) => ({ ...s, weekends: v }))} />
        </div>
      </div>

      <datalist id="meeting-zones">
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
      <ol className="flex flex-col gap-3" aria-label="People">
        {people.map((p, i) => (
          <li key={i} className="grid gap-3 border border-border bg-card p-3 sm:grid-cols-[1fr_1.4fr_0.5fr_0.5fr_auto] sm:items-end">
            <Field label={`Person ${i + 1} name or city`}>{(id) => <Input id={id} value={p.label} onChange={(e) => setPerson(i, { label: e.target.value })} />}</Field>
            <Field label={`Person ${i + 1} time zone`} hint={!isValidZone(p.zone.trim()) ? "Not a time zone name. Pick one from the list." : undefined}>
              {(id) => <Input id={id} mono list="meeting-zones" value={p.zone} onChange={(e) => setPerson(i, { zone: e.target.value })} aria-invalid={!isValidZone(p.zone.trim())} />}
            </Field>
            <Field label={`Person ${i + 1} day starts`}>{(id) => <Input id={id} mono inputMode="decimal" value={p.start} onChange={(e) => setPerson(i, { start: e.target.value })} />}</Field>
            <Field label={`Person ${i + 1} day ends`}>{(id) => <Input id={id} mono inputMode="decimal" value={p.end} onChange={(e) => setPerson(i, { end: e.target.value })} />}</Field>
            <Button variant="ghost" size="icon" aria-label={`Remove person ${i + 1}`} disabled={people.length <= 1} onClick={() => setState((s) => ({ ...s, people: s.people.filter((_, j) => j !== i) }))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Add a city">
          {(id) => (
            <Select
              id={id}
              value={adding}
              disabled={people.length >= 12}
              onChange={(e) => {
                if (e.target.value) addZone(e.target.value);
                setAdding("");
              }}
            >
              <option value="">Choose…</option>
              {COMMON_ZONES.map((z) => (
                <option key={z.zone} value={z.zone}>
                  {z.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button variant="outline" size="sm" disabled={people.length >= 12} onClick={() => addZone("UTC", "UTC")}>
          <Plus /> Add a zone by name
        </Button>
        <p className="text-sm text-muted-foreground">Hours are local (for example 9 and 17, or 9.5 for 9:30). Type any IANA zone name, such as Africa/Nairobi.</p>
      </div>

      {outcome && "error" in outcome ? <Alert tone="error">{outcome.error}</Alert> : null}

      {plan ? (
        <>
          {plan.windows.length > 0 ? (
            <ResultSlab
              label="Everyone is working between"
              size="md"
              value={plan.windows.map((w) => `${formatInZone(base!.zone, w.startMs, hour12)} to ${formatInZone(base!.zone, w.endMs, hour12)}`).join(" · ")}
              note={`Shown in ${base?.label || base?.zone}. The meeting can start at any time in this window as long as it ends inside it.`}
              valueTestId="meeting-window"
            />
          ) : (
            <Alert tone="warning" title="No time suits everyone">
              Nobody is outside working hours at the same time here. The best compromises are listed below. Try a shorter meeting, wider hours, or a different day.
            </Alert>
          )}

          <section aria-labelledby="best-title" className="flex flex-col gap-3">
            <h3 id="best-title" className="font-display text-[17px] font-bold">
              {plan.compromise ? "Best compromises" : "Good times to propose"}
            </h3>
            <ol className="flex flex-col gap-3">
              {plan.best.map((slot) => (
                <li key={slot.startMs} className="border border-border bg-card">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">
                      Meeting at {formatInZone(base!.zone, slot.startMs, hour12)} in {base?.label || base?.zone}
                    </caption>
                    <thead className="sr-only">
                      <tr>
                        <th>Person</th>
                        <th>Local time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slot.zones.map((z) => (
                        <tr key={z.zone + z.label} className={cn("border-b border-border/50 last:border-b-0", z.status === "outside" && "text-danger")}>
                          <td className="px-3 py-2 font-medium">{z.label}</td>
                          <td className="px-3 py-2 font-mono">
                            {formatInZone(z.zone, slot.startMs, hour12)} to {formatInZone(z.zone, slot.endMs, hour12).replace(/^\w{3} /, "")}
                            {z.dayShift !== 0 ? <span className="ml-2 text-xs text-muted-foreground">{z.dayShift > 0 ? "next day" : "previous day"}</span> : null}
                          </td>
                          <td className="px-3 py-2">{STATUS_TEXT[z.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="day-title" className="flex flex-col gap-3">
            <h3 id="day-title" className="font-display text-[17px] font-bold">
              The whole day, in {base?.label || base?.zone} time
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(Object.keys(STATUS_CLASS) as SlotStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn("inline-block size-3 border border-foreground/40", STATUS_CLASS[s])} />
                  {STATUS_TEXT[s]}
                </span>
              ))}
            </div>
            <div aria-hidden className="flex flex-col gap-1.5">
              {people.map((p, pi) => (
                <div key={pi} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-xs">{p.label || p.zone}</span>
                  <div className="grid h-4 flex-1 gap-px" style={{ gridTemplateColumns: `repeat(${plan.slots.length}, minmax(0, 1fr))` }}>
                    {plan.slots.map((slot) => (
                      <span key={slot.startMs} className={STATUS_CLASS[slot.zones[pi]?.status ?? "outside"]} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pl-[6.5rem] font-mono text-[11px] text-muted-foreground">
                {[0, 0.25, 0.5, 0.75].map((f) => (
                  <span key={f}>{formatInZone(base!.zone, plan.slots[Math.floor(plan.slots.length * f)]!.startMs, hour12).replace(/^\w{3} /, "")}</span>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
