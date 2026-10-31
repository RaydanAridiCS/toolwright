import { CalendarClock } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "meeting-planner",
  name: "Meeting Time Planner",
  tagline: "Find a time that falls inside everyone's working hours across time zones.",
  description:
    "Add the cities your team works in, set their working hours, pick a day, and see the windows when everyone is at work, in each person's local time. Handles daylight saving time and half-hour zones, and suggests compromises when nothing fits. Shareable link, calculated in your browser.",
  primaryKeyword: "meeting planner",
  seoTitle: "Meeting Planner: Find a Time Across Time Zones",
  seoDescription:
    "Add your teammates' cities and working hours and see the windows when everyone is at work, in local times. Handles daylight saving.",
  answer:
    "Meeting Time Planner finds the times when everyone is inside their working hours across time zones. Add the cities, set each person's hours, pick a day and read the windows in each person's local time. It handles daylight saving and half-hour zones, and it runs in your browser.",
  category: "calculators",
  keywords: ["meeting planner", "time zone meeting planner", "find meeting time across time zones", "world clock meeting", "best time to meet", "overlapping working hours", "schedule across time zones"],
  icon: CalendarClock,
  howTo: ["Add each person's city or time zone and their working hours.", "Pick the day and the meeting length.", "Read the window when everyone is working, or the best compromises, and copy the link to share the plan."],
  faq: [
    {
      question: "How is this different from the Time Zone Converter?",
      answer: "The converter turns one time into other zones. The planner works the other way round: it takes everyone's working hours and finds the times that suit all of them, for a day you choose.",
    },
    {
      question: "Does it handle daylight saving time?",
      answer: "Yes. It uses your browser's time zone data for the actual date, so a plan for next week uses each place's real clock offset, including the weeks when the US and Europe have changed clocks on different dates.",
    },
    {
      question: "What does “Possible” mean?",
      answer: "A time outside someone's working hours but between 07:00 and 21:00 their time. It is not ideal, but not the middle of the night. Anything else is shown as off hours.",
    },
    {
      question: "Can I share the plan?",
      answer: "Yes. The cities, hours and date are saved in the link's fragment (after the #), which browsers never send to a server. Only share it if you are happy for others to see those details.",
    },
    {
      question: "Why does it ask for the date in the first city?",
      answer: "A calendar day starts at different moments around the world, so the plan needs one place to define it. The tool tries every half hour of that day in the first city's time, and shows the others' local times, including when they fall on the next or previous day.",
    },
  ],
  nextStep: { slug: "time-zone-converter", text: "Just converting one time? Use the Time Zone Converter." },
  related: ["time-zone-converter", "date-calculator", "timestamp-converter", "cron-explainer", "salary-converter"],
});
