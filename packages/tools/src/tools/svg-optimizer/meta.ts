import { Minimize2 } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "svg-optimizer",
  name: "SVG Optimizer",
  tagline: "Shrink SVG files by removing editor junk and extra digits.",
  description:
    "Drop one SVG or a whole folder of them and make them much smaller with SVGO, the standard optimizer. See before and after side by side, choose how many decimals to keep, and download a ZIP. Everything runs in your browser; your files are never uploaded.",
  category: "design",
  keywords: ["svg optimizer", "svg minifier", "compress svg", "svgo online", "reduce svg size", "minify svg", "svg compressor", "clean svg"],
  icon: Minimize2,
  popular: true,
  howTo: [
    "Drop your SVG files, or load the sample.",
    "Check the before and after pictures, and change the options if something looks off.",
    "Copy the result or download it, or download all files as a ZIP.",
  ],
  faq: [
    {
      question: "Are my SVG files uploaded?",
      answer: "No. SVGO runs in your browser, loaded from this site only after you add a file. Nothing is sent anywhere.",
    },
    {
      question: "Will it change how my SVG looks?",
      answer: "It should not, and the before and after previews let you check. It removes comments, editor data (Inkscape, Illustrator, Sketch), unused definitions and hidden elements, shortens numbers and paths, and merges shapes. If something changes, raise the decimal places or turn on Keep ids.",
    },
    {
      question: "Why does it keep the viewBox?",
      answer: "The viewBox is what lets an SVG scale to any size. Removing it is the most common way optimizers break icons, so it is always kept. You can remove width and height instead.",
    },
    {
      question: "What does “returned as it was” mean?",
      answer: "If the optimized version is not smaller than your file, the tool gives you the original rather than a bigger one. Files that are already minimal are common.",
    },
    {
      question: "Does it remove scripts?",
      answer: "Only if you ask, with Remove scripts and event handlers. For untrusted files use the SVG Sanitizer, which is built for that.",
    },
  ],
  related: ["svg-editor", "svg-sanitizer", "svg-to-react", "svg-data-uri", "image-compressor"],
});
