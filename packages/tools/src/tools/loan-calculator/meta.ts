import { Landmark } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "loan-calculator",
  name: "Loan & Mortgage Calculator",
  tagline: "Monthly payment, total interest and a full amortization schedule.",
  description:
    "Estimate your monthly payment, total interest and payoff for any loan or mortgage, with a year-by-year breakdown and complete amortization table. Calculated locally; your numbers are never stored.",
  primaryKeyword: "loan calculator",
  seoTitle: "Loan Calculator: Payment and Amortization",
  seoDescription:
    "Work out the monthly payment, total interest and payoff for a loan or mortgage, with a full amortization table. Calculated in your browser.",
  answer:
    "Loan & Mortgage Calculator estimates the monthly payment, total interest and payoff for a loan or mortgage, with a year-by-year breakdown and a complete amortization table. It is calculated in your browser and your numbers are not stored.",
  category: "calculators",
  keywords: ["loan calculator", "mortgage calculator", "amortization schedule", "monthly payment", "car loan", "interest calculator"],
  icon: Landmark,
  popular: true,
  howTo: ["Enter the loan amount, the yearly interest rate and the term.", "Read the monthly payment and total interest.", "Open the schedule to see every payment."],
  faq: [
    { question: "How is the monthly payment calculated?", answer: "It uses the standard amortization formula from the amount, the yearly interest rate and the number of payments." },
    { question: "What is an amortization schedule?", answer: "A table that shows, for every payment, how much goes to interest and how much reduces the balance." },
    { question: "Does it include taxes, insurance or fees?", answer: "No. It covers principal and interest only. For a home budget with taxes and insurance, use the Mortgage Affordability Calculator." },
  ],
  nextStep: { slug: "mortgage-affordability-calculator", text: "Not sure what you can borrow? Work out what home fits your income." },
  related: ["compound-interest-calculator", "percentage-calculator", "tip-calculator", "mortgage-affordability-calculator"],
});
