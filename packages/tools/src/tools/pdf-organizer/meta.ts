import { ListOrdered } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-organizer",
  name: "PDF Page Organizer",
  tagline: "Reorder, turn, duplicate and remove PDF pages from one list.",
  description:
    "Open a PDF and edit its pages in a single list with previews: move pages up or down, turn them, duplicate or remove them, reverse the order, or collate a double-sided scan. Then save one new PDF. Processed locally in your browser; the file is never uploaded.",
  primaryKeyword: "organize pdf pages",
  seoTitle: "Organize PDF Pages: Reorder, Rotate, Delete",
  seoDescription:
    "Reorder, rotate, duplicate and delete PDF pages in one list with previews, then save a new PDF. Free, and nothing is uploaded.",
  answer:
    "PDF Page Organizer lets you organize the pages of a PDF in one list with previews. Move pages up or down, turn them, duplicate or remove them, reverse the order or collate a double-sided scan, then save one new PDF. It runs in your browser.",
  category: "pdf",
  keywords: ["organize pdf", "reorder pdf pages", "rearrange pdf pages", "pdf page organizer", "reverse pdf pages", "duplex scan collate", "sort pdf pages"],
  icon: ListOrdered,
  howTo: [
    "Drop a PDF into the box. It stays on your device.",
    "Use the arrows to move pages, the turn buttons to rotate them, and the bin to remove them. Each row shows a preview of the page. Duplicate adds a copy right after a page.",
    "Choose Create PDF, then download the new file.",
  ],
  faq: [
    {
      question: "Is my PDF uploaded?",
      answer: "No. The pages are rearranged in your browser and the new file is made on your device.",
    },
    {
      question: "How are the page previews made, and are they uploaded?",
      answer:
        "Your browser draws them with PDF.js, which is loaded from this site only after you drop a file, and only for pages that scroll into view. Nothing is uploaded. If a preview cannot be drawn, the row shows a page icon and everything else still works.",
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
  nextStep: { slug: "merge-pdf", text: "Need to add pages from other files? Merge the PDFs." },
  related: ["extract-pdf-pages", "rotate-pdf", "delete-pdf-pages", "merge-pdf", "split-pdf", "pdf-to-images"],
});
