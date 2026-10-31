import { Palette } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-recolor",
  name: "SVG Recolor",
  tagline: "See every colour in an SVG and change it in one click.",
  description:
    "List all the colours in an SVG, swap any of them, or change them all at once: invert, grayscale, lighten, darken, one colour for everything, or currentColor for icons. Works on attributes, style and style blocks. Runs in your browser; nothing is uploaded.",
  primaryKeyword: "svg recolor",
  seoTitle: "SVG Recolor: Change SVG Colors Online",
  seoDescription:
    "List every color in an SVG and change one or all: invert, grayscale, lighten, darken or switch to currentColor. Free, in your browser.",
  answer:
    "SVG Recolor lists all the colors in an SVG and lets you swap any of them or change them all at once: invert, grayscale, lighten, darken, one color for everything or currentColor for icons. It works on attributes, style and style blocks, and runs in your browser.",
  category: "design",
  keywords: ["svg recolor", "change svg color", "svg color changer", "svg currentcolor", "invert svg", "svg grayscale", "replace color in svg", "svg color palette"],
  icon: Palette,
  popular: true,
  howTo: [
    "Drop an SVG or paste its code.",
    "Pick a new colour for any colour in the list, or use a button to change them all.",
    "Undo if you need to, then copy or download the result.",
  ],
  faq: [
    {
      question: "Is my SVG uploaded?",
      answer: "No. The colours are found and changed in your browser.",
    },
    {
      question: "Where does it look for colours?",
      answer: "In fill, stroke, stop-color, flood-color, lighting-color and color, whether they are written as attributes, inside style attributes or in a style block. Colour names, three-digit and six-digit codes, rgb() and hsl() all count as the same colour.",
    },
    {
      question: "What does Use currentColor do?",
      answer: "It makes fills and strokes follow the text colour, so an icon inline in a page can be recoloured with CSS. Shapes with no fill or stroke, colour fades and none are left alone.",
    },
    {
      question: "Why does a colour I changed look the same?",
      answer: "Some SVGs colour shapes through a style block with classes, or through a colour fade. Those are changed too, but a shape that has no colour set draws in black by default and there is nothing to replace.",
    },
  ],
  nextStep: { slug: "svg-optimizer", text: "Next, shrink the recolored file with the SVG Optimizer." },
  related: ["svg-editor", "svg-optimizer", "color-converter", "svg-to-react"],
});
