import { Percent } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "percentage-calculator",
  name: "Percentage Calculator",
  tagline: "X% of Y, what percent, percentage change, increase and decrease.",
  description: "Solve everyday percentage problems: what is X% of Y, X is what percent of Y, percentage change between two values, and increasing or decreasing a number by a percentage. Instant results.",
  primaryKeyword: "percentage calculator",
  seoTitle: "Percentage Calculator: Percent Of, Change",
  seoDescription:
    "Work out X% of Y, what percent one number is of another, percentage change, and increase or decrease by a percent. Instant, free.",
  answer:
    "Percentage Calculator solves everyday percentage problems: what is X% of Y, X is what percent of Y, the percentage change between two values, and increasing or decreasing a number by a percentage. Results are instant and calculated in your browser.",
  category: "calculators",
  keywords: ["percentage calculator", "percent of", "percent change", "percent increase", "percent decrease", "discount calculator"],
  icon: Percent,
  popular: true,
  howTo: ["Pick the kind of problem, such as X% of Y or percentage change.", "Enter the two numbers.", "Read the result."],
  faq: [
    { question: "How do I calculate a percentage of a number?", answer: "Multiply the number by the percentage and divide by 100. The calculator does it for you: enter the percentage and the number." },
    { question: "How do I calculate percentage change?", answer: "Subtract the old value from the new one, divide by the old value and multiply by 100. Enter both values and the calculator shows the change." },
    { question: "How do I increase a number by a percentage?", answer: "Use the increase mode, enter the number and the percentage, and read the new value." },
  ],
  nextStep: { slug: "tip-calculator", text: "Splitting a bill? Work out the tip and each share." },
  related: ["tip-calculator", "unit-converter", "loan-calculator", "salary-converter"],
});
