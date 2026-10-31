import { Landmark } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "roman-numerals",
  name: "Roman Numeral Converter",
  tagline: "Convert numbers to Roman numerals and back (1–3999).",
  description: "Type a number to get its Roman numeral, or a Roman numeral to get the number. Enter one value per line to convert a whole list. Runs in your browser.",
  primaryKeyword: "roman numeral converter",
  seoTitle: "Roman Numeral Converter: Numbers 1 to 3999",
  seoDescription:
    "Convert numbers to Roman numerals and back, from 1 to 3999. Enter one value per line to convert a list. Free, in your browser.",
  answer:
    "Roman Numeral Converter turns a number from 1 to 3999 into its Roman numeral, or a Roman numeral into a number. Enter one value per line to convert a whole list. It runs in your browser.",
  category: "calculators",
  keywords: ["roman numerals", "roman numeral converter", "number to roman", "roman to number", "mcmxciv"],
  icon: Landmark,
  howTo: ["Type a number, or a Roman numeral.", "Read the conversion.", "Copy it, or enter several values on separate lines."],
  faq: [
    { question: "What is 2024 in Roman numerals?", answer: "2024 is MMXXIV in Roman numerals." },
    { question: "Why does it stop at 3999?", answer: "Standard Roman numerals have no symbol for 5000 and write at most three M in a row, so 3999 (MMMCMXCIX) is the largest number they can express." },
    { question: "Can it convert a list?", answer: "Yes. Put one value per line." },
  ],
  nextStep: { slug: "number-to-words", text: "Want the number spelled out in words? Convert it." },
  related: ["number-to-words", "number-base-converter", "prime-factors"],
});
