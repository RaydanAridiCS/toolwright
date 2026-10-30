import { AppWindow } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "favicon-generator",
  name: "Favicon Generator",
  tagline: "Make a complete favicon pack from one image, ready to upload.",
  description:
    "Turn a logo into favicon.ico, PNG icons for browsers, iOS and Android, a web app manifest and the HTML tags to use them, all in one ZIP. Your image is processed in your browser and never uploaded.",
  category: "design",
  keywords: ["favicon generator", "favicon maker", "create favicon", "png to ico", "apple touch icon", "favicon.ico generator", "site icon generator", "web app manifest icons"],
  icon: AppWindow,
  howTo: [
    "Drop in your logo. A square PNG or SVG of at least 512 pixels works best.",
    "Choose how to handle non-square images, and set a background for the iOS icon.",
    "Download the ZIP, upload the files to your site, and paste the HTML tags into your page's head.",
  ],
  faq: [
    {
      question: "Is my image uploaded?",
      answer: "No. The icons are drawn and packed into a ZIP in your browser, and nothing is sent to a server.",
    },
    {
      question: "Which files are in the ZIP?",
      answer:
        "favicon.ico (16, 32 and 48 px), favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png (180 px), android-chrome-192x192.png, android-chrome-512x512.png, site.webmanifest and head-snippet.html. If you start from an SVG, favicon.svg is included too.",
    },
    {
      question: "Why does the iOS icon have a solid background?",
      answer: "iOS fills transparent areas of the home screen icon with black. The tool paints your chosen colour behind that one icon so it looks as intended.",
    },
    {
      question: "Does a tiny favicon keep its detail?",
      answer: "Not always. A detailed logo can turn to mush at 16 pixels. If so, use a simplified mark as the source image.",
    },
  ],
  related: ["image-resizer", "image-converter", "svg-to-png", "svg-editor", "image-to-svg"],
});
