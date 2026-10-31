import { ArrowLeftRight } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-yaml-converter",
  name: "JSON to YAML Converter",
  tagline: "Convert JSON to YAML and YAML to JSON instantly.",
  description:
    "Switch between JSON and YAML in either direction, with optional key sorting and custom indentation. Parsing happens locally in your browser, so config files and secrets stay on your device.",
  primaryKeyword: "json to yaml",
  seoTitle: "JSON to YAML Converter, and YAML to JSON",
  seoDescription:
    "Convert JSON to YAML or YAML to JSON with optional key sorting and indentation. Free, and your config never leaves your browser.",
  answer:
    "JSON to YAML Converter switches between JSON and YAML in either direction, with optional key sorting and custom indentation. Parsing happens in your browser, so config files and secrets stay on your device.",
  category: "data",
  keywords: ["json to yaml", "yaml to json", "yaml converter", "convert yaml", "kubernetes yaml", "docker compose"],
  icon: ArrowLeftRight,
  popular: true,
  howTo: ["Paste your JSON or YAML.", "Choose the direction, indentation and key sorting.", "Copy or download the result."],
  faq: [
    { question: "How do I convert YAML to JSON?", answer: "Paste the YAML, switch to YAML to JSON and copy the result." },
    { question: "Does it keep my key order?", answer: "Yes, unless you turn on key sorting." },
    { question: "Is my config file uploaded?", answer: "No. Parsing and conversion happen in your browser." },
  ],
  nextStep: { slug: "yaml-validator", text: "Want to lint the YAML for traps? Run it through the YAML Validator." },
  related: ["json-formatter", "json-csv-converter", "json-to-typescript", "xml-formatter"],
});
