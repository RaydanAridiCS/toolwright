/**
 * Find a time that works for people in different time zones. For one calendar day it tries every half hour (or
 * quarter, or hour), checks whether each person is inside their working hours, and lists the windows that suit everyone.
 * Time zone data comes from the platform's Intl, so daylight saving time is handled for the real date.
 * Keep this file free of React, the DOM and the network.
 */

export interface Participant {
  /** IANA name, such as Europe/London. */
  zone: string;
  label?: string;
  /** Start of the working day in local hours, 0 to 24 (9 or 9.5). */
  start: number;
  /** End of the working day in local hours. */
  end: number;
}

export interface PlannerOptions {
  /** The day to plan, as YYYY-MM-DD, in the first participant's time zone. */
  date: string;
  /** Length of the meeting in minutes. Default 60. */
  durationMin?: number;
  /** How far apart the start times tried are, in minutes. Default 30. */
  stepMin?: number;
  /** Days of the week people work, 0 (Sunday) to 6. Default Monday to Friday. */
  workDays?: number[];
  /** Outside working hours, a time is "edge" (possible but not great) from this local hour... */
  earliest?: number;
  /** ...until this one. Default 7 to 21. */
  latest?: number;
}

export type SlotStatus = "working" | "edge" | "outside";

export interface SlotZone {
  zone: string;
  label: string;
  /** Local start time, HH:MM. */
  start: string;
  /** Local end time, HH:MM. */
  end: string;
  /** Days from the first participant's date: -1 is the day before, 1 the day after. */
  dayShift: number;
  weekday: number;
  status: SlotStatus;
}

export interface Slot {
  startMs: number;
  endMs: number;
  zones: SlotZone[];
  workingCount: number;
  /** Everyone is inside working hours. */
  allWorking: boolean;
  /** Nobody is in the middle of the night. */
  allReasonable: boolean;
}

export interface Window {
  startMs: number;
  endMs: number;
}

export interface PlanResult {
  slots: Slot[];
  /** Runs of consecutive start times that suit everyone, merged. */
  windows: Window[];
  /** The best slots to propose: the most central ones where everyone works, or the best compromises. */
  best: Slot[];
  /** True when `best` are compromises because no time suits everyone. */
  compromise: boolean;
}

export const COMMON_ZONES: { zone: string; label: string }[] = [
  { zone: "America/Los_Angeles", label: "Los Angeles" },
  { zone: "America/Denver", label: "Denver" },
  { zone: "America/Chicago", label: "Chicago" },
  { zone: "America/New_York", label: "New York" },
  { zone: "America/Sao_Paulo", label: "São Paulo" },
  { zone: "Europe/London", label: "London" },
  { zone: "Europe/Paris", label: "Paris" },
  { zone: "Europe/Berlin", label: "Berlin" },
  { zone: "Europe/Athens", label: "Athens" },
  { zone: "Africa/Cairo", label: "Cairo" },
  { zone: "Africa/Lagos", label: "Lagos" },
  { zone: "Africa/Johannesburg", label: "Johannesburg" },
  { zone: "Asia/Dubai", label: "Dubai" },
  { zone: "Asia/Karachi", label: "Karachi" },
  { zone: "Asia/Kolkata", label: "Mumbai, Delhi" },
  { zone: "Asia/Dhaka", label: "Dhaka" },
  { zone: "Asia/Bangkok", label: "Bangkok" },
  { zone: "Asia/Singapore", label: "Singapore" },
  { zone: "Asia/Shanghai", label: "Beijing, Shanghai" },
  { zone: "Asia/Tokyo", label: "Tokyo" },
  { zone: "Asia/Seoul", label: "Seoul" },
  { zone: "Australia/Sydney", label: "Sydney" },
  { zone: "Pacific/Auckland", label: "Auckland" },
  { zone: "Pacific/Honolulu", label: "Honolulu" },
];

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Every time zone name the platform knows, or the common ones where that is not available. */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    const all = intl.supportedValuesOf?.("timeZone");
    if (all?.length) return all.includes("UTC") ? all : [...all, "UTC"];
  } catch {
    // fall through
  }
  return [...COMMON_ZONES.map((z) => z.zone), "UTC"];
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short" });
    formatters.set(zone, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Local {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** What the clocks on the wall in `zone` show at this instant. */
export function localParts(zone: string, ms: number): Local {
  const out: Record<string, string> = {};
  for (const p of formatter(zone).formatToParts(new Date(ms))) out[p.type] = p.value;
  return { year: Number(out.year), month: Number(out.month), day: Number(out.day), hour: Number(out.hour) % 24, minute: Number(out.minute), weekday: WEEKDAYS.indexOf(out.weekday as string) };
}

/** Minutes the zone is ahead of UTC at this instant (negative when behind). */
export function offsetMinutes(zone: string, ms: number): number {
  const l = localParts(zone, ms);
  const minute = Math.floor(ms / 60000) * 60000;
  return Math.round((Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute) - minute) / 60000);
}

/** The instant a calendar day starts in a zone. */
function startOfDay(zone: string, year: number, month: number, day: number): number {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - offsetMinutes(zone, guess) * 60000;
  t = guess - offsetMinutes(zone, t) * 60000;
  return t;
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (minutes: number) => `${pad(Math.floor(((minutes % 1440) + 1440) % 1440 / 60))}:${pad(((minutes % 60) + 60) % 60)}`;

/** A time in a zone for display, such as "Thu 14:00" (or "Thu 2:00 PM"). */
export function formatInZone(zone: string, ms: number, hour12 = false): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: hour12 ? "numeric" : "2-digit", minute: "2-digit", hourCycle: hour12 ? "h12" : "h23" }).format(new Date(ms));
}

