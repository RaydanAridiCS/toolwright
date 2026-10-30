import { SquareTerminal } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "fetch-to-curl",
  name: "Fetch to cURL Converter",
  tagline: "Turn JavaScript fetch code into a cURL command you can run.",
  description:
    "Paste a fetch call and get the equivalent cURL command with method, headers, JSON, form and file bodies. The code is only read, never run, and it stays in your browser, so tokens in it are never uploaded.",
  category: "developer",
  keywords: ["fetch to curl", "javascript to curl", "convert fetch to curl", "fetch curl converter", "js fetch to curl command", "fetch request to curl"],
  icon: SquareTerminal,
  howTo: [
    "Paste the fetch(...) call, with its options object, from your code.",
    "Choose whether to follow redirects, compress, and put each option on its own line.",
    "Copy the cURL command. Read any notes at the top: they list values that came from variables and options curl cannot copy.",
  ],
  faq: [
    {
      question: "Is my code run or uploaded?",
      answer: "Neither. The code is read as text by a small parser in your browser and is never evaluated, so nothing in it can execute. It also stays out of shareable links, because code often contains tokens.",
    },
    {
      question: "What happens to variables such as ${token}?",
      answer: "The parser cannot know their values, so they are kept as ${token} in the command and a note asks you to replace them. Template strings and + joins of plain text are read in full.",
    },
    {
      question: "Which parts of fetch are understood?",
      answer:
        "The address, method, headers (an object, a list of pairs or new Headers), and bodies written as a string, JSON.stringify(...), new URLSearchParams(...) or a FormData built with append. new Request(url, init) works too. Options curl has no use for, such as mode and cache, are listed in a note.",
    },
    {
      question: "Why does the command have -L and a Content-Type I did not write?",
      answer: "fetch follows redirects and labels a plain string body text/plain, while curl does neither by default. The command copies fetch's behaviour so both send the same request. You can switch -L off.",
    },
    {
      question: "Does it work in Windows cmd or PowerShell?",
      answer: "The command uses bash-style single quotes. In PowerShell or cmd, quote it differently or run it in Git Bash or WSL.",
    },
  ],
  related: ["curl-to-fetch", "http-header-explainer", "json-formatter", "url-parser", "http-status-codes"],
});
