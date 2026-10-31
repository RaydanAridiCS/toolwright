import { Lock } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "text-ciphers",
  name: "ROT13, Caesar & Morse Code",
  tagline: "Classic ciphers for puzzles, games and learning.",
  description:
    "Encode and decode ROT13, Caesar shifts and Morse code. These ciphers are for fun and puzzles only and provide no real security. Runs in your browser.",
  primaryKeyword: "rot13",
  seoTitle: "ROT13, Caesar Cipher and Morse Code Translator",
  seoDescription:
    "Encode and decode ROT13, Caesar shifts and Morse code online. For puzzles and learning, not security. Free, runs in your browser.",
  answer:
    "ROT13, Caesar & Morse Code encodes and decodes ROT13, Caesar shifts and Morse code in your browser. These ciphers are for fun, puzzles and learning only and give no real security.",
  category: "encoding",
  keywords: ["rot13", "caesar cipher", "morse code translator", "text cipher", "encode morse"],
  icon: Lock,
  howTo: ["Choose ROT13, Caesar or Morse code.", "Paste or type your text, and set the shift for a Caesar cipher.", "Copy the encoded or decoded text."],
  faq: [
    { question: "What is ROT13?", answer: "A Caesar cipher that shifts every letter 13 places. Because the alphabet has 26 letters, applying it twice gives back the original text." },
    { question: "Is a Caesar cipher secure?", answer: "No. It has only 25 possible shifts and is broken in seconds. Use it for puzzles, never for secrets." },
    { question: "Can it translate Morse code?", answer: "Yes. It converts text to Morse and Morse back to text." },
  ],
  nextStep: { slug: "base64-encoder", text: "Want real encoding rather than a puzzle cipher? Try Base64." },
  related: ["base64-encoder", "text-reverser", "hex-binary-converter"],
});
