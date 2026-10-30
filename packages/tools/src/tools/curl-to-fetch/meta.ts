import { Terminal } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "curl-to-fetch",
  name: "cURL to Fetch Converter",
  tagline: "Turn a copied cURL command into JavaScript fetch code.",
  description:
    "Paste a cURL command, such as one copied from your browser's network panel, and get the equivalent fetch call with headers, body and auth. It runs in your browser, so tokens in the command are never uploaded.",
  category: "developer",
  keywords: ["curl to fetch", "curl to javascript", "convert curl", "copy as curl", "curl to js", "curl command converter", "curl to node fetch"],
  icon: Terminal,
  howTo: [
    "In your browser's network panel, right-click a request and choose “Copy as cURL”, then paste it here.",
    "Choose how the response should be read in the generated code.",
    "Copy the fetch code. Read any notes at the top, as they list options fetch cannot reproduce.",
  ],
  faq: [
    {
      question: "Is my cURL command uploaded?",
      answer: "No. The command is converted in your browser. This tool also keeps it out of shareable links, because commands often contain tokens and passwords.",
    },
    {
      question: "Which cURL options are supported?",
      answer:
        "Method, headers, request bodies (-d, --data-raw, --data-binary, --data-urlencode, --json), form fields (-F), basic and bearer auth, cookies, user agent and referer. Options with no fetch equivalent, such as --insecure or proxies, are listed in a note instead of being dropped silently.",
    },
    {
      question: "Why does the code mention headers browsers refuse to set?",
      answer: "Browsers do not let page code set headers such as Cookie, Referer or Sec-Fetch-*. They work in Node.js, Deno and Bun. You can leave them out with the option above the output.",
    },
    {
      question: "Does it read the Windows cmd version of Copy as cURL?",
      answer: "No. It reads the bash-style command, which uses single quotes or $'…' strings. In Chrome, choose “Copy as cURL (bash)”.",
    },
  ],
  related: ["fetch-to-curl", "json-formatter", "url-parser", "http-status-codes", "http-header-explainer"],
});
