import { GitCompareArrows } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-diff",
  name: "JSON Diff",
  tagline: "Compare two JSON documents and see what was added, removed or changed.",
  description:
    "Paste two JSON documents and get a list of differences by path, ignoring key order and spacing. Optionally treat arrays as unordered. Everything runs in your browser, so nothing is uploaded.",
  category: "developer",
  keywords: ["json diff", "compare json", "json compare", "json difference", "diff two json files", "json changes"],
  icon: GitCompareArrows,
  howTo: [
    "Paste the original JSON on the left and the changed JSON on the right.",
    "Turn on “Ignore array order” if the order of list items does not matter.",
    "Read the list of added, removed and changed paths, or copy it as a report.",
  ],
  faq: [
    {
      question: "How is this different from the text diff?",
      answer: "The text diff compares lines of text, so reordered keys or different indentation show up as changes. This tool compares the data itself and reports the path of each real difference.",
    },
    {
      question: "Does key order matter?",
      answer: "No. Objects with the same keys and values are equal however the keys are ordered. Array order does matter unless you turn on “Ignore array order”.",
    },
    {
      question: "Is my JSON uploaded anywhere?",
      answer: "No. Both documents are compared in your browser and never sent to a server.",
    },
  ],
  related: ["json-merge", "json-formatter", "text-diff", "json-to-typescript", "json-yaml-converter", "jsonpath-tester"],
});
