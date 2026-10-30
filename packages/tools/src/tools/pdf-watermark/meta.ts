import { Stamp } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "pdf-watermark",
  name: "Add Watermark to PDF",
  tagline: "Stamp diagonal text such as DRAFT or CONFIDENTIAL on every page.",
  description: "Add a text watermark to every page of a PDF with your choice of size, opacity, angle and color. Your PDF stays in your browser and is never uploaded.",
  category: "pdf",
  keywords: ["pdf watermark", "add watermark to pdf", "draft stamp", "confidential watermark", "text watermark pdf"],
  icon: Stamp,
  related: ["sign-pdf", "pdf-page-numbers", "merge-pdf", "pdf-metadata-editor"],
});
