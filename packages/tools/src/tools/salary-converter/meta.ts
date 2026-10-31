import { Banknote } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "salary-converter",
  name: "Salary and Hourly Pay Converter",
  tagline: "Turn hourly pay into a yearly salary, or the other way, for your own work week.",
  description:
    "Convert pay between hourly, daily, weekly, every two weeks, monthly and yearly amounts. Set your hours, days and paid weeks so the answer matches your job. Calculated locally; your numbers are never stored.",
  primaryKeyword: "salary to hourly",
  seoTitle: "Salary to Hourly Converter, and Back",
  seoDescription:
    "Turn hourly pay into a yearly salary, or the reverse, for your own hours, days and paid weeks. Calculated in your browser.",
  answer:
    "Salary and Hourly Pay Converter changes salary to hourly pay, or hourly pay to salary, and converts between daily, weekly, every-two-weeks, monthly and yearly amounts. Set your hours, days and paid weeks to match your job. It runs in your browser and stores nothing.",
  category: "calculators",
  keywords: ["salary to hourly", "hourly to salary", "hourly wage calculator", "annual salary calculator", "pay converter", "weekly to yearly pay"],
  icon: Banknote,
  popular: true,
  howTo: [
    "Enter your pay and choose how often you are paid.",
    "Set your hours per week, days per week and paid weeks per year.",
    "Read the same pay in every period.",
  ],
  faq: [
    {
      question: "How is hourly pay turned into a yearly salary?",
      answer: "Hourly pay is multiplied by hours per week and by paid weeks per year. At $25 an hour, 40 hours and 52 weeks, that is $52,000 a year.",
    },
    {
      question: "What is the difference between every two weeks and twice a month?",
      answer: "Every two weeks gives 26 paychecks a year, so some months have three. Twice a month gives exactly 24 paychecks, each a bit larger.",
    },
    {
      question: "How do I account for unpaid time off?",
      answer: "Lower the paid weeks per year. If you take two unpaid weeks, enter 50 and the yearly and hourly figures adjust together.",
    },
    {
      question: "Is this my take-home pay?",
      answer: "No. All amounts are before tax and deductions, because those depend on where you live and your benefits.",
    },
  ],
  nextStep: { slug: "percentage-calculator", text: "Working out a raise? Calculate the percentage change." },
  related: ["percentage-calculator", "loan-calculator", "tip-calculator", "mortgage-affordability-calculator"],
});
