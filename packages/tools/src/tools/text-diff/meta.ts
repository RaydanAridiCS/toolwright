import { Diff } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "text-diff",
  name: "Text Diff Checker",
  tagline: "Compare two texts and see exactly what changed.",
  description:
    "Paste two versions of a text or code and see additions and deletions highlighted line by line, word by word or character by character. Side-by-side and inline views, plus a unified patch you can copy. Nothing leaves your browser.",
  category: "text",
  keywords: ["diff checker", "compare text", "text compare", "find differences", "code diff", "unified diff"],
  icon: Diff,
  popular: true,
  howTo: ["Paste the original text on the left and the changed text on the right.", "Choose line, word or character comparison.", "Switch between side-by-side and inline views, or copy the unified patch."],
  related: ["find-and-replace", "json-formatter", "line-tools", "json-diff"],
});
