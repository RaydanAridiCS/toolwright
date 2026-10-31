import { ShieldCheck } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "url-cleaner",
  name: "URL Tracking Remover",
  tagline: "Strip utm_*, fbclid, gclid and other tracking parameters from links.",
  description: "Clean links before you share them. Removes common tracking parameters (utm_*, fbclid, gclid, msclkid, mc_eid and more) while keeping the parameters that matter. One URL per line.",
  primaryKeyword: "remove utm parameters",
  seoTitle: "Remove UTM Parameters from URLs and Links",
  seoDescription:
    "Strip utm_*, fbclid, gclid and other tracking parameters from links before you share them, keeping the ones that matter. Free.",
  answer:
    "URL Tracking Remover helps you remove utm_* and other tracking parameters, such as fbclid, gclid, msclkid and mc_eid, from links, and keeps the parameters that matter. Put one URL per line. It runs in your browser.",
  category: "developer",
  keywords: ["remove utm", "strip tracking parameters", "clean url", "remove fbclid", "link cleaner"],
  icon: ShieldCheck,
  howTo: ["Paste your links, one per line.", "Check which parameters were removed.", "Copy the cleaned links."],
  faq: [
    { question: "How do I remove UTM parameters from a link?", answer: "Paste the link and copy the cleaned version, which drops the utm_ parameters and other trackers." },
    { question: "Will removing parameters break the link?", answer: "Tracking parameters are not needed to load a page, and the tool keeps other parameters, so links should still work. Check the ones that matter to you." },
    { question: "Can I clean many links at once?", answer: "Yes. Paste one URL per line." },
  ],
  nextStep: { slug: "utm-builder", text: "Building a campaign link instead? Add UTM parameters." },
  related: ["utm-builder", "url-parser", "url-encoder"],
});
