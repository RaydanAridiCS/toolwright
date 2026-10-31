import { Component } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-to-react",
  name: "SVG to React",
  tagline: "Turn an SVG into a React or TypeScript component.",
  description:
    "Convert an SVG into a React component with the right attribute names, style objects and optional TypeScript, props, currentColor and memo. Editor junk is dropped for you. It runs in your browser; your SVG is never uploaded.",
  primaryKeyword: "svg to react",
  seoTitle: "SVG to React Component Converter (JSX, TSX)",
  seoDescription:
    "Convert an SVG into a React component with correct attribute names, optional TypeScript, props and currentColor. Free, runs in your browser.",
  answer:
    "SVG to React converts an SVG into a React component with the right attribute names, style objects and optional TypeScript, props, currentColor and memo, and drops editor junk. It runs in your browser, so your SVG is never uploaded.",
  category: "developer",
  keywords: ["svg to react", "svg to jsx", "svg to tsx", "svg react component", "svgr online", "convert svg to component", "react icon component", "svg to typescript"],
  icon: Component,
  popular: true,
  howTo: [
    "Paste your SVG or drop the file.",
    "Name the component and choose JavaScript or TypeScript.",
    "Copy the component into your project.",
  ],
  faq: [
    {
      question: "Is my SVG uploaded?",
      answer: "No. The conversion runs in your browser and nothing is sent anywhere.",
    },
    {
      question: "What changes besides attribute names?",
      answer: "class becomes className, stroke-width becomes strokeWidth, inline style strings become objects, and comments, the XML declaration, editor namespaces and metadata are removed. A note under the result lists what was changed.",
    },
    {
      question: "How do I make the icon take the text colour?",
      answer: "Turn on Use currentColor. Fills and strokes then use the colour of the surrounding text, so you can change it with CSS.",
    },
    {
      question: "Does it work with Next.js, Vite and React Native?",
      answer: "The output is standard JSX and TSX, so it works with Next.js and Vite. React Native needs react-native-svg components instead, which this tool does not produce.",
    },
  ],
  nextStep: { slug: "svg-optimizer", text: "Smaller components start with a smaller SVG. Optimize it first." },
  related: ["svg-optimizer", "svg-data-uri", "svg-editor", "html-to-markdown"],
});
