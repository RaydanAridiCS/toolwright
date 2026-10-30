import { Braces } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-formatter",
  name: "JSON Formatter & Validator",
  tagline: "Format, validate, minify and repair JSON with exact error positions.",
  description:
    "Pretty-print, minify, sort and validate JSON. Errors point to the exact line and column, and the repair mode fixes comments, trailing commas, single quotes and unquoted keys. Your JSON never leaves your browser.",
  category: "developer",
  keywords: ["json formatter", "json validator", "json beautifier", "json pretty print", "minify json", "fix json", "json lint"],
  icon: Braces,
  popular: true,
  howTo: ["Paste your JSON into the input.", "Pick Format, Minify or Repair and choose the indentation.", "Copy or download the result. Errors show the line and column."],
  faq: [
    { question: "Is my JSON uploaded anywhere?", answer: "No. Parsing and formatting use your browser's built-in JSON engine, and the page makes no network requests with your data." },
    { question: "What does Repair fix?", answer: "It removes comments and trailing commas, converts single quotes to double quotes and quotes bare keys, so JSON5-style or hand-edited data becomes strict JSON." },
  ],
  related: ["json-to-typescript", "json-yaml-converter", "json-csv-converter", "text-diff", "json-diff", "json-schema-generator", "jsonpath-tester"],
});
