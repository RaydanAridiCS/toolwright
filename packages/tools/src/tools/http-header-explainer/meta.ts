import { ShieldCheck } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "http-header-explainer",
  name: "HTTP Header Explainer",
  tagline: "Paste request or response headers and get each one explained in plain English.",
  description:
    "Paste headers from dev tools or curl -i and see what each one means, with cache lifetimes, cookie flags and CSP rules broken down. A checklist flags missing security headers. Runs in your browser; nothing is uploaded.",
  category: "developer",
  keywords: ["http headers", "http header explainer", "security headers checker", "response headers", "cache-control explained", "csp analyzer", "cookie flags"],
  icon: ShieldCheck,
  howTo: [
    "Copy the headers from your browser's network tab, curl -i or a log.",
    "Paste them in. A start line such as HTTP/1.1 200 OK is optional.",
    "Read the explanation under each header and review the security checklist.",
  ],
  faq: [
    {
      question: "Does this check my live site?",
      answer: "No. It only reads the headers you paste, so it cannot make a request. That is why nothing about your site or your headers leaves the page.",
    },
    {
      question: "Is a missing security header always a problem?",
      answer: "No. Strict-Transport-Security means nothing on plain HTTP, and Permissions-Policy is optional. The checklist points at what to review rather than giving a pass or fail grade.",
    },
    {
      question: "Are cookie values and tokens shown?",
      answer: "Cookie and Authorization headers show only names and schemes in the explanation. The raw line is still displayed on your screen, so hide your screen before sharing it.",
    },
    {
      question: "Why is a header marked Custom?",
      answer: "It is not in this tool's list of standard headers. Many sites add their own, and names starting with X- are usually specific to one site or product.",
    },
  ],
  related: ["http-status-codes", "curl-to-fetch", "jwt-decoder", "url-parser"],
});
