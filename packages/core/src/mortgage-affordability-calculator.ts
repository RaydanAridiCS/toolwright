/**
 * How much house can this income carry? Uses the usual lender rules of thumb:
 * housing costs stay under a share of gross income (front-end ratio, 28% by default), and housing plus
 * other debts stay under a larger share (back-end ratio, 36% by default).
 * Keep this file free of React, the DOM and the network.
 */

export interface AffordabilityInput {
  /** Gross (before tax) yearly income of everyone on the loan. */
  annualIncome: number;
  /** Monthly payments on other debts: cars, cards, student loans. */
  monthlyDebts: number;
  /** Cash available for the down payment. */
  downPayment: number;
  annualRatePercent: number;
  years: number;
  /** Yearly property tax as a percent of the price. */
  propertyTaxPercent: number;
  insuranceYearly: number;
  hoaMonthly: number;
  /** Yearly mortgage insurance as a percent of the loan, charged while the down payment is under 20%. */
  pmiPercent: number;
  /** Housing costs as a percent of gross monthly income (default 28). */
  frontRatioPercent?: number;
  /** Housing plus other debts as a percent of gross monthly income (default 36). */
  backRatioPercent?: number;
}

export interface MonthlyBreakdown {
  principalInterest: number;
  propertyTax: number;
  insurance: number;
  hoa: number;
  pmi: number;
  total: number;
}

export interface AffordabilityResult {
  /** Highest price that fits. 0 when nothing fits. */
  maxPrice: number;
  maxLoan: number;
  downPayment: number;
  downPaymentPercent: number;
  monthly: MonthlyBreakdown;
  /** Most that can go to housing each month, under whichever ratio is tighter. */
  housingBudget: number;
  limitedBy: "front" | "back";
  pmiApplies: boolean;
  /** Housing share of gross monthly income at the maximum price. */
  frontRatioPercent: number;
  /** Housing plus other debts as a share of gross monthly income. */
  backRatioPercent: number;
  /** False when income, debts and fixed costs leave nothing for a mortgage. */
  viable: boolean;
}

const finite = (n: number) => Number.isFinite(n);

/** Monthly payment per dollar borrowed. */
export function paymentFactor(annualRatePercent: number, years: number): number {
  const n = years * 12;
  const r = annualRatePercent / 1200;
  return r === 0 ? 1 / n : r / (1 - Math.pow(1 + r, -n));
}

function validate(i: AffordabilityInput) {
  const need = (ok: boolean, message: string) => {
    if (!ok) throw new RangeError(message);
  };
  const front = i.frontRatioPercent ?? 28;
  const back = i.backRatioPercent ?? 36;
  need([i.annualIncome, i.monthlyDebts, i.downPayment, i.annualRatePercent, i.years, i.propertyTaxPercent, i.insuranceYearly, i.hoaMonthly, i.pmiPercent, front, back].every(finite), "Fill in every number with a valid amount.");
  need(i.annualIncome > 0, "Enter a yearly income above zero.");
  need(i.monthlyDebts >= 0 && i.downPayment >= 0 && i.insuranceYearly >= 0 && i.hoaMonthly >= 0 && i.propertyTaxPercent >= 0 && i.pmiPercent >= 0, "Amounts cannot be negative.");
  need(i.annualRatePercent >= 0 && i.annualRatePercent <= 40, "The interest rate should be between 0% and 40%.");
  need(i.years >= 1 && i.years <= 50, "The loan term should be between 1 and 50 years.");
  need(front > 0 && front <= 100 && back > 0 && back <= 100, "Ratios must be between 1% and 100%.");
  need(i.propertyTaxPercent <= 10 && i.pmiPercent <= 10, "Tax and mortgage insurance rates above 10% are probably a typo.");
  return { front, back };
}

export function mortgageAffordability(input: AffordabilityInput): AffordabilityResult {
  const { front, back } = validate(input);
  const monthlyIncome = input.annualIncome / 12;
  const frontLimit = (monthlyIncome * front) / 100;
  const backLimit = (monthlyIncome * back) / 100 - input.monthlyDebts;
  const limitedBy = frontLimit <= backLimit ? "front" : "back";
  const housingBudget = Math.max(0, Math.min(frontLimit, backLimit));

  const f = paymentFactor(input.annualRatePercent, input.years);
  const tax = input.propertyTaxPercent / 1200; // per dollar of price, per month
  const pmi = input.pmiPercent / 1200; // per dollar of loan, per month
  const fixed = input.insuranceYearly / 12 + input.hoaMonthly;
  const down = input.downPayment;
  const budget = housingBudget - fixed;

  // Loan L at price P = L + down: budget = L*f + tax*(L + down) + pmi*L (when the loan is over 80% of the price).
  const solve = (withPmi: boolean) => Math.max(0, (budget - tax * down) / (f + tax + (withPmi ? pmi : 0)));
  const ltv = (loan: number) => (loan + down > 0 ? loan / (loan + down) : 0);
  const noPmi = solve(false);
  let loan: number;
  if (ltv(noPmi) <= 0.8) loan = noPmi;
  else loan = Math.max(solve(true), 4 * down); // a loan of exactly 80% of the price needs no mortgage insurance

  const viable = budget > tax * down && loan > 0;
  if (!viable) loan = 0;
  const price = viable ? loan + down : 0;
  const pmiApplies = viable && ltv(loan) > 0.8 + 1e-9;

  const monthly: MonthlyBreakdown = viable
    ? (() => {
        const principalInterest = loan * f;
        const propertyTax = price * tax;
        const insurance = input.insuranceYearly / 12;
        const pmiPaid = pmiApplies ? loan * pmi : 0;
        return { principalInterest, propertyTax, insurance, hoa: input.hoaMonthly, pmi: pmiPaid, total: principalInterest + propertyTax + insurance + input.hoaMonthly + pmiPaid };
      })()
    : { principalInterest: 0, propertyTax: 0, insurance: input.insuranceYearly / 12, hoa: input.hoaMonthly, pmi: 0, total: input.insuranceYearly / 12 + input.hoaMonthly };

  return {
    maxPrice: price,
    maxLoan: loan,
    downPayment: down,
    downPaymentPercent: price > 0 ? (down / price) * 100 : 0,
    monthly,
    housingBudget,
    limitedBy,
    pmiApplies,
    frontRatioPercent: (monthly.total / monthlyIncome) * 100,
    backRatioPercent: ((monthly.total + input.monthlyDebts) / monthlyIncome) * 100,
    viable,
  };
}
