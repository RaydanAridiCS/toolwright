/** Questions people ask about the site itself. Shown on the home page and mirrored in its FAQPage JSON-LD. */
export const HOME_FAQ = [
  {
    question: "Is Toolwright really free?",
    answer: "Yes. Every tool is free, there is no account, we add no watermark to your files and there is no paid version. The project is open source under the MIT license.",
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. The tools run in your browser, so files and text are processed on your device. The page is only allowed to talk to its own site, which your browser enforces, and you can confirm it in the Network tab of your developer tools.",
  },
  {
    question: "Does Toolwright work offline?",
    answer: "Once you have opened a tool, it keeps working without a connection, because the page and its code are saved by your browser. A tool you have never opened needs a connection the first time.",
  },
  {
    question: "Do I need to sign up or install anything?",
    answer: "No. There are no accounts and nothing to install. Toolwright is a website, and your browser can also install it as an app if you want that.",
  },
  {
    question: "Which PDF and image tools are there?",
    answer: "For PDFs: merge, split, compress, rotate, extract and delete pages, reorder, add page numbers or a watermark, sign, and convert to pictures or text. For images: compress, resize, crop, convert formats, view or remove EXIF data, trace to SVG, and make or edit GIFs.",
  },
  {
    question: "Who makes Toolwright?",
    answer: "Toolwright is developed and maintained by raydan.dev, and the source code is public on GitHub, so anyone can read how a tool works.",
  },
] as const;
