import { Clapperboard } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "gif-editor",
  name: "GIF Editor",
  tagline: "Trim, speed up, reverse, resize and shrink animated GIFs.",
  description:
    "Cut frames, change the speed, reverse or boomerang an animated GIF, rotate, flip, resize, reduce colours and save a smaller file, or export every frame as PNG. Everything runs in your browser; your GIF is never uploaded.",
  primaryKeyword: "gif editor",
  seoTitle: "GIF Editor: Trim, Resize and Compress GIFs",
  seoDescription:
    "Trim, speed up, reverse, resize and shrink animated GIFs, or export frames as PNG. Free, no sign-up, and nothing is uploaded.",
  answer:
    "GIF Editor trims, speeds up, slows down, reverses, rotates, flips, resizes and shrinks animated GIFs, and can export every frame as PNG. It runs in your browser, so your GIF is never uploaded.",
  category: "image",
  keywords: ["gif editor", "gif compressor", "reduce gif size", "reverse gif", "speed up gif", "resize gif", "trim gif", "gif to png frames"],
  icon: Clapperboard,
  popular: true,
  howTo: [
    "Drop an animated GIF.",
    "Choose what to change: frames, order, speed, size or colours, then press Apply.",
    "Compare the result with the original and download it, or save every frame as PNG.",
  ],
  faq: [
    {
      question: "Is my GIF uploaded?",
      answer: "No. The GIF is read, edited and saved in your browser, in a background worker. Nothing is sent anywhere.",
    },
    {
      question: "How do I make a GIF smaller?",
      answer: "Use a smaller width, fewer colours, one frame in every 2 and keep Optimize on. Size matters most: halving the width cuts the pixels to a quarter.",
    },
    {
      question: "Why can I not set a delay below 20 ms?",
      answer: "Browsers show any delay of 10 ms or less as 100 ms, so very short delays make a GIF slower, not faster. The tool keeps every delay at 20 ms or more.",
    },
    {
      question: "Why does the result sometimes look a little different?",
      answer: "A GIF can hold only 256 colours per frame. Saving again chooses a fresh palette, which can change colour fades slightly. Fewer colours will show more banding.",
    },
    {
      question: "What are the limits?",
      answer: "Up to 100 MB, 500 frames and about 60 million pixels over all frames (for example 500 × 500 for 240 frames). Larger GIFs are refused with a reason, because the tab would run out of memory.",
    },
  ],
  nextStep: { slug: "gif-maker", text: "Starting from pictures instead? Make a GIF from a set of images." },
  related: ["gif-maker", "image-compressor", "image-resizer", "image-converter"],
});
