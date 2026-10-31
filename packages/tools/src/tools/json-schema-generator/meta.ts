import { FileJson } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-schema-generator",
  name: "JSON Schema Generator",
  tagline: "Generate a JSON Schema from a sample JSON document.",
  description:
    "Paste example JSON and get a JSON Schema describing its types, nesting and required keys. When the sample is a list, items are merged so keys missing from some of them become optional. Runs in your browser; nothing is uploaded.",
  primaryKeyword: "json schema generator",
  seoTitle: "JSON Schema Generator from a JSON Sample",
  seoDescription:
    "Paste example JSON and get a JSON Schema with types, nesting and required keys. Free, and your data stays in your browser.",
  answer:
    "JSON Schema Generator builds a JSON Schema from a sample JSON document, describing its types, nesting and required keys. When the sample is a list, the items are merged so keys missing from some of them become optional. It runs in your browser.",
  category: "developer",
  keywords: ["json schema generator", "json to json schema", "generate json schema", "infer json schema", "schema from json", "json schema from example"],
  icon: FileJson,
  howTo: [
    "Paste a sample of your JSON. A list with several items gives better results than a single object.",
    "Choose the schema version and which extras to add.",
    "Copy or download the schema, then review it before using it to validate data.",
  ],
  faq: [
    {
      question: "How good is a schema generated from one example?",
      answer:
        "It is a starting point. A schema can only describe what the sample shows, so it cannot know about value ranges, enums or keys that never appeared. Use several varied samples and edit the result.",
    },
    {
      question: "How are optional keys decided?",
      answer: "When the sample is a list of objects, a key is marked required only if it appears in every item. For a single object, all of its keys are marked required unless you turn that option off.",
    },
    {
      question: "Is my JSON uploaded anywhere?",
      answer: "No. The schema is generated in your browser.",
    },
  ],
  nextStep: { slug: "json-to-typescript", text: "Prefer types in code? Generate TypeScript interfaces from the same JSON." },
  related: ["json-to-typescript", "json-formatter", "json-yaml-converter", "json-diff", "jsonpath-tester"],
});
