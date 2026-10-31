import { ShieldCheck } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "password-generator",
  name: "Password & Passphrase Generator",
  tagline: "Strong random passwords and memorable passphrases, made locally.",
  description:
    "Generate strong random passwords or word-based passphrases with your browser's cryptographic random source. See the real entropy in bits, tune length and character sets, and copy with one click. Nothing is sent or stored.",
  primaryKeyword: "password generator",
  seoTitle: "Password Generator: Strong and Random, Private",
  seoDescription:
    "Generate strong random passwords or passphrases with your browser's secure random source. See the entropy. Nothing is sent or stored.",
  answer:
    "Password & Passphrase Generator makes strong random passwords or word-based passphrases using your browser's cryptographic random source. It shows the entropy in bits, lets you tune the length and character sets, and sends and stores nothing.",
  category: "generators",
  keywords: ["password generator", "random password", "strong password", "passphrase generator", "secure password"],
  icon: ShieldCheck,
  popular: true,
  howTo: ["Choose a password or a passphrase.", "Set the length and the character types.", "Copy the result with one click."],
  faq: [
    { question: "Are these passwords stored or transmitted?", answer: "No. They are generated on your device with crypto.getRandomValues and exist only on this page until you close or refresh it." },
    { question: "How long should a password be?", answer: "For random passwords, 16 or more characters is a good default. For passphrases, use at least 5 words from the 2,048-word list (about 55 bits) and 6 or more for important accounts." },
  ],
  nextStep: { slug: "hash-generator", text: "Need to hash a value? Generate SHA-256, MD5 and more." },
  related: ["unique-id-generator", "hash-generator", "base64-encoder"],
});
