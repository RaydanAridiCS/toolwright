import { Replace } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "csv-delimiter-converter",
  name: "CSV Delimiter Converter",
  tagline: "Switch between comma, tab, semicolon and pipe separated values.",
  description: "Change the delimiter of CSV data (for example comma to tab, or semicolon to comma for European Excel exports) while keeping quoting intact. Everything runs in your browser.",
  primaryKeyword: "csv to tsv",
  seoTitle: "CSV to TSV Converter: Change CSV Delimiter",
  seoDescription:
    "Switch CSV data between comma, tab, semicolon and pipe separators while keeping quoting intact. Free, no sign-up, runs in your browser.",
  answer:
    "CSV Delimiter Converter changes the separator in CSV data between comma, tab, semicolon and pipe, for example CSV to TSV or a European semicolon file to commas. Quoting stays intact, and nothing leaves your browser.",
  category: "data",
  keywords: ["csv to tsv", "tsv to csv", "change csv delimiter", "semicolon to comma", "csv separator"],
  icon: Replace,
  howTo: ["Paste your CSV or TSV data.", "Choose the current separator and the one you want.", "Copy or download the converted data."],
  faq: [
    { question: "How do I convert CSV to TSV?", answer: "Paste the CSV, choose comma as the input separator and tab as the output separator, then copy the result." },
    { question: "Why does my Excel export use semicolons?", answer: "In many countries a comma is the decimal mark, so Excel writes semicolon-separated files. Convert from semicolon to comma to get the layout most tools expect." },
    { question: "Does it keep quoted fields intact?", answer: "Yes. Fields that contain the separator or line breaks stay quoted." },
  ],
  nextStep: { slug: "json-csv-converter", text: "Need JSON instead? Convert CSV to JSON." },
  related: ["json-csv-converter", "csv-to-markdown", "line-tools"],
});
