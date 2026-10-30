import { describe, expect, it } from "vitest";
import { formatInZone, isValidZone, listTimeZones, localParts, offsetMinutes, planMeeting, type Participant } from "../src/meeting-planner";

const person = (zone: string, start = 9, end = 17, label?: string): Participant => ({ zone, start, end, label });
const utcHour = (ms: number) => new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;

describe("time zone helpers", () => {
  it("knows offsets, including half-hour zones and daylight saving time", () => {
    const jan = Date.UTC(2026, 0, 15, 12);
    const jul = Date.UTC(2026, 6, 15, 12);
    expect(offsetMinutes("UTC", jan)).toBe(0);
    expect(offsetMinutes("America/New_York", jan)).toBe(-300);
    expect(offsetMinutes("America/New_York", jul)).toBe(-240);
    expect(offsetMinutes("Europe/London", jan)).toBe(0);
    expect(offsetMinutes("Europe/London", jul)).toBe(60);
    expect(offsetMinutes("Asia/Kolkata", jan)).toBe(330);
    expect(offsetMinutes("Asia/Tokyo", jul)).toBe(540);
    expect(offsetMinutes("Australia/Sydney", jan)).toBe(660);
    expect(offsetMinutes("Australia/Sydney", jul)).toBe(600);
  });

  it("reads the wall clock and the weekday", () => {
    const l = localParts("America/New_York", Date.UTC(2026, 0, 15, 14, 30));
    expect(l).toEqual({ year: 2026, month: 1, day: 15, hour: 9, minute: 30, weekday: 4 });
    expect(localParts("UTC", Date.UTC(2026, 0, 15, 0, 0)).hour).toBe(0);
  });

  it("validates zone names and lists many of them", () => {
    expect(isValidZone("Europe/London")).toBe(true);
    expect(isValidZone("Mars/Olympus")).toBe(false);
    expect(isValidZone("")).toBe(false);
    expect(listTimeZones().length).toBeGreaterThan(20);
    expect(listTimeZones()).toContain("UTC");
  });

  it("formats a time in a zone", () => {
    expect(formatInZone("America/New_York", Date.UTC(2026, 0, 15, 14, 0))).toBe("Thu 09:00");
    expect(formatInZone("America/New_York", Date.UTC(2026, 0, 15, 19, 0), true)).toBe("Thu 2:00 PM");
  });
});

