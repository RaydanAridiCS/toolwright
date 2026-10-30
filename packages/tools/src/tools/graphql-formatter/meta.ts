import { Braces } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "graphql-formatter",
  name: "GraphQL Formatter",
  tagline: "Format or minify GraphQL queries, mutations and schemas.",
  description:
    "Paste GraphQL and get it laid out cleanly: one field per line, long arguments split, comments and blank lines kept. Works for queries, mutations, fragments and schema definitions, and can minify too. Runs in your browser; nothing is uploaded.",
  category: "developer",
  keywords: ["graphql formatter", "format graphql", "graphql beautifier", "graphql prettifier", "minify graphql", "graphql schema formatter", "gql formatter"],
  icon: Braces,
  howTo: ["Paste a GraphQL query, mutation or schema, or open a .graphql file.", "Choose Format or Minify, and the indent.", "Copy the result."],
  faq: [
    {
      question: "Does it check that my GraphQL is valid?",
      answer: "No. It checks that the text can be read (strings are closed, brackets match, nothing unexpected) and says which line is wrong if not. It does not check names or types against a schema.",
    },
    {
      question: "What happens to commas?",
      answer: "Commas are optional in GraphQL. The formatter keeps them between arguments that share a line and leaves them out when arguments go on separate lines.",
    },
    {
      question: "Is my query uploaded?",
      answer: "No. Formatting runs in your browser, so tokens or private field names in the query never leave your device.",
    },
    {
      question: "Can it change what my query means?",
      answer: "It only changes spacing, line breaks and commas. The tests check that formatting and minifying keep every token, and that formatting twice gives the same result as once.",
    },
  ],
  related: ["json-formatter", "sql-formatter", "curl-to-fetch", "fetch-to-curl", "http-header-explainer"],
});
