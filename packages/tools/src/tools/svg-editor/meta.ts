import { PenTool } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-editor",
  name: "SVG Editor",
  tagline: "Write, preview, fix and resize SVG code live.",
  description:
    "Edit SVG code with a live preview on white, dark or transparent backgrounds. Format it, fix a missing namespace or viewBox, set an exact size, add space around the drawing and export SVG or PNG. Everything runs in your browser; your file is never uploaded.",
  primaryKeyword: "svg editor",
  seoTitle: "SVG Editor: Edit and Preview SVG Code Live",
  seoDescription:
    "Edit SVG code with a live preview, fix a missing viewBox, set an exact size and export SVG or PNG. Free, and nothing is uploaded.",
  answer:
    "SVG Editor lets you write and preview SVG code live on white, dark or transparent backgrounds. Format it, fix a missing namespace or viewBox, set an exact size, add space around the drawing and export SVG or PNG. It runs in your browser.",
  category: "design",
  keywords: ["svg editor", "svg viewer", "svg preview", "edit svg online", "svg code editor", "svg format", "svg resize", "svg to png"],
  icon: PenTool,
  popular: true,
  howTo: [
    "Paste SVG code or drop a file, or start from the sample.",
    "Edit the code and watch the preview. Use the checks to fix a missing viewBox or namespace.",
    "Download the SVG, or a PNG at the scale you need.",
  ],
  faq: [
    {
      question: "Is my SVG uploaded?",
      answer: "No. It is parsed and drawn in your browser. The preview uses an image element, so scripts inside the file cannot run.",
    },
    {
      question: "Why does my SVG not show in some places?",
      answer: "The usual cause is a missing xmlns or viewBox. The checks list this and the Fix button adds them.",
    },
    {
      question: "How do I set an exact size without stretching it?",
      answer: "Type a width and press Set size. The height is worked out from the viewBox so the shape keeps its proportions.",
    },
    {
      question: "Why is the PNG blank on a transparent background?",
      answer: "It is not blank: the PNG keeps the transparency. A transparent picture looks empty on a white page only if its shapes are white. Choose a white or dark backdrop to export with that colour behind it.",
    },
    {
      question: "Does it edit paths or colours?",
      answer: "This tool edits the code. For paths use SVG Path Tools, and for colours use SVG Recolor.",
    },
  ],
  nextStep: { slug: "svg-optimizer", text: "Done editing? Shrink the file with the SVG Optimizer." },
  related: ["svg-optimizer", "svg-path-tools", "svg-recolor", "svg-to-png", "svg-sanitizer", "xml-formatter"],
});
