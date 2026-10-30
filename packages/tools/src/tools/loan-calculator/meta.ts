import { Landmark } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "loan-calculator",
  name: "Loan & Mortgage Calculator",
  tagline: "Monthly payment, total interest and a full amortization schedule.",
  description:
    "Estimate your monthly payment, total interest and payoff for any loan or mortgage, with a year-by-year breakdown and complete amortization table. Calculated locally; your numbers are never stored.",
  category: "calculators",
  keywords: ["loan calculator", "mortgage calculator", "amortization schedule", "monthly payment", "car loan", "interest calculator"],
  icon: Landmark,
  popular: true,
  related: ["compound-interest-calculator", "percentage-calculator", "tip-calculator", "mortgage-affordability-calculator"],
});
