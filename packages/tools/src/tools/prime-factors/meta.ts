import { Sigma } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "prime-factors",
  name: "Prime Factorization & GCD/LCM",
  tagline: "Factor numbers into primes, and find the GCD and LCM.",
  description: "Break whole numbers into prime factors, check whether they are prime, and find the greatest common divisor and least common multiple of a list. Works up to 2^53.",
  primaryKeyword: "prime factorization",
  seoTitle: "Prime Factorization, GCD and LCM Calculator",
  seoDescription:
    "Break a number into prime factors, check if it is prime, and find the greatest common divisor and least common multiple. Free.",
  answer:
    "Prime Factorization & GCD/LCM breaks whole numbers into prime factors, checks whether a number is prime and finds the greatest common divisor and least common multiple of a list. It works with whole numbers up to 2^53, and runs in your browser.",
  category: "calculators",
  keywords: ["prime factorization", "prime checker", "gcd calculator", "lcm calculator", "factor tree", "is prime"],
  icon: Sigma,
  howTo: ["Enter a number, or a list of numbers.", "Read the prime factors and whether the number is prime.", "Read the GCD and LCM of a list."],
  faq: [
    { question: "How do I find the prime factors of a number?", answer: "Enter the number and the tool lists its prime factors and the exponents, such as 360 = 2^3 x 3^2 x 5." },
    { question: "How do I find the GCD or LCM of several numbers?", answer: "Enter the numbers as a list and read the greatest common divisor and least common multiple." },
    { question: "What is the largest number it can handle?", answer: "Whole numbers up to 2^53, which is 9,007,199,254,740,992." },
  ],
  nextStep: { slug: "number-base-converter", text: "Working in another base? Convert the number first." },
  related: ["number-to-words", "roman-numerals", "number-base-converter"],
});
