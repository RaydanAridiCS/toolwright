import { Receipt } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "tip-calculator",
  name: "Tip & Bill Splitter",
  tagline: "Work out the tip and split the bill between friends.",
  description: "Enter the bill, choose a tip percentage and the number of people to see the tip, the total and what each person owes. Optionally round each share up.",
  category: "calculators",
  keywords: ["tip calculator", "split bill", "bill splitter", "gratuity calculator", "restaurant tip"],
  icon: Receipt,
  related: ["unit-price-comparison", "percentage-calculator", "loan-calculator", "unit-converter"],
});
