import { Waypoints } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-to-svg",
  name: "Image to SVG",
  tagline: "Trace a logo or drawing into a scalable SVG.",
  description:
    "Turn a PNG, JPG, WebP or GIF into SVG paths in black and white or colour, with control over detail, noise and the number of colours. Best for logos, icons and line art. It runs in your browser and your picture is never uploaded.",
  category: "image",
  keywords: ["image to svg", "png to svg", "jpg to svg", "vectorize image", "trace image", "raster to vector", "logo to svg", "bitmap to svg"],
  icon: Waypoints,
  popular: true,
  howTo: [
    "Drop a logo, icon or drawing.",
    "Choose black and white or colour, and adjust the detail until the traced picture looks right.",
    "Copy the SVG or download it.",
  ],
  faq: [
    {
      question: "Is my picture uploaded?",
      answer: "No. The picture is decoded and traced in your browser, in a background worker. Nothing is sent anywhere.",
    },
    {
      question: "What kinds of pictures trace well?",
      answer: "Logos, icons, signatures, stamps and flat illustrations with clear edges. Photographs and soft colour fades turn into large, lumpy files, because an SVG is made of shapes and not pixels.",
    },
    {
      question: "Why does the black and white result look wrong?",
      answer: "Turn off the automatic cut-off and move it. A higher number turns more of the picture black. A lightly shaded logo usually needs a higher cut-off, and a pale scan a lower one.",
    },
    {
      question: "Why was my picture made smaller?",
      answer: "Tracing a large picture is slow and gives an enormous file, so pictures above about 1.5 million pixels are scaled down first. An SVG scales to any size afterwards, so you lose nothing you need.",
    },
    {
      question: "Can I make the result smaller?",
      answer: "Yes. Use fewer colours, a smoother detail level or a higher Ignore specks value, then run the SVG through the SVG Optimizer.",
    },
  ],
  related: ["svg-optimizer", "svg-editor", "svg-recolor", "image-converter", "svg-to-png"],
});
