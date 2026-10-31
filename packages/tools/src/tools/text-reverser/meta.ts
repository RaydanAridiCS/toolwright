import { ArrowLeftRight } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "text-reverser",
  name: "Text Reverser",
  tagline: "Reverse characters or word order, emoji-safe.",
  description: "Reverse a string character by character or flip the order of its words. Emoji and combined characters stay intact. Runs entirely in your browser.",
  primaryKeyword: "reverse text",
  seoTitle: "Reverse Text Online: Letters or Word Order",
  seoDescription:
    "Reverse a string character by character or flip the order of its words. Emoji and combined characters stay intact. Free, in your browser.",
  answer:
    "Text Reverser lets you reverse text character by character or flip the order of its words. Emoji and combined characters stay intact. It runs in your browser.",
  category: "text",
  keywords: ["reverse text", "reverse string", "backwards text", "flip text", "reverse words"],
  icon: ArrowLeftRight,
  howTo: ["Paste your text.", "Choose to reverse the characters or the word order.", "Copy the result."],
  faq: [
    { question: "How do I reverse text?", answer: "Paste the text and choose to reverse the characters or the words." },
    { question: "Does it break emoji?", answer: "No. Emoji and letters with accents are kept whole." },
    { question: "Is my text uploaded?", answer: "No. It is reversed in your browser." },
  ],
  nextStep: { slug: "line-tools", text: "Reversing a list? Reverse or sort the lines." },
  related: ["case-converter", "line-tools", "text-ciphers"],
});
