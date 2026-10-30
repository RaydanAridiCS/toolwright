import { Globe } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "time-zone-converter",
  name: "Time Zone Converter",
  tagline: "Compare a date and time across cities and time zones.",
  description:
    "Pick a date and time in one zone and see it instantly in any other IANA time zone, including daylight saving time. Great for scheduling meetings across countries. Uses your browser's built-in time zone data.",
  category: "calculators",
  keywords: ["time zone converter", "world clock", "meeting planner", "convert time", "utc converter", "est to pst"],
  icon: Globe,
  popular: true,
  related: ["meeting-planner", "timestamp-converter", "date-calculator", "cron-explainer"],
});
