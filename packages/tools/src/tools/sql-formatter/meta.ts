import { Database } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "sql-formatter",
  name: "SQL Formatter",
  tagline: "Beautify or minify SQL for PostgreSQL, MySQL and more.",
  description:
    "Format messy SQL into readable, consistently indented queries, or minify it for embedding. Supports PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, Oracle, BigQuery and Snowflake. Runs in your browser; queries are never sent anywhere.",
  category: "developer",
  keywords: ["sql formatter", "sql beautifier", "format sql", "minify sql", "postgres formatter", "mysql formatter"],
  icon: Database,
  popular: true,
  related: ["graphql-formatter", "json-formatter", "text-diff", "string-escape"],
});
