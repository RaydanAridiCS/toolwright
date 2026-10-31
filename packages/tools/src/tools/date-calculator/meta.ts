import { CalendarDays } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "date-calculator",
  name: "Date Calculator",
  tagline: "Days between dates, add or subtract time, age and business days.",
  description: "Find the exact difference between two dates in years, months and days, add or subtract time from a date, calculate someone's age and next birthday, and count business days. All in your browser.",
  primaryKeyword: "date calculator",
  seoTitle: "Date Calculator: Days Between Dates, Age",
  seoDescription:
    "Find the days between two dates, add or subtract time from a date, work out an age and count business days. Free, runs in your browser.",
  answer:
    "Date Calculator finds the exact gap between two dates in years, months and days, adds or subtracts time from a date, works out an age and next birthday, and counts business days. It all runs in your browser.",
  category: "calculators",
  keywords: ["date calculator", "days between dates", "add days to date", "age calculator", "business days", "date difference"],
  icon: CalendarDays,
  popular: true,
  howTo: ["Pick what you need: the difference between dates, adding time, an age or business days.", "Enter your dates or amounts.", "Read the result and copy it."],
  faq: [
    { question: "How many days are there between two dates?", answer: "Enter the start and end date and the tool shows the difference in days, and also in years, months and days." },
    { question: "Can it count business days?", answer: "Yes. It can count weekdays between two dates. It does not know public holidays, so subtract those yourself." },
    { question: "Is my data uploaded?", answer: "No. Dates are calculated in your browser and are not sent anywhere." },
  ],
  nextStep: { slug: "time-zone-converter", text: "Working across countries? Convert a date and time between time zones." },
  related: ["timestamp-converter", "time-zone-converter", "cron-explainer"],
});
