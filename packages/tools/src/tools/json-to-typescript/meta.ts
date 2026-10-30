import { FileJson } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-to-typescript",
  name: "JSON to TypeScript",
  tagline: "Generate TypeScript interfaces from a JSON sample.",
  description:
    "Paste JSON and get ready-to-use TypeScript interfaces or type aliases. Nested objects become named interfaces, arrays are merged, and keys missing from some items become optional. Runs entirely in your browser.",
  category: "developer",
  keywords: ["json to typescript", "json to interface", "typescript types from json", "generate types", "quicktype alternative"],
  icon: FileJson,
  popular: true,
  related: ["json-formatter", "json-yaml-converter", "text-diff", "json-schema-generator"],
});
