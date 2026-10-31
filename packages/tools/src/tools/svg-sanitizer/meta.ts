import { ShieldCheck } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-sanitizer",
  name: "SVG Sanitizer",
  tagline: "Remove scripts and unsafe links from an SVG before you use it.",
  description:
    "Clean an untrusted SVG: scripts, event handlers, embedded web pages, links to other sites and external styles are removed, and you get a list of exactly what was taken out. It runs in your browser, so the file is never uploaded.",
  primaryKeyword: "svg sanitizer",
  seoTitle: "SVG Sanitizer: Remove Scripts from an SVG",
  seoDescription:
    "Clean an untrusted SVG by removing scripts, event handlers and external links, with a list of what was removed. Runs in your browser.",
  answer:
    "SVG Sanitizer cleans an untrusted SVG by removing scripts, event handlers, embedded web pages, links to other sites and external styles, and lists exactly what was taken out. It runs in your browser. It is a first line of defense, so also sanitize on the server.",
  category: "developer",
  keywords: ["svg sanitizer", "sanitize svg", "svg xss", "remove script from svg", "clean svg", "safe svg upload", "svg security", "dompurify svg"],
  icon: ShieldCheck,
  howTo: [
    "Paste the SVG or drop the file.",
    "Read the list of what was removed and check the cleaned picture.",
    "Copy or download the cleaned file.",
  ],
  faq: [
    {
      question: "Is my file uploaded to be cleaned?",
      answer: "No. The cleaning runs in your browser. The file is not sent anywhere.",
    },
    {
      question: "Why can an SVG be dangerous?",
      answer: "An SVG is code, not just a picture. It can contain scripts, event handlers, links that run JavaScript, and references to other sites that track whoever opens it. That matters most when you let users upload SVGs or paste them into a page.",
    },
    {
      question: "What is removed?",
      answer: "Script elements, on-event attributes such as onclick, foreignObject and the HTML inside it, links that are not local to the file, CSS @import and external url(), and animations that could turn a link into script. Shapes, colour fades, clip paths, text and local references are kept.",
    },
    {
      question: "Is this enough to make an upload feature safe?",
      answer: "It is a strong first step, not a guarantee. Always sanitize on your server too, serve user SVGs with a Content-Security-Policy, and show them through an img tag rather than inline when you can.",
    },
    {
      question: "Why is my picture different afterwards?",
      answer: "If the picture depended on an external image, external font or script, that part is gone by design. The list of removed items shows what changed.",
    },
  ],
  nextStep: { slug: "svg-optimizer", text: "Cleaned the file? Optimize it for size next." },
  related: ["svg-optimizer", "svg-editor", "svg-data-uri"],
});
