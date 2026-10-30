import { Film } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "gif-maker",
  name: "GIF Maker",
  tagline: "Turn a set of pictures into an animated GIF.",
  description:
    "Drop PNG, JPG or WebP pictures, put them in order, set the speed, size and looping, and make an animated GIF. Pictures of other shapes are fitted or cropped for you. Everything runs in your browser; your pictures are never uploaded.",
  category: "image",
  keywords: ["gif maker", "images to gif", "create gif", "png to gif animation", "make animated gif", "photos to gif", "slideshow gif", "frames to gif"],
  icon: Film,
  howTo: [
    "Drop your pictures and put them in the order you want.",
    "Set the width, the delay between frames and how many times it plays.",
    "Press Make GIF, check it, and download.",
  ],
  faq: [
    {
      question: "Are my pictures uploaded?",
      answer: "No. The pictures are read and joined into a GIF in your browser, in a background worker. Nothing is sent anywhere.",
    },
    {
      question: "Why is my GIF so big?",
      answer: "GIF is an old format that stores every frame as pictures. Use a smaller width (the biggest saving), fewer colours and fewer frames, and keep Optimize on.",
    },
    {
      question: "What size is the GIF?",
      answer: "The width you choose, with the height taken from the first picture. Pictures of other shapes are fitted inside with bars, filled with the edges cropped, or stretched, as you choose.",
    },
    {
      question: "Can it make a GIF from a video?",
      answer: "No. This tool joins pictures. To use a video, save its frames as pictures first.",
    },
    {
      question: "Why can I not set a delay below 20 ms?",
      answer: "Browsers show any delay of 10 ms or less as 100 ms, so very short delays make a GIF slower, not faster.",
    },
  ],
  related: ["gif-editor", "image-resizer", "image-converter", "image-compressor"],
});
