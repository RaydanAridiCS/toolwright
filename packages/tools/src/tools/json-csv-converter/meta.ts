import { FileSpreadsheet } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-csv-converter",
  name: "JSON to CSV Converter",
  tagline: "Turn JSON arrays into CSV and CSV into JSON.",
  description:
    "Convert an array of JSON objects to CSV (nested objects are flattened to dotted columns) or parse CSV and TSV into typed JSON. Choose delimiters and headers. Large files are handled locally in your browser.",
  primaryKeyword: "json to csv",
  seoTitle: "JSON to CSV Converter, and CSV to JSON",
  seoDescription:
    "Convert a JSON array to CSV, or CSV and TSV to JSON. Nested objects become dotted columns. Free, and large files stay in your browser.",
  answer:
    "JSON to CSV Converter turns an array of JSON objects into CSV, flattening nested objects into dotted columns, or parses CSV and TSV into typed JSON. Choose delimiters and headers. It runs in your browser.",
  category: "data",
  keywords: ["json to csv", "csv to json", "convert csv", "json to excel", "tsv to json", "flatten json"],
  icon: FileSpreadsheet,
  popular: true,
  howTo: ["Paste your JSON array or your CSV.", "Choose the direction, delimiter and header options.", "Copy or download the result."],
  faq: [
    { question: "How do I convert JSON to CSV?", answer: "Paste a JSON array of objects, choose the delimiter and copy or download the CSV." },
    { question: "What happens to nested objects?", answer: "They are flattened into columns with dotted names, such as address.city." },
    { question: "Can it convert CSV to JSON?", answer: "Yes. Switch direction and paste CSV or TSV to get a JSON array." },
  ],
  nextStep: { slug: "json-formatter", text: "Want to check the JSON first? Validate and format it." },
  related: ["json-yaml-converter", "csv-to-markdown", "csv-delimiter-converter"],
});
