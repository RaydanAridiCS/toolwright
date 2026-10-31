import { Globe } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "time-zone-converter",
  name: "Time Zone Converter",
  tagline: "Compare a date and time across cities and time zones.",
  description:
    "Pick a date and time in one zone and see it instantly in any other IANA time zone, including daylight saving time. Great for scheduling meetings across countries. Uses your browser's built-in time zone data.",
  primaryKeyword: "time zone converter",
  seoTitle: "Time Zone Converter: Compare Cities and Zones",
  seoDescription:
    "Pick a date and time in one zone and see it in any other, including daylight saving time. Uses your browser's time zone data. Free.",
  answer:
    "Time Zone Converter shows a date and time from one IANA time zone in any other, including daylight saving time changes. It uses your browser's built-in time zone data and runs offline once the page has loaded.",
  category: "calculators",
  keywords: ["time zone converter", "world clock", "meeting planner", "convert time", "utc converter", "est to pst"],
  icon: Globe,
  popular: true,
  howTo: ["Pick a date, a time and the starting time zone.", "Add the zones you want to compare.", "Read the converted times."],
  faq: [
    { question: "How do I convert time between time zones?", answer: "Pick a date and time in the first zone, add the other zones and read the same moment in each." },
    { question: "Does it handle daylight saving time?", answer: "Yes. The conversion uses the time zone rules for the date you pick." },
    { question: "Is it accurate for any date?", answer: "It relies on the time zone data in your browser, so very old or far-future dates follow the rules your browser knows." },
  ],
  nextStep: { slug: "meeting-planner", text: "Scheduling a meeting? Find working hours that overlap." },
  related: ["meeting-planner", "timestamp-converter", "date-calculator", "cron-explainer"],
});
