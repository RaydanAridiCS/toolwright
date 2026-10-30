import { describe, expect, it } from "vitest";
import { loanPayment } from "../src/calc";
import { mortgageAffordability, paymentFactor, type AffordabilityInput } from "../src/mortgage-affordability-calculator";

const base: AffordabilityInput = {
  annualIncome: 120000,
  monthlyDebts: 500,
  downPayment: 80000,
  annualRatePercent: 6.5,
  years: 30,
  propertyTaxPercent: 1.1,
  insuranceYearly: 1500,
  hoaMonthly: 0,
  pmiPercent: 0.5,
};

describe("paymentFactor", () => {
  it("matches the loan calculator", () => {
    expect(paymentFactor(6.5, 30) * 250000).toBeCloseTo(loanPayment(250000, 6.5, 30).payment, 6);
    expect(paymentFactor(3, 15) * 100000).toBeCloseTo(loanPayment(100000, 3, 15).payment, 6);
  });

  it("handles a zero rate", () => {
    expect(paymentFactor(0, 10) * 120000).toBeCloseTo(1000);
  });
});

describe("mortgageAffordability", () => {
  it("spends exactly the housing budget", () => {
    const r = mortgageAffordability(base);
    expect(r.viable).toBe(true);
    expect(r.monthly.total).toBeCloseTo(r.housingBudget, 6);
    expect(r.maxPrice).toBeCloseTo(r.maxLoan + base.downPayment, 6);
  });

  it("stays inside both ratios", () => {
    const r = mortgageAffordability(base);
    expect(r.frontRatioPercent).toBeLessThanOrEqual(28 + 1e-9);
    expect(r.backRatioPercent).toBeLessThanOrEqual(36 + 1e-9);
  });

  it("is limited by the back-end ratio when other debts are large", () => {
    const r = mortgageAffordability({ ...base, monthlyDebts: 1500 });
    expect(r.limitedBy).toBe("back");
    expect(r.housingBudget).toBeCloseTo(120000 / 12 * 0.36 - 1500, 6);
    expect(r.backRatioPercent).toBeCloseTo(36, 6);
  });

  it("is limited by the front-end ratio when debts are small", () => {
    const r = mortgageAffordability({ ...base, monthlyDebts: 0 });
    expect(r.limitedBy).toBe("front");
    expect(r.housingBudget).toBeCloseTo(2800, 6);
  });

  it("breaks the payment into its parts that add up", () => {
    const { monthly: m, maxLoan, maxPrice } = mortgageAffordability(base);
    expect(m.principalInterest).toBeCloseTo(loanPayment(maxLoan, 6.5, 30).payment, 4);
    expect(m.propertyTax).toBeCloseTo((maxPrice * 0.011) / 12, 6);
    expect(m.insurance).toBeCloseTo(125, 6);
    expect(m.principalInterest + m.propertyTax + m.insurance + m.hoa + m.pmi).toBeCloseTo(m.total, 8);
  });

  it("buys more with a bigger down payment", () => {
    const small = mortgageAffordability({ ...base, downPayment: 20000 });
    const big = mortgageAffordability({ ...base, downPayment: 120000 });
    expect(big.maxPrice).toBeGreaterThan(small.maxPrice);
  });

  it("buys less at a higher rate or shorter term", () => {
    const a = mortgageAffordability(base).maxPrice;
    expect(mortgageAffordability({ ...base, annualRatePercent: 8 }).maxPrice).toBeLessThan(a);
    expect(mortgageAffordability({ ...base, years: 15 }).maxPrice).toBeLessThan(a);
  });

  it("charges mortgage insurance only when the down payment is under 20%", () => {
    const low = mortgageAffordability({ ...base, downPayment: 10000 });
    expect(low.pmiApplies).toBe(true);
    expect(low.monthly.pmi).toBeCloseTo((low.maxLoan * 0.005) / 12, 6);
    expect(low.downPaymentPercent).toBeLessThan(20);

    const high = mortgageAffordability({ ...base, downPayment: 150000 });
    expect(high.pmiApplies).toBe(false);
    expect(high.monthly.pmi).toBe(0);
    expect(high.downPaymentPercent).toBeGreaterThanOrEqual(20);
  });

  it("does not jump across the 20% line", () => {
    // Around the 80% threshold the loan can sit exactly on it, where no insurance is due.
    const prices = [30000, 40000, 50000, 60000, 70000].map((down) => mortgageAffordability({ ...base, downPayment: down }));
    for (const r of prices) {
      expect(r.monthly.total).toBeLessThanOrEqual(r.housingBudget + 1e-6);
      if (!r.pmiApplies) expect(r.maxLoan / r.maxPrice).toBeLessThanOrEqual(0.8 + 1e-9);
    }
    for (let i = 1; i < prices.length; i++) expect((prices[i] as (typeof prices)[number]).maxPrice).toBeGreaterThanOrEqual((prices[i - 1] as (typeof prices)[number]).maxPrice);
  });

  it("works with no down payment", () => {
    const r = mortgageAffordability({ ...base, downPayment: 0 });
    expect(r.viable).toBe(true);
    expect(r.pmiApplies).toBe(true);
    expect(r.maxPrice).toBeCloseTo(r.maxLoan, 6);
    expect(r.monthly.total).toBeCloseTo(r.housingBudget, 6);
  });

  it("works at a zero interest rate and zero tax", () => {
    const r = mortgageAffordability({ ...base, annualRatePercent: 0, propertyTaxPercent: 0, insuranceYearly: 0, pmiPercent: 0, downPayment: 0, monthlyDebts: 0 });
    expect(r.maxLoan).toBeCloseTo(2800 * 360, 4);
  });

  it("counts HOA dues against the budget", () => {
    const without = mortgageAffordability(base).maxPrice;
    const withDues = mortgageAffordability({ ...base, hoaMonthly: 400 });
    expect(withDues.maxPrice).toBeLessThan(without);
    expect(withDues.monthly.total).toBeCloseTo(withDues.housingBudget, 6);
  });

  it("reports when nothing fits", () => {
    const r = mortgageAffordability({ ...base, monthlyDebts: 5000 });
    expect(r.viable).toBe(false);
    expect(r.maxPrice).toBe(0);
    expect(r.maxLoan).toBe(0);
    expect(r.housingBudget).toBe(0);

    const fixedCosts = mortgageAffordability({ ...base, hoaMonthly: 5000 });
    expect(fixedCosts.viable).toBe(false);
  });

  it("reports no room when taxes on the down payment alone exceed the budget", () => {
    const r = mortgageAffordability({ ...base, annualIncome: 12000, downPayment: 5_000_000 });
    expect(r.viable).toBe(false);
    expect(r.maxPrice).toBe(0);
  });

  it("respects custom ratios", () => {
    const strict = mortgageAffordability({ ...base, monthlyDebts: 0, frontRatioPercent: 20 });
    const loose = mortgageAffordability({ ...base, monthlyDebts: 0, frontRatioPercent: 35, backRatioPercent: 43 });
    expect(strict.housingBudget).toBeCloseTo(2000, 6);
    expect(loose.housingBudget).toBeCloseTo(3500, 6);
    expect(loose.maxPrice).toBeGreaterThan(strict.maxPrice);
  });

  it("scales with income", () => {
    const a = mortgageAffordability({ ...base, downPayment: 0, annualIncome: 60000, monthlyDebts: 0 });
    const b = mortgageAffordability({ ...base, downPayment: 0, annualIncome: 120000, monthlyDebts: 0 });
    expect(b.maxPrice).toBeGreaterThan(a.maxPrice * 1.8);
  });
});

describe("validation", () => {
  it.each([
    [{ annualIncome: 0 }, /income above zero/],
    [{ annualIncome: NaN }, /valid amount/],
    [{ monthlyDebts: -1 }, /negative/],
    [{ downPayment: -1 }, /negative/],
    [{ annualRatePercent: 41 }, /interest rate/],
    [{ annualRatePercent: -1 }, /interest rate/],
    [{ years: 0 }, /term/],
    [{ years: 51 }, /term/],
    [{ frontRatioPercent: 0 }, /Ratios/],
    [{ backRatioPercent: 101 }, /Ratios/],
    [{ propertyTaxPercent: 11 }, /typo/],
    [{ insuranceYearly: Infinity }, /valid amount/],
  ] as [Partial<AffordabilityInput>, RegExp][])("rejects %j", (patch, message) => {
    expect(() => mortgageAffordability({ ...base, ...patch })).toThrow(message);
  });
});
