import { Megaphone } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "utm-builder",
  name: "UTM Link Builder",
  tagline: "Add campaign tracking parameters to any URL.",
  description: "Build campaign URLs with utm_source, utm_medium, utm_campaign, utm_term and utm_content. Existing query parameters and fragments are preserved, and links are built locally.",
  primaryKeyword: "utm builder",
  seoTitle: "UTM Builder: Create Campaign URLs Online",
  seoDescription:
    "Build campaign URLs with utm_source, utm_medium, utm_campaign, utm_term and utm_content. Existing parameters are kept. Free.",
  answer:
    "UTM Link Builder adds campaign tracking parameters, utm_source, utm_medium, utm_campaign, utm_term and utm_content, to any URL. Existing query parameters and fragments are preserved, and the link is built in your browser.",
  category: "developer",
  keywords: ["utm builder", "campaign url builder", "utm generator", "google analytics utm", "tracking link"],
  icon: Megaphone,
  howTo: ["Paste the page URL.", "Fill in the source, medium and campaign, and the optional fields.", "Copy the finished link."],
  faq: [
    { question: "What are UTM parameters?", answer: "Tags added to a link so your analytics tool can tell which campaign, source and medium a visit came from." },
    { question: "Which UTM parameters are required?", answer: "Analytics tools usually expect utm_source, utm_medium and utm_campaign. utm_term and utm_content are optional." },
    { question: "Does the tool track anything?", answer: "No. It only builds a link. Toolwright has no analytics." },
  ],
  nextStep: { slug: "url-cleaner", text: "Need to strip tracking from a link instead? Remove the parameters." },
  related: ["url-cleaner", "url-parser", "qr-code-generator"],
});
