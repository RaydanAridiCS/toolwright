import { Binary } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "hex-binary-converter",
  name: "Text to Hex & Binary Converter",
  tagline: "Convert text to hexadecimal or binary and back.",
  description:
    "Encode any text as UTF-8 hexadecimal or 8-bit binary, or decode hex and binary strings back to text. Choose separators and letter case. All in your browser.",
  primaryKeyword: "text to hex",
  seoTitle: "Text to Hex and Binary Converter, Both Ways",
  seoDescription:
    "Convert text to hexadecimal or binary and back, with your choice of separator and letter case. Free, runs in your browser.",
  answer:
    "Text to Hex & Binary Converter encodes text as UTF-8 hexadecimal or 8-bit binary, and decodes hex or binary strings back to text. You choose the separator and letter case, and it runs in your browser.",
  category: "encoding",
  keywords: ["text to hex", "hex to text", "text to binary", "binary to text", "ascii to hex"],
  icon: Binary,
  howTo: ["Paste your text, or a hex or binary string.", "Choose hex or binary, and the direction.", "Copy the result."],
  faq: [
    { question: "How do I convert text to binary?", answer: "Paste the text, choose binary output and copy the result. Each byte is shown as 8 bits." },
    { question: "Does it handle emoji and accents?", answer: "Yes. Text is encoded as UTF-8, so characters outside basic ASCII use more than one byte." },
    { question: "Can I convert hex back to text?", answer: "Yes. Switch to decode, paste the hex and read the text." },
  ],
  nextStep: { slug: "number-base-converter", text: "Converting numbers rather than text? Use the Number Base Converter." },
  related: ["base64-encoder", "number-base-converter", "unicode-escape"],
});
