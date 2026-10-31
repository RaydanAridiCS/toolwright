import { Database } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "sql-formatter",
  name: "SQL Formatter",
  tagline: "Beautify or minify SQL for PostgreSQL, MySQL and more.",
  description:
    "Format messy SQL into readable, consistently indented queries, or minify it for embedding. Supports PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, Oracle, BigQuery and Snowflake. Runs in your browser; queries are never sent anywhere.",
  primaryKeyword: "sql formatter",
  seoTitle: "SQL Formatter: Beautify SQL for Any Database",
  seoDescription:
    "Format messy SQL into readable, indented queries or minify it. Supports PostgreSQL, MySQL, SQLite, SQL Server and more. Runs in your browser.",
  answer:
    "SQL Formatter formats messy SQL into readable, consistently indented queries, or minifies it for embedding. It supports PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, Oracle, BigQuery and Snowflake, and your queries are never sent anywhere.",
  category: "developer",
  keywords: ["sql formatter", "sql beautifier", "format sql", "minify sql", "postgres formatter", "mysql formatter"],
  icon: Database,
  popular: true,
  howTo: ["Paste your SQL.", "Choose the dialect and the style options.", "Copy the formatted or minified SQL."],
  faq: [
    { question: "Which SQL dialects are supported?", answer: "PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, Oracle, BigQuery and Snowflake." },
    { question: "Does formatting change what the query does?", answer: "No. Formatting only changes whitespace and keyword case, not the logic." },
    { question: "Are my queries uploaded?", answer: "No. Formatting runs in your browser." },
  ],
  nextStep: { slug: "text-diff", text: "Comparing two versions of a query? Use the Text Diff Checker." },
  related: ["graphql-formatter", "json-formatter", "text-diff", "string-escape"],
});
