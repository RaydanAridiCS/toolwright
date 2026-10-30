import { Crosshair } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "jsonpath-tester",
  name: "JSONPath Tester",
  tagline: "Try a JSONPath query on your JSON and see every match with its path.",
  description:
    "Paste JSON, type a JSONPath such as $.store.book[?(@.price < 10)].title and see the matching values and their paths. Supports filters, slices, wildcards and recursive search. Runs in your browser; nothing is uploaded.",
  category: "developer",
  keywords: ["jsonpath", "jsonpath tester", "jsonpath evaluator", "json query", "json path finder", "jq alternative", "query json"],
  icon: Crosshair,
  howTo: [
    "Paste your JSON on the left, or press Sample.",
    "Type a JSONPath that starts with $, or pick one of the examples.",
    "Read the matches, each with its exact path, and copy the values as a JSON array.",
  ],
  faq: [
    {
      question: "Which JSONPath syntax does it support?",
      answer:
        "The standard one from RFC 9535: dot and bracket names, array indexes (including negative ones), slices like [1:3], wildcards, recursive search with .., unions, and filters with ==, !=, <, >, &&, ||, ! and the functions length(), count(), match() and search().",
    },
    {
      question: "Why does my filter return nothing?",
      answer: "Filters compare real types, so the string \"5\" is not equal to the number 5. Check that the key exists on every item and quote text values, for example @.category == 'fiction'.",
    },
    {
      question: "Does it run my query as code?",
      answer: "No. The query is parsed into a small tree and walked, and it never goes through eval. Your JSON is not uploaded either.",
    },
  ],
  related: ["json-formatter", "json-diff", "json-schema-generator", "regex-tester"],
});
