import { Stamp } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-watermark",
  name: "Add Watermark to PDF",
  tagline: "Stamp diagonal text such as DRAFT or CONFIDENTIAL on every page.",
  description: "Add a text watermark to every page of a PDF with your choice of size, opacity, angle and color. Your PDF stays in your browser and is never uploaded.",
  primaryKeyword: "add watermark to pdf",
  seoTitle: "Add Watermark to PDF Online, Free, No Upload",
  seoDescription:
    "Stamp text such as DRAFT or CONFIDENTIAL on every page of a PDF, with your size, opacity, angle and color. Nothing is uploaded.",
  answer:
    "Add Watermark to PDF stamps diagonal text such as DRAFT or CONFIDENTIAL on every page of a PDF, with your choice of size, opacity, angle and color. The PDF stays in your browser and is never uploaded.",
  category: "pdf",
  keywords: ["pdf watermark", "add watermark to pdf", "draft stamp", "confidential watermark", "text watermark pdf"],
  icon: Stamp,
  howTo: ["Drop a PDF into the box.", "Type the watermark text and set the size, opacity, angle and color.", "Download the watermarked PDF."],
  faq: [
    { question: "How do I add a watermark to a PDF?", answer: "Drop the PDF, type the watermark text, adjust the size, opacity, angle and color, and download the result." },
    { question: "Can I use an image as a watermark?", answer: "No. This tool stamps text only." },
    { question: "Does the free version add its own watermark?", answer: "No. The only watermark is the text you type. There is no paid version." },
  ],
  nextStep: { slug: "pdf-page-numbers", text: "Also need page numbers on the document? Add them next." },
  related: ["sign-pdf", "pdf-page-numbers", "merge-pdf", "pdf-metadata-editor"],
});
