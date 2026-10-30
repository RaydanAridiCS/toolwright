import { Percent } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "percentage-calculator",
  name: "Percentage Calculator",
  tagline: "X% of Y, what percent, percentage change, increase and decrease.",
  description: "Solve everyday percentage problems: what is X% of Y, X is what percent of Y, percentage change between two values, and increasing or decreasing a number by a percentage. Instant results.",
  category: "calculators",
  keywords: ["percentage calculator", "percent of", "percent change", "percent increase", "percent decrease", "discount calculator"],
  icon: Percent,
  popular: true,
  related: ["tip-calculator", "unit-converter", "loan-calculator", "salary-converter"],
});
