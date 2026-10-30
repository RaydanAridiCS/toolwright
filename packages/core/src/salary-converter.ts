/** Convert pay between hourly, weekly, monthly, yearly and other periods. Keep this file free of React, the DOM and the network. */

export type PayPeriod = "hourly" | "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "yearly";

export const PAY_PERIODS: readonly PayPeriod[] = ["hourly", "daily", "weekly", "biweekly", "semimonthly", "monthly", "quarterly", "yearly"];

export const PERIOD_LABELS: Record<PayPeriod, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export interface WorkSchedule {
  /** Paid hours in a working week (default 40). */
  hoursPerWeek?: number;
  /** Working days in a week (default 5). */
  daysPerWeek?: number;
  /** Paid weeks in a year (default 52). Use 50 for two unpaid weeks. */
  weeksPerYear?: number;
}

export type PayTable = Record<PayPeriod, number>;

/** Pay for one period, as a share of a year's pay, given a schedule. */
function periodsPerYear(period: PayPeriod, s: Required<WorkSchedule>): number {
  switch (period) {
    case "hourly":
      return s.hoursPerWeek * s.weeksPerYear;
    case "daily":
      return s.daysPerWeek * s.weeksPerYear;
    case "weekly":
      return s.weeksPerYear;
    case "biweekly":
      return s.weeksPerYear / 2;
    case "semimonthly":
      return 24;
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "yearly":
      return 1;
  }
}

export function resolveSchedule(schedule: WorkSchedule = {}): Required<WorkSchedule> {
  const s = { hoursPerWeek: schedule.hoursPerWeek ?? 40, daysPerWeek: schedule.daysPerWeek ?? 5, weeksPerYear: schedule.weeksPerYear ?? 52 };
  if (!Number.isFinite(s.hoursPerWeek) || s.hoursPerWeek <= 0 || s.hoursPerWeek > 168) throw new RangeError("Hours per week must be between 0 and 168.");
  if (!Number.isFinite(s.daysPerWeek) || s.daysPerWeek <= 0 || s.daysPerWeek > 7) throw new RangeError("Days per week must be between 0 and 7.");
  if (!Number.isFinite(s.weeksPerYear) || s.weeksPerYear <= 0 || s.weeksPerYear > 52.18) throw new RangeError("Paid weeks per year must be between 0 and 52.");
  return s;
}

/** Express one amount of pay in every period. Amounts are not rounded. */
export function convertPay(amount: number, from: PayPeriod, schedule: WorkSchedule = {}): PayTable {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Enter an amount of zero or more.");
  const s = resolveSchedule(schedule);
  const yearly = amount * periodsPerYear(from, s);
  const out = {} as PayTable;
  for (const p of PAY_PERIODS) out[p] = yearly / periodsPerYear(p, s);
  return out;
}
