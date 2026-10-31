import { Clock } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "cron-explainer",
  name: "Cron Expression Explainer",
  tagline: "Translate cron schedules into plain English and see the next runs.",
  description:
    "Paste a cron expression to read it in plain English and list its next scheduled runs in UTC or your local time. Supports ranges, lists, steps, month and weekday names, and shortcuts like @daily. Runs in your browser.",
  primaryKeyword: "cron expression",
  seoTitle: "Cron Expression Explainer and Next Run Times",
  seoDescription:
    "Paste a cron expression to read it in plain English and see its next scheduled runs in UTC or local time. Free, runs in your browser.",
  answer:
    "Cron Expression Explainer translates a cron schedule into plain English and lists its next runs in UTC or your local time. It supports ranges, lists, steps, month and weekday names and shortcuts such as @daily. It runs in your browser.",
  category: "developer",
  keywords: ["cron expression", "crontab", "cron generator", "cron explainer", "cron schedule", "next run"],
  icon: Clock,
  popular: true,
  howTo: ["Paste or type a cron expression.", "Read the plain-English explanation.", "Check the list of next runs, in UTC or your local time."],
  faq: [
    { question: "What does * mean in a cron expression?", answer: "An asterisk means every value of that field, so * in the minute field means every minute." },
    { question: "What do the five fields mean?", answer: "In order: minute, hour, day of month, month and day of week. For example, 30 2 * * 1 means 02:30 every Monday." },
    { question: "Which time zone are the next runs shown in?", answer: "You can choose UTC or your local time zone. Your server decides which zone the real schedule uses, so check it there." },
  ],
  nextStep: { slug: "timestamp-converter", text: "Debugging a schedule? Convert Unix timestamps to dates." },
  related: ["timestamp-converter", "time-zone-converter", "regex-tester"],
});
