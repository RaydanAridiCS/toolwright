import { Workflow } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "mermaid-editor",
  name: "Mermaid Diagram Editor",
  tagline: "Write Mermaid text, see the diagram, download it as SVG or PNG.",
  description:
    "Turn Mermaid text into flowcharts, sequence, class, state, ER, Gantt, pie, journey, git, mind map, timeline and more. See it update as you type, change the theme and background, then download SVG or PNG or share a link. Drawn in your browser with scripts disabled; nothing is uploaded.",
  category: "developer",
  keywords: ["mermaid editor", "mermaid live editor", "mermaid diagram", "mermaid to png", "mermaid to svg", "flowchart maker", "sequence diagram generator", "diagram as code"],
  icon: Workflow,
  popular: true,
  howTo: [
    "Pick an example, or write your own Mermaid text on the left.",
    "The diagram redraws as you type. If there is a mistake, the error names the line and the last good diagram stays visible.",
    "Choose a theme and background, then download SVG or PNG, copy the SVG, or copy the page link to share the diagram.",
  ],
  faq: [
    {
      question: "Is my diagram uploaded?",
      answer: "No. Mermaid runs in your browser, loaded from this site, and the diagram is drawn on your device. The text is kept in the link's fragment (after the #), which browsers never send to a server, so only people you give the link to can see it.",
    },
    {
      question: "Can diagram text run code or load things from the internet?",
      answer: "No. The library runs in its strict security mode, so click handlers and script links in diagram text are disabled. The result is shown as a picture, which cannot run scripts, and the site's security policy blocks connections to other sites anyway.",
    },
    {
      question: "Which diagram types work?",
      answer: "Everything in the Mermaid version included here: flowcharts, sequence, class, state, entity relationship, Gantt, pie, user journey, git graph, mind map, timeline, quadrant, C4, XY charts, Sankey, block, architecture, packet, kanban and requirement diagrams. Some of the newer types are still marked beta by the Mermaid project.",
    },
    {
      question: "Why do labels look slightly different from other Mermaid tools?",
      answer: "Labels are drawn as plain SVG text rather than HTML. That keeps the SVG and PNG you download identical to the preview and avoids blank PNGs in some browsers, but it means some HTML inside labels and math typesetting are not shown.",
    },
    {
      question: "What is the size limit?",
      answer: "50,000 characters of diagram text, which is Mermaid's own limit, and PNGs are capped at about 16 megapixels so the browser can draw them. Very large diagrams can be slow to lay out.",
    },
  ],
  related: ["markdown-preview", "svg-to-png", "json-formatter", "text-diff", "regex-tester"],
});
