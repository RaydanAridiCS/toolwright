import { Table2 } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "csv-to-markdown",
  name: "CSV to Markdown Table",
  tagline: "Paste CSV or spreadsheet cells, get a Markdown table.",
  description: "Convert CSV, TSV or cells copied from a spreadsheet into a GitHub-flavoured Markdown table. Pipes are escaped and ragged rows are padded. Runs locally.",
  category: "data",
  keywords: ["csv to markdown", "markdown table generator", "excel to markdown", "tsv to markdown", "table to markdown"],
  icon: Table2,
  related: ["json-csv-converter", "markdown-preview", "csv-delimiter-converter", "html-to-markdown"],
});
