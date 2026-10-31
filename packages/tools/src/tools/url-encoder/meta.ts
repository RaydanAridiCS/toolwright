import { Link2 } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "url-encoder",
  name: "URL Encoder & Decoder",
  tagline: "Percent-encode or decode URLs and query strings.",
  description:
    "Encode text for safe use in URLs or decode percent-escaped strings. Choose component mode for query values or full-URL mode to keep :/?# intact. Runs in your browser.",
  primaryKeyword: "url encode",
  seoTitle: "URL Encoder and Decoder: Percent Encoding",
  seoDescription:
    "Percent-encode text for URLs or decode percent-escaped strings. Component mode for query values, full-URL mode for whole links. Free.",
  answer:
    "URL Encoder & Decoder lets you encode text for safe use in URLs with percent-encoding, and decode percent-escaped strings. Choose component mode for query values or full-URL mode to keep characters such as : / ? and # intact. It runs in your browser.",
  category: "encoding",
  keywords: ["url encode", "url decode", "percent encoding", "encodeURIComponent", "query string encoder"],
  icon: Link2,
  popular: true,
  howTo: ["Paste your text or URL.", "Choose encode or decode, and component or full-URL mode.", "Copy the result."],
  faq: [
    { question: "What is URL encoding?", answer: "Replacing characters that are not allowed or have a special meaning in a URL with a percent sign and two hex digits, such as %20 for a space." },
    { question: "What is the difference between component and full-URL mode?", answer: "Component mode encodes everything that is special, which suits a single query value. Full-URL mode leaves the characters that structure a URL, such as : / ? and #, alone." },
    { question: "Is my text uploaded?", answer: "No. Encoding and decoding run in your browser." },
  ],
  nextStep: { slug: "url-parser", text: "Want to see the parts of a URL? Break it into its components." },
  related: ["url-parser", "base64-encoder", "html-entities"],
});