describe("planMeeting: finding overlap", () => {
  it("finds 14:00-17:00 UTC when New York and London both work 9-17 in winter", () => {
    const r = planMeeting([person("America/New_York"), person("Europe/London")], { date: "2026-01-15" });
    expect(r.compromise).toBe(false);
    expect(r.windows).toHaveLength(1);
    expect(utcHour(r.windows[0]!.startMs)).toBe(14);
    expect(utcHour(r.windows[0]!.endMs)).toBe(17);
    // A one-hour meeting can start at 14:00, 14:30, 15:00, 15:30 or 16:00 (UTC).
    expect(r.slots.filter((s) => s.allWorking).map((s) => utcHour(s.startMs))).toEqual([14, 14.5, 15, 15.5, 16]);
    expect(utcHour(r.best[0]!.startMs)).toBe(15);
  });

  it("moves the window in summer because the two zones change their clocks on different dates", () => {
    const r = planMeeting([person("America/New_York"), person("Europe/London")], { date: "2026-07-15" });
    expect(utcHour(r.windows[0]!.startMs)).toBe(13);
    expect(utcHour(r.windows[0]!.endMs)).toBe(16);
  });

  it("uses the clocks of the in-between weeks, when the US has changed and Europe has not", () => {
    // US clocks go forward on 8 March 2026, the UK's on 29 March: for three weeks New York is only 4 hours behind London (a Monday).
    const r = planMeeting([person("America/New_York"), person("Europe/London")], { date: "2026-03-16" });
    expect(utcHour(r.windows[0]!.startMs)).toBe(13);
    expect(utcHour(r.windows[0]!.endMs)).toBe(17);
  });

  it("handles half-hour zones and three people", () => {
    const r = planMeeting([person("Europe/London"), person("Asia/Kolkata"), person("Asia/Dubai", 8, 18)], { date: "2026-01-15", durationMin: 30 });
    // London works 9-17 (UTC), Kolkata 9-17 is 03:30-11:30 UTC, Dubai 8-18 is 04:00-14:00 UTC: all overlap at 09:00-11:30.
    expect(r.windows).toHaveLength(1);
    expect(utcHour(r.windows[0]!.startMs)).toBe(9);
    expect(utcHour(r.windows[0]!.endMs)).toBe(11.5);
  });

  it("reports the local time and day for each person", () => {
    const r = planMeeting([person("America/New_York"), person("Asia/Tokyo")], { date: "2026-01-15", durationMin: 60 });
    const slot = r.slots.find((s) => s.zones[0]?.start === "19:00")!;
    expect(slot.zones[0]).toMatchObject({ start: "19:00", end: "20:00", dayShift: 0, status: "edge" });
    expect(slot.zones[1]).toMatchObject({ start: "09:00", end: "10:00", dayShift: 1, status: "working" });
  });

  it("offers compromises, best first, when no time suits everyone", () => {
    const r = planMeeting([person("America/New_York"), person("Asia/Tokyo")], { date: "2026-01-15" });
    expect(r.windows).toEqual([]);
    expect(r.compromise).toBe(true);
    expect(r.best.length).toBeGreaterThan(0);
    const first = r.best[0]!;
    expect(first.workingCount).toBe(1);
    // Nobody is at their worst: both are at least within reasonable hours where possible.
    expect(first.zones.filter((z) => z.status === "outside").length).toBeLessThanOrEqual(r.best[r.best.length - 1]!.zones.filter((z) => z.status === "outside").length);
  });

  it("treats weekends as days off", () => {
    const sat = planMeeting([person("Europe/London"), person("Europe/Paris")], { date: "2026-01-17" });
    expect(sat.windows).toEqual([]);
    const withSaturday = planMeeting([person("Europe/London"), person("Europe/Paris")], { date: "2026-01-17", workDays: [1, 2, 3, 4, 5, 6] });
    expect(withSaturday.windows.length).toBe(1);
  });

  it("respects each person's own hours and the meeting length", () => {
    const early = planMeeting([person("Europe/London", 8, 12), person("Europe/Paris", 10, 18)], { date: "2026-01-15", durationMin: 60 });
    // London 8-12 is 08-12 UTC; Paris 10-18 is 09-17 UTC. Overlap 09:00-12:00 UTC.
    expect(utcHour(early.windows[0]!.startMs)).toBe(9);
    expect(utcHour(early.windows[0]!.endMs)).toBe(12);
    const long = planMeeting([person("Europe/London"), person("Europe/Paris")], { date: "2026-01-15", durationMin: 120 });
    expect(utcHour(long.windows[0]!.startMs)).toBe(9);
  });

  it("plans a single person, and tries every quarter hour on request", () => {
    expect(planMeeting([person("UTC")], { date: "2026-01-15" }).windows).toHaveLength(1);
    const fine = planMeeting([person("UTC"), person("Europe/London")], { date: "2026-01-15", stepMin: 15 });
    expect(fine.slots.filter((s) => s.allWorking).length).toBe(29);
  });
});

describe("planMeeting: daylight saving days", () => {
  it("has 23 hours on the day the US clocks go forward", () => {
    const r = planMeeting([person("America/New_York")], { date: "2026-03-08", stepMin: 60, durationMin: 60 });
    expect(r.slots).toHaveLength(23);
  });

  it("has 25 hours on the day the US clocks go back", () => {
    const r = planMeeting([person("America/New_York")], { date: "2026-11-01", stepMin: 60, durationMin: 60 });
    expect(r.slots).toHaveLength(25);
  });

  it("covers a normal day with 48 half-hour starts", () => {
    expect(planMeeting([person("Asia/Tokyo")], { date: "2026-06-01" }).slots).toHaveLength(48);
  });
});

describe("planMeeting: bad input", () => {
  const two = [person("UTC"), person("Europe/London")];

  it("explains each kind of mistake", () => {
    expect(() => planMeeting([], { date: "2026-01-15" })).toThrow(/at least one person/);
    expect(() => planMeeting(two, { date: "15/01/2026" })).toThrow(/year-month-day/);
    expect(() => planMeeting(two, { date: "2026-02-30" })).toThrow(/not a real date/);
    expect(() => planMeeting([person("Mars/Base")], { date: "2026-01-15" })).toThrow(/not a time zone name/);
    expect(() => planMeeting([person("UTC", 17, 9)], { date: "2026-01-15" })).toThrow(/start before it ends/);
    expect(() => planMeeting([person("UTC", 9, 9.5)], { date: "2026-01-15", durationMin: 60 })).toThrow(/shorter than/);
    expect(() => planMeeting(two, { date: "2026-01-15", durationMin: 5 })).toThrow(/between 15 minutes and 8 hours/);
    expect(() => planMeeting(two, { date: "2026-01-15", stepMin: 7 })).toThrow(/every 15, 30 or 60/);
    expect(() => planMeeting(Array.from({ length: 13 }, () => person("UTC")), { date: "2026-01-15" })).toThrow(/12 time zones/);
  });
});
