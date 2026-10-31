import { CalendarClock } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "timestamp-converter",
  name: "Unix Timestamp Converter",
  tagline: "Convert Unix timestamps to dates and back, in any time zone.",
  description:
    "Convert epoch timestamps in seconds, milliseconds, microseconds or nanoseconds to human-readable dates, and dates back to timestamps. Shows ISO 8601, UTC, relative time and any IANA time zone, with a live clock. Runs in your browser.",
  primaryKeyword: "unix timestamp converter",
  seoTitle: "Unix Timestamp Converter: Epoch to Date",
  seoDescription:
    "Convert Unix epoch timestamps in seconds, milliseconds or nanoseconds to dates and back, in any time zone. Free, runs in your browser.",
  answer:
    "Unix Timestamp Converter turns epoch timestamps in seconds, milliseconds, microseconds or nanoseconds into readable dates, and dates back into timestamps. It shows ISO 8601, UTC, relative time and any IANA time zone, with a live clock, and runs in your browser.",
  category: "developer",
  keywords: ["unix timestamp", "epoch converter", "timestamp to date", "date to timestamp", "epoch time", "unix time now"],
  icon: CalendarClock,
  popular: true,
  howTo: ["Paste a timestamp, or pick a date.", "Read the date in ISO 8601, UTC and the time zone you choose.", "Copy the value you need."],
  faq: [
    { question: "How does it know if a number is seconds or milliseconds?", answer: "By magnitude: values below 100 billion are treated as seconds, then milliseconds, microseconds and nanoseconds as the numbers grow. The detected unit is shown." },
  ],
  nextStep: { slug: "time-zone-converter", text: "Need the same moment in several cities? Convert between time zones." },
  related: ["time-zone-converter", "date-calculator", "cron-explainer"],
});
