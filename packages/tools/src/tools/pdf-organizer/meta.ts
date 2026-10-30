import { ListOrdered } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-organizer",
  name: "PDF Page Organizer",
  tagline: "Reorder, turn, duplicate and remove PDF pages from one list.",
  description:
    "Open a PDF and edit its pages in a single list: move pages up or down, turn them, duplicate or remove them, reverse the order, or collate a double-sided scan. Then save one new PDF. Processed locally in your browser; the file is never uploaded.",
  category: "pdf",
  keywords: ["organize pdf", "reorder pdf pages", "rearrange pdf pages", "pdf page organizer", "reverse pdf pages", "duplex scan collate", "sort pdf pages"],
  icon: ListOrdered,
  howTo: [
    "Drop a PDF into the box. It stays on your device.",
    "Use the arrows to move pages, the turn buttons to rotate them, and the bin to remove them. Duplicate adds a copy right after a page.",
    "Choose Create PDF, then download the new file.",
  ],
  faq: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. The pages are rearranged in your browser and the new file is made on your device.",
    },
    {
      question: "Why are there no page thumbnails?",
      answer: "Drawing previews needs a large PDF renderer, which this site avoids to stay fast. Each row shows the original page number and size instead, and the result is a normal PDF you can check in any viewer.",
    },
    {
      question: "What does “Collate double-sided scan” do?",
      answer:
        "If you scanned a stack of double-sided sheets in two passes, fronts first and then the backs in reverse order, this interleaves them into the right reading order. It needs an even number of pages.",
    },
    {
      question: "How is this different from Extract PDF Pages?",
      answer: "Extract PDF Pages takes a typed list of page numbers. This tool is a visual list where you can also turn and duplicate individual pages, which suits a few hands-on fixes.",
    },
  ],
  related: ["extract-pdf-pages", "rotate-pdf", "delete-pdf-pages", "merge-pdf", "split-pdf"],
});
