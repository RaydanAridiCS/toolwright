import { QrCode } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "qr-code-generator",
  name: "QR Code Generator",
  tagline: "Free QR codes for links, Wi-Fi, contacts and more. They never expire.",
  description:
    "Create QR codes for URLs, text, Wi-Fi networks, contact cards (vCard), email, SMS, phone numbers and map locations. Download as SVG or PNG. Codes are generated in your browser, are static (no tracking redirect) and never expire.",
  primaryKeyword: "qr code generator",
  seoTitle: "QR Code Generator: Free, No Expiry, No Sign-Up",
  seoDescription:
    "Make free QR codes for links, Wi-Fi, contacts, email and more. Download SVG or PNG. Static codes that never expire. Nothing is uploaded.",
  answer:
    "QR Code Generator makes QR codes for URLs, text, Wi-Fi networks, contact cards, email, SMS, phone numbers and map locations, and lets you download them as SVG or PNG. The codes are generated in your browser, are static with no tracking redirect, and never expire.",
  category: "design",
  keywords: ["qr code generator", "free qr code", "wifi qr code", "vcard qr", "qr code svg", "qr code png", "static qr code"],
  icon: QrCode,
  popular: true,
  howTo: ["Choose what the code holds, such as a link or Wi-Fi details.", "Fill in the details and pick a size and colors.", "Download the code as SVG or PNG."],
  faq: [
    { question: "Will my QR code stop working?", answer: "No. These are static QR codes: the content is encoded directly in the image, with no redirect service in between. They keep working forever and nothing about scans is tracked." },
    { question: "What error correction level should I choose?", answer: "Medium (M) suits most uses. Choose Quartile or High if the code will be printed small, worn, or have a logo placed over it, at the cost of a denser pattern." },
  ],
  nextStep: { slug: "barcode-generator", text: "Labelling products? Make an EAN or Code 128 barcode." },
  related: ["utm-builder", "url-cleaner", "image-to-base64", "barcode-generator"],
});
