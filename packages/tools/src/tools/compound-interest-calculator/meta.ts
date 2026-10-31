import { TrendingUp } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "compound-interest-calculator",
  name: "Compound Interest Calculator",
  tagline: "See how savings and investments grow with regular contributions.",
  description:
    "Project the growth of a deposit or investment with compound interest and optional regular contributions. Choose compounding frequency and see year-by-year balances. Illustrative only; calculated in your browser.",
  primaryKeyword: "compound interest calculator",
  seoTitle: "Compound Interest Calculator with Contributions",
  seoDescription:
    "See how a deposit or investment grows with compound interest and regular contributions, year by year. Illustrative only. Runs in your browser.",
  answer:
    "Compound Interest Calculator projects how a deposit grows with compound interest and optional regular contributions, with year-by-year balances and your choice of compounding frequency. It is illustrative only, and it runs in your browser.",
  category: "calculators",
  keywords: ["compound interest calculator", "savings calculator", "investment growth", "interest calculator", "future value"],
  icon: TrendingUp,
  howTo: ["Enter the starting amount, the yearly rate and the number of years.", "Add regular contributions and choose how often interest compounds.", "Read the final balance and the year-by-year table."],
  faq: [
    { question: "What is compound interest?", answer: "Interest earned on the original amount and on the interest already added. Growth speeds up over time because each period's interest is earned on a bigger balance." },
    { question: "Does the calculator include taxes, fees or inflation?", answer: "No. It uses the rate you enter and nothing else, so real returns will be lower after fees, taxes and inflation. Treat the result as an illustration, not advice." },
    { question: "Is my data stored?", answer: "No. The numbers are calculated in your browser and are not sent or saved." },
  ],
  nextStep: { slug: "loan-calculator", text: "Borrowing instead of saving? Work out a loan's monthly payment." },
  related: ["loan-calculator", "percentage-calculator", "tip-calculator"],
});
