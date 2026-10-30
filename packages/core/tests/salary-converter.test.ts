import { describe, expect, it } from "vitest";
import { PAY_PERIODS, convertPay, resolveSchedule } from "../src/salary-converter";

describe("convertPay", () => {
  it("converts an hourly wage with the standard 40-hour week", () => {
    const t = convertPay(25, "hourly");
    expect(t.weekly).toBeCloseTo(1000);
    expect(t.biweekly).toBeCloseTo(2000);
    expect(t.semimonthly).toBeCloseTo(2166.6667, 3);
    expect(t.monthly).toBeCloseTo(4333.3333, 3);
    expect(t.quarterly).toBeCloseTo(13000);
    expect(t.yearly).toBeCloseTo(52000);
    expect(t.daily).toBeCloseTo(200);
  });

  it("converts a yearly salary back to hourly", () => {
    const t = convertPay(104000, "yearly");
    expect(t.hourly).toBeCloseTo(50);
    expect(t.weekly).toBeCloseTo(2000);
  });

  it("returns the same amount for the period you started from", () => {
    for (const p of PAY_PERIODS) expect(convertPay(1234.56, p)[p]).toBeCloseTo(1234.56, 8);
  });

  it("round-trips between any two periods", () => {
    for (const a of PAY_PERIODS) {
      for (const b of PAY_PERIODS) {
        const there = convertPay(100, a)[b];
        expect(convertPay(there, b)[a]).toBeCloseTo(100, 8);
      }
    }
  });

  it("uses the schedule", () => {
    const t = convertPay(30, "hourly", { hoursPerWeek: 35, weeksPerYear: 50, daysPerWeek: 4 });
    expect(t.yearly).toBeCloseTo(52500);
    expect(t.weekly).toBeCloseTo(1050);
    expect(t.daily).toBeCloseTo(262.5);
    expect(t.biweekly).toBeCloseTo(2100);
  });

  it("handles zero and very large pay", () => {
    expect(convertPay(0, "yearly").hourly).toBe(0);
    expect(convertPay(1e12, "yearly").monthly).toBeCloseTo(1e12 / 12, 0);
  });

  it("handles fractional schedules", () => {
    expect(convertPay(20, "hourly", { hoursPerWeek: 37.5 }).weekly).toBeCloseTo(750);
  });

  it("rejects bad amounts", () => {
    expect(() => convertPay(-1, "hourly")).toThrow(/zero or more/);
    expect(() => convertPay(NaN, "hourly")).toThrow(RangeError);
    expect(() => convertPay(Infinity, "yearly")).toThrow(RangeError);
  });

  it("rejects impossible schedules", () => {
    expect(() => resolveSchedule({ hoursPerWeek: 0 })).toThrow(/Hours per week/);
    expect(() => resolveSchedule({ hoursPerWeek: 169 })).toThrow(/Hours per week/);
    expect(() => resolveSchedule({ daysPerWeek: 8 })).toThrow(/Days per week/);
    expect(() => resolveSchedule({ weeksPerYear: 0 })).toThrow(/Paid weeks/);
    expect(() => resolveSchedule({ weeksPerYear: 60 })).toThrow(/Paid weeks/);
    expect(() => resolveSchedule({ hoursPerWeek: NaN })).toThrow(RangeError);
  });

  it("fills in defaults", () => {
    expect(resolveSchedule()).toEqual({ hoursPerWeek: 40, daysPerWeek: 5, weeksPerYear: 52 });
  });
});
