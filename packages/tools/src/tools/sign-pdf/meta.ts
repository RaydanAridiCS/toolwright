import { PenLine } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "sign-pdf",
  name: "Sign PDF",
  tagline: "Draw, type or upload your signature and place it on a PDF.",
  description:
    "Add a signature picture to a PDF in your browser. Draw it, type it or upload a photo of it, drag it into place on a page preview, and sign one page, the last page or every page, with an optional date line. Your file and signature never leave your device. It is a visible signature, not a certified digital one.",
  primaryKeyword: "sign pdf",
  seoTitle: "Sign PDF Online Free: Draw, Type or Upload",
  seoDescription:
    "Add your signature to a PDF: draw it, type it or upload a photo, then place it on the page. Free, and your file never leaves your device.",
  answer:
    "Sign PDF adds a visible signature to a PDF in your browser. Draw it, type it or upload a picture of it, drag it into place on a page preview and sign one page, the last page or every page. It is a visible signature, not a certified digital one, and your file and signature never leave your device.",
  category: "pdf",
  keywords: ["sign pdf", "add signature to pdf", "sign pdf online free", "pdf signature", "e-sign pdf no upload", "draw signature pdf", "sign a document"],
  icon: PenLine,
  popular: true,
  howTo: [
    "Drop your PDF, then draw, type or upload your signature.",
    "Drag the signature to the right spot on the page preview. Use the corner square or the + and - keys to resize it.",
    "Choose which pages to sign, optionally add a date line, and download the signed PDF.",
  ],
  faq: [
    {
      question: "Are my PDF and signature uploaded?",
      answer: "No. The page preview, the signature and the finished PDF are all made in your browser. Nothing is sent anywhere, so you can use it for contracts and forms.",
    },
    {
      question: "Is this a legally binding or digital signature?",
      answer:
        "It is a picture of your signature placed on the page, like signing a printout. It does not use a certificate and does not prove who signed or whether the file changed afterwards. Whether it is accepted depends on the document, the other party and your country's rules. Where a certified e-signature is required, use a service that provides one.",
    },
    {
      question: "Can someone copy my signature from the signed PDF?",
      answer: "Yes. It is an ordinary picture inside the file, so anyone who has the PDF can extract it. Sign only files you are happy to share, and consider adding a date line.",
    },
    {
      question: "What happens to a PDF that is already digitally signed?",
      answer: "Any change breaks an existing digital signature, including adding a picture. The tool warns you when a file looks digitally signed.",
    },
    {
      question: "Will the signature be in the right place on rotated pages?",
      answer: "Yes. It is placed where you see it on the page as shown, even for pages stored turned by 90, 180 or 270 degrees, and it stays upright.",
    },
    {
      question: "Why does my typed signature look different on another device?",
      answer: "Typed signatures use handwriting-style fonts installed on your device, and the website cannot load fonts from elsewhere. The result is saved as a picture, so it looks the same everywhere once it is in the PDF.",
    },
  ],
  nextStep: { slug: "pdf-watermark", text: "Need to mark the document as a draft or confidential? Add a watermark." },
  related: ["merge-pdf", "pdf-watermark", "compress-pdf", "images-to-pdf", "pdf-metadata-editor"],
});
