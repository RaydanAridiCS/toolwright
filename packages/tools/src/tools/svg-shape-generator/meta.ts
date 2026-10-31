import { Shapes } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-shape-generator",
  name: "SVG Shape Generator",
  tagline: "Make blobs, waves, polygons and stars as clean SVG.",
  description:
    "Generate organic blobs, layered waves, regular polygons and stars with the sliders you choose, then copy the SVG or download SVG or PNG. The same seed always gives the same shape. Everything is made in your browser; nothing is uploaded.",
  primaryKeyword: "svg blob generator",
  seoTitle: "SVG Blob Generator: Blobs, Waves, Shapes",
  seoDescription:
    "Make organic blobs, layered waves, polygons and stars as clean SVG with sliders. Copy the code or download SVG or PNG. Free.",
  answer:
    "SVG Shape Generator is an SVG blob generator that also makes layered waves, regular polygons and stars with sliders, then lets you copy the SVG or download SVG or PNG. The same seed always gives the same shape, and everything is made in your browser.",
  category: "design",
  keywords: ["svg blob generator", "svg wave generator", "svg shape generator", "random blob svg", "svg polygon", "svg star generator", "section divider svg", "wave divider"],
  icon: Shapes,
  howTo: [
    "Pick a shape: blob, wave, polygon or star.",
    "Adjust the sliders and the colour. For blobs and waves, press New for another shape.",
    "Copy the SVG code or download it as SVG or PNG.",
  ],
  faq: [
    {
      question: "Is anything uploaded?",
      answer: "No. The shapes are calculated in your browser.",
    },
    {
      question: "How do I get the same blob again?",
      answer: "Keep the seed number. The same seed and settings always make the same shape, so you can save the seed instead of the file.",
    },
    {
      question: "How do I use a wave as a divider between sections?",
      answer: "Download the SVG, place it at the top or bottom of the section and set its width to 100%. Use Fill above the line for a wave at the top of a section.",
    },
    {
      question: "Can I recolour it later?",
      answer: "Yes. Open the SVG in SVG Recolor, or change the fill value in the code.",
    },
  ],
  nextStep: { slug: "svg-recolor", text: "Want different colors? Recolor the shape." },
  related: ["svg-editor", "svg-recolor", "svg-optimizer", "svg-path-tools"],
});
