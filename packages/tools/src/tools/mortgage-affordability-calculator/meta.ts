import { House } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "mortgage-affordability-calculator",
  name: "Mortgage Affordability Calculator",
  tagline: "Find the most expensive home your income, debts and down payment can carry.",
  description:
    "Enter your income, debts and down payment to see the highest home price that fits the common 28/36 lender rules, with a monthly breakdown of loan, tax, insurance and dues. Calculated locally; your numbers are never stored.",
  primaryKeyword: "mortgage affordability calculator",
  seoTitle: "Mortgage Affordability Calculator: 28/36 Rule",
  seoDescription:
    "See the highest home price your income, debts and down payment can carry under the common 28/36 rules. Calculated in your browser.",
  answer:
    "Mortgage Affordability Calculator finds the highest home price your income, debts and down payment fit under the common 28/36 lender rules, with a monthly breakdown of loan, tax, insurance and dues. It is calculated in your browser and your numbers are not stored.",
  category: "calculators",
  keywords: ["mortgage affordability", "how much house can i afford", "home affordability calculator", "28/36 rule", "debt to income ratio", "house budget"],
  icon: House,
  howTo: [
    "Enter your yearly income, monthly debt payments and the cash you have for a down payment.",
    "Adjust the rate, term, taxes and insurance to match your area.",
    "Read the highest price that fits and the monthly cost behind it.",
  ],
  faq: [
    {
      question: "What are the 28 and 36 numbers?",
      answer: "A common rule of thumb says housing should take at most 28% of gross income and housing plus all other debts at most 36%. This tool uses whichever limit is tighter. Some lenders allow up to 43% or more, and you can change both.",
    },
    {
      question: "Is this what a lender would approve?",
      answer: "No. It is an estimate. Lenders also look at your credit score, savings, job history and loan type, and a payment that fits the rules may still feel tight.",
    },
    {
      question: "When is mortgage insurance added?",
      answer: "When the down payment is under 20% of the price, the tool adds mortgage insurance at the yearly rate you enter, as a share of the loan.",
    },
    {
      question: "What does it leave out?",
      answer: "Closing costs, moving costs, repairs, utilities and the cost of owning in a particular area are not included. Keep a cushion for them.",
    },
  ],
  nextStep: { slug: "loan-calculator", text: "Have a price in mind? See the monthly payment and amortization table." },
  related: ["loan-calculator", "compound-interest-calculator", "percentage-calculator", "salary-converter"],
});
