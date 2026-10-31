import { Binary } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "base64-encoder",
  name: "Base64 Encode & Decode",
  tagline: "Encode text to Base64 or decode it back, UTF-8 safe.",
  description:
    "Encode or decode Base64 with full Unicode support, URL-safe output and optional padding removal. Handy for JWTs, data URIs and API payloads. Everything stays in your browser.",
  primaryKeyword: "base64 encode",
  seoTitle: "Base64 Encode & Decode Online (UTF-8 Safe)",
  seoDescription:
    "Encode text to Base64 or decode Base64 back to text online. Handles Unicode and URL-safe Base64. Free, no sign-up, runs in your browser.",
  answer:
    "Base64 Encode & Decode turns text into Base64, or Base64 back into text, in your browser. It handles Unicode (UTF-8) and can write URL-safe output without padding. Nothing you paste is uploaded.",
  category: "encoding",
  keywords: ["base64 encode", "base64 decode", "base64 converter", "url safe base64", "base64url", "decode base64"],
  icon: Binary,
  popular: true,
  howTo: ["Paste your text or a Base64 string.", "Choose to encode or decode, and turn on URL-safe output if you need it.", "Copy the result."],
  faq: [
    {
      question: "What is URL-safe Base64?",
      answer: "It swaps + and / for - and _ so the result can be used in URLs and filenames without escaping, and often drops the = padding. JWTs use this variant.",
    },
  ],
  nextStep: { slug: "image-to-base64", text: "Want to embed a picture instead of text? Convert an image to a Base64 data URI." },
  related: ["image-to-base64", "jwt-decoder", "hex-binary-converter", "url-encoder"],
});
