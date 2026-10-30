import { Globe } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "url-parser",
  name: "URL Parser",
  tagline: "Break a URL into protocol, host, path, query parameters and hash.",
  description: "Paste any URL to see its parts (protocol, host, port, path, query parameters and fragment) and copy each one. Decoding is done locally in your browser.",
  category: "developer",
  keywords: ["url parser", "parse url", "query string parser", "url components", "url decoder"],
  icon: Globe,
  related: ["url-encoder", "utm-builder", "url-cleaner", "curl-to-fetch", "subnet-calculator"],
});
