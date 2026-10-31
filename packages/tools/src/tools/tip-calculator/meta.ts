import { Receipt } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "tip-calculator",
  name: "Tip & Bill Splitter",
  tagline: "Work out the tip and split the bill between friends.",
  description: "Enter the bill, choose a tip percentage and the number of people to see the tip, the total and what each person owes. Optionally round each share up.",
  primaryKeyword: "tip calculator",
  seoTitle: "Tip Calculator and Bill Splitter",
  seoDescription:
    "Enter the bill, pick a tip percentage and the number of people to see the tip, the total and each person's share. Free, instant.",
  answer:
    "Tip & Bill Splitter is a tip calculator that works out the tip and the total for a bill and what each person owes when you split it. Choose a tip percentage and the number of people, and optionally round each share up. It runs in your browser.",
  category: "calculators",
  keywords: ["tip calculator", "split bill", "bill splitter", "gratuity calculator", "restaurant tip"],
  icon: Receipt,
  howTo: ["Enter the bill and choose a tip percentage.", "Set the number of people.", "Read the tip, the total and each share."],
  faq: [
    { question: "How do I calculate a tip?", answer: "Multiply the bill by the tip percentage. For a 15% tip on 80, that is 12, for a total of 92." },
    { question: "How do I split a bill with a tip?", answer: "Add the tip to the bill, then divide the total by the number of people. The calculator does both steps." },
    { question: "Can I round each share up?", answer: "Yes. There is an option to round every share up to a whole amount." },
  ],
  nextStep: { slug: "percentage-calculator", text: "Need another percentage sum? Use the Percentage Calculator." },
  related: ["unit-price-comparison", "percentage-calculator", "loan-calculator", "unit-converter"],
});
