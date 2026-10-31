import { FileJson } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-to-typescript",
  name: "JSON to TypeScript",
  tagline: "Generate TypeScript interfaces from a JSON sample.",
  description:
    "Paste JSON and get ready-to-use TypeScript interfaces or type aliases. Nested objects become named interfaces, arrays are merged, and keys missing from some items become optional. Runs entirely in your browser.",
  primaryKeyword: "json to typescript",
  seoTitle: "JSON to TypeScript Interface Generator",
  seoDescription:
    "Paste JSON and get TypeScript interfaces or type aliases. Nested objects become named types. Free, and runs in your browser.",
  answer:
    "JSON to TypeScript turns a JSON sample into ready-to-use TypeScript interfaces or type aliases. Nested objects become named interfaces, arrays are merged and keys missing from some items become optional. It runs in your browser.",
  category: "developer",
  keywords: ["json to typescript", "json to interface", "typescript types from json", "generate types", "quicktype alternative"],
  icon: FileJson,
  popular: true,
  howTo: ["Paste a sample of your JSON.", "Choose interfaces or type aliases and set the root name.", "Copy the TypeScript."],
  faq: [
    { question: "How do I generate TypeScript types from JSON?", answer: "Paste a sample of the JSON, choose interfaces or type aliases and copy the result." },
    { question: "How does it handle arrays of objects?", answer: "The items are merged into one type. Keys that are missing from some items become optional." },
    { question: "Is my JSON uploaded?", answer: "No. The types are generated in your browser." },
  ],
  nextStep: { slug: "json-schema-generator", text: "Need a schema instead of types? Generate a JSON Schema." },
  related: ["json-formatter", "json-yaml-converter", "text-diff", "json-schema-generator"],
});
