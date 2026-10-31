import { Globe } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "url-parser",
  name: "URL Parser",
  tagline: "Break a URL into protocol, host, path, query parameters and hash.",
  description: "Paste any URL to see its parts (protocol, host, port, path, query parameters and fragment) and copy each one. Decoding is done locally in your browser.",
  primaryKeyword: "url parser",
  seoTitle: "URL Parser: Split a URL into Its Parts",
  seoDescription:
    "Paste any URL to see its protocol, host, port, path, query parameters and fragment, and copy each part. Free, in your browser.",
  answer:
    "URL Parser breaks a URL into its protocol, host, port, path, query parameters and fragment and lets you copy each part. It decodes values in your browser, so the URL is never uploaded.",
  category: "developer",
  keywords: ["url parser", "parse url", "query string parser", "url components", "url decoder"],
  icon: Globe,
  howTo: ["Paste a URL.", "Read its protocol, host, path and query parameters.", "Copy any part."],
  faq: [
    { question: "How do I get the query parameters from a URL?", answer: "Paste the URL and read the parameters in the list, already decoded." },
    { question: "What are the parts of a URL?", answer: "The protocol, host, optional port, path, query string and fragment." },
    { question: "Is the URL uploaded?", answer: "No. It is parsed in your browser." },
  ],
  nextStep: { slug: "url-encoder", text: "Need to encode a value before you put it in a URL? Percent-encode it." },
  related: ["url-encoder", "utm-builder", "url-cleaner", "curl-to-fetch", "subnet-calculator"],
});