function parseDate(date: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error("Enter the date as year-month-day, for example 2026-03-15.");
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error(`${date} is not a real date.`);
  return { year, month, day };
}

/** Plan one day. Throws readable errors for bad input. */
export function planMeeting(participants: Participant[], options: PlannerOptions): PlanResult {
  if (participants.length < 1) throw new Error("Add at least one person.");
  if (participants.length > 12) throw new Error("Plan for 12 time zones or fewer.");
  const durationMin = options.durationMin ?? 60;
  const stepMin = options.stepMin ?? 30;
  const workDays = options.workDays ?? [1, 2, 3, 4, 5];
  const earliest = options.earliest ?? 7;
  const latest = options.latest ?? 21;
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 480) throw new Error("The meeting should last between 15 minutes and 8 hours.");
  if (![15, 30, 60].includes(stepMin)) throw new Error("Try start times every 15, 30 or 60 minutes.");

  for (const [i, p] of participants.entries()) {
    if (!isValidZone(p.zone)) throw new Error(`“${p.zone}” is not a time zone name. Try something like Europe/London or America/New_York.`);
    if (!(p.start >= 0 && p.end <= 24 && p.start < p.end)) throw new Error(`${p.label || p.zone}: the working day must start before it ends (hours between 0 and 24).`);
    if ((p.end - p.start) * 60 < durationMin) throw new Error(`${p.label || p.zone}: a working day of ${p.end - p.start} hours is shorter than the ${durationMin}-minute meeting.`);
    void i;
  }

  const { year, month, day } = parseDate(options.date);
  const base = participants[0] as Participant;
  const dayStart = startOfDay(base.zone, year, month, day);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const dayEnd = startOfDay(base.zone, next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  const baseDay = Date.UTC(year, month - 1, day);

  const slots: Slot[] = [];
  for (let t = dayStart; t + durationMin * 60000 <= dayEnd + durationMin * 60000 && t < dayEnd; t += stepMin * 60000) {
    const zones: SlotZone[] = participants.map((p) => {
      const l = localParts(p.zone, t);
      const startMin = l.hour * 60 + l.minute;
      const endMin = startMin + durationMin;
      const onWorkDay = workDays.includes(l.weekday);
      let status: SlotStatus = "outside";
      if (onWorkDay && startMin >= p.start * 60 && endMin <= p.end * 60) status = "working";
      else if (onWorkDay && startMin >= earliest * 60 && endMin <= latest * 60) status = "edge";
      return {
        zone: p.zone,
        label: p.label?.trim() || p.zone,
        start: clock(startMin),
        end: clock(endMin),
        dayShift: Math.round((Date.UTC(l.year, l.month - 1, l.day) - baseDay) / 86400000),
        weekday: l.weekday,
        status,
      };
    });
    const workingCount = zones.filter((z) => z.status === "working").length;
    slots.push({ startMs: t, endMs: t + durationMin * 60000, zones, workingCount, allWorking: workingCount === zones.length, allReasonable: zones.every((z) => z.status !== "outside") });
  }

  const windows: Window[] = [];
  for (const slot of slots) {
    if (!slot.allWorking) continue;
    const last = windows[windows.length - 1];
    if (last && slot.startMs <= last.endMs) last.endMs = Math.max(last.endMs, slot.endMs);
    else windows.push({ startMs: slot.startMs, endMs: slot.endMs });
  }

  // How far a slot's middle is from the middle of everyone's working day: smaller is more comfortable.
  const offCentre = (slot: Slot) =>
    Math.max(
      ...slot.zones.map((z, i) => {
        const p = participants[i] as Participant;
        const [h, m] = z.start.split(":").map(Number) as [number, number];
        const mid = h * 60 + m + durationMin / 2;
        return Math.abs(mid - ((p.start + p.end) / 2) * 60);
      }),
    );
  const good = slots.filter((s) => s.allWorking).sort((a, b) => offCentre(a) - offCentre(b) || a.startMs - b.startMs);
  if (good.length) return { slots, windows, best: good.slice(0, 6), compromise: false };

  const outside = (s: Slot) => s.zones.filter((z) => z.status === "outside").length;
  const compromises = [...slots].sort((a, b) => outside(a) - outside(b) || b.workingCount - a.workingCount || offCentre(a) - offCentre(b) || a.startMs - b.startMs);
  return { slots, windows, best: compromises.slice(0, 6), compromise: true };
}
