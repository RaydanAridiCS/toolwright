import { Binary } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "number-base-converter",
  name: "Number Base Converter",
  tagline: "Binary, octal, decimal, hex and any base from 2 to 36.",
  description:
    "Convert integers between binary, octal, decimal, hexadecimal and any base up to 36, with arbitrary precision (BigInt) so very large numbers stay exact. Prefixes like 0x and 0b are understood.",
  primaryKeyword: "binary converter",
  seoTitle: "Binary Converter: Hex, Decimal and Any Base",
  seoDescription:
    "Convert numbers between binary, octal, decimal, hexadecimal and any base up to 36, exact for very large values. Free, in your browser.",
  answer:
    "Number Base Converter converts whole numbers between binary, octal, decimal, hexadecimal and any base up to 36. It uses arbitrary precision (BigInt), so very large numbers stay exact, and it understands prefixes such as 0x and 0b.",
  category: "calculators",
  keywords: ["binary converter", "hex to decimal", "decimal to binary", "base converter", "octal converter", "bigint"],
  icon: Binary,
  howTo: ["Type a number, with a prefix such as 0x or 0b if you like.", "Choose the base you are converting from.", "Copy the value in the base you need."],
  faq: [
    { question: "How do I convert binary to decimal?", answer: "Type the binary number, such as 1011, and read the decimal value (11) in the list of bases." },
    { question: "How do I convert hex to decimal?", answer: "Enter the hex value, with or without the 0x prefix, and read the decimal result." },
    { question: "Does it handle very large numbers?", answer: "Yes. It works with arbitrary-size integers, so there is no rounding." },
  ],
  nextStep: { slug: "hex-binary-converter", text: "Converting text rather than numbers? Use the Text to Hex & Binary Converter." },
  related: ["hex-binary-converter", "chmod-calculator", "roman-numerals"],
});
