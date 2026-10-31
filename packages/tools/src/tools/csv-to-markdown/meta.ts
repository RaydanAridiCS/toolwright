import { Table2 } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "csv-to-markdown",
  name: "CSV to Markdown Table",
  tagline: "Paste CSV or spreadsheet cells, get a Markdown table.",
  description: "Convert CSV, TSV or cells copied from a spreadsheet into a GitHub-flavoured Markdown table. Pipes are escaped and ragged rows are padded. Runs locally.",
  primaryKeyword: "csv to markdown",
  seoTitle: "CSV to Markdown Table Converter",
  seoDescription:
    "Turn CSV, TSV or cells copied from a spreadsheet into a GitHub-flavored Markdown table. Free, no sign-up, runs in your browser.",
  answer:
    "CSV to Markdown Table converts CSV, TSV or cells pasted from a spreadsheet into a GitHub-flavored Markdown table. Pipes are escaped and short rows are padded. Everything runs in your browser.",
  category: "data",
  keywords: ["csv to markdown", "markdown table generator", "excel to markdown", "tsv to markdown", "table to markdown"],
  icon: Table2,
  howTo: ["Paste CSV, TSV or cells copied from a spreadsheet.", "Read the Markdown table in the output.", "Copy the Markdown."],
  faq: [
    { question: "How do I turn an Excel table into Markdown?", answer: "Copy the cells in your spreadsheet and paste them in. Copied cells are tab-separated, which the tool reads as a table." },
    { question: "What happens to a | character in a cell?", answer: "It is escaped so it does not split the cell." },
    { question: "Which Markdown flavor does it write?", answer: "GitHub-flavored Markdown tables, which GitHub, GitLab and most Markdown editors understand." },
  ],
  nextStep: { slug: "markdown-preview", text: "Want to see how it renders? Open the Markdown Previewer." },
  related: ["json-csv-converter", "markdown-preview", "csv-delimiter-converter", "html-to-markdown"],
});
