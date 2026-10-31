import { GitMerge } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-merge",
  name: "JSON Merge (Three-Way)",
  tagline: "Merge two edited JSON files that started from the same original.",
  description:
    "Combine two edited copies of a JSON file with the original they came from, the way git merges code. Changes to different keys combine, key order is kept, conflicts are listed with their paths, and arrays can be matched by ID. Runs in your browser; nothing is uploaded.",
  primaryKeyword: "json merge",
  seoTitle: "JSON Merge: Three-Way Merge for JSON Files",
  seoDescription:
    "Merge two edited copies of a JSON file with their original, like git does. Conflicts are listed by path. Free, runs in your browser.",
  answer:
    "JSON Merge combines two edited copies of a JSON file with the original they came from, the way git merges code. Changes to different keys combine, key order is kept and conflicts are listed with their paths. Nothing is uploaded.",
  category: "developer",
  keywords: ["json merge", "three way merge json", "merge json files", "json conflict", "combine json", "json merge conflict", "json 3 way merge"],
  icon: GitMerge,
  howTo: [
    "Paste the original JSON into Base, then your edited copy and the other person's copy.",
    "Choose which side wins a conflict, and how arrays should be treated.",
    "Copy the merged JSON, and read the conflict list for anything both of you changed.",
  ],
  faq: [
    {
      question: "Why does it need the original (base) as well as the two edits?",
      answer: "With only two versions you cannot tell who changed what. The base shows which side touched each value, so a change made by one person is simply accepted, and only values both of you changed differently are conflicts.",
    },
    {
      question: "Is my JSON uploaded?",
      answer: "No. It is merged in your browser, and this tool keeps it out of shareable links, since configuration files often hold secrets.",
    },
    {
      question: "How are arrays merged?",
      answer:
        "Your choice. “Treat as one value” takes whichever side changed the array and reports a conflict if both did. “Combine as a set” keeps additions from both and drops anything either side removed. “Match items by a property” pairs up objects with the same id (or another property) and merges each pair.",
    },
    {
      question: "Does key order matter?",
      answer: "It is kept. If only one side reordered the keys of an object, that order is used. If both did, the side you choose wins. Keys added by the other side go right after the key that precedes them there.",
    },
    {
      question: "What are the limits?",
      answer: "It reads standard JSON, so comments and trailing commas are errors. Numbers beyond JavaScript's precision (above 9 quadrillion) lose digits, and if a key appears twice in one object the last one is used.",
    },
  ],
  nextStep: { slug: "json-diff", text: "Just need to see the differences? Compare the two files." },
  related: ["json-diff", "json-formatter", "jsonpath-tester", "json-schema-generator", "text-diff"],
});
