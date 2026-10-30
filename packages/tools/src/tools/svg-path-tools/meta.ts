import { Spline } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-path-tools",
  name: "SVG Path Tools",
  tagline: "Convert, reverse, move, scale and measure SVG path data.",
  description:
    "Paste the d attribute of an SVG path and make it absolute or relative, turn arcs and shorthand commands into plain curves, reverse it, move, scale or rotate it, shorten the text and read its length and size. Everything runs in your browser, with nothing uploaded.",
  category: "design",
  keywords: ["svg path", "svg path converter", "svg path absolute relative", "reverse svg path", "svg path length", "transform svg path", "svg path to curves", "svg d attribute"],
  icon: Spline,
  howTo: [
    "Paste the path data, or a whole path tag with a d attribute.",
    "Choose what to do: absolute, relative, curves, reverse, or move, scale and rotate.",
    "Check the preview and copy the result.",
  ],
  faq: [
    {
      question: "Is my path uploaded?",
      answer: "No. The path is read and changed in your browser.",
    },
    {
      question: "Does changing a path change how it looks?",
      answer: "Making it absolute or relative, and shortening it, does not change the shape. Simplifying arcs and shorthand commands into curves keeps the shape within a tiny tolerance. Reverse keeps the shape but flips the direction, which matters for fills with holes and for animation.",
    },
    {
      question: "What does moving and scaling do to arcs?",
      answer: "Moving, uniform scaling and rotating keep arcs as arcs. Anything else, such as stretching one way only, turns them into curves so the shape stays exact.",
    },
    {
      question: "What is the length number?",
      answer: "It is the length along the path in drawing units, useful for stroke-dasharray line animations. For curves it is measured very closely, not exactly.",
    },
  ],
  related: ["svg-editor", "svg-optimizer", "svg-shape-generator", "svg-recolor"],
});
