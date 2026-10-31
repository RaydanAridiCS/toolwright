import { Hash } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "hash-generator",
  name: "Hash Generator",
  tagline: "MD5, SHA-1, SHA-256, SHA-512, CRC-32 and HMAC for text or files.",
  description:
    "Compute MD5, SHA-1, SHA-256, SHA-384, SHA-512 and CRC-32 hashes of text or files, or an HMAC with your secret key. Files are hashed in your browser and are never uploaded.",
  primaryKeyword: "hash generator",
  seoTitle: "Hash Generator: MD5, SHA-256, SHA-1, HMAC",
  seoDescription:
    "Generate MD5, SHA-1, SHA-256, SHA-512 and CRC-32 hashes or an HMAC for text or files. Free, and files are hashed in your browser.",
  answer:
    "Hash Generator computes MD5, SHA-1, SHA-256, SHA-384, SHA-512 and CRC-32 hashes of text or files, and HMACs with your own secret key. Files are hashed in your browser and are never uploaded.",
  category: "encoding",
  keywords: ["hash generator", "md5 generator", "sha256", "checksum", "file hash", "hmac generator", "sha1"],
  icon: Hash,
  popular: true,
  howTo: ["Type text or drop a file.", "Choose the algorithms, or enter a secret key for an HMAC.", "Copy the hash you need."],
  faq: [
    {
      question: "Can I hash a large file?",
      answer: "Yes. The file is read locally by your browser. Very large files need enough free memory, since the whole file is loaded to compute the hash.",
    },
    {
      question: "Is MD5 secure?",
      answer: "No. MD5 and SHA-1 are broken for security purposes. Use them only for checksums and compatibility; prefer SHA-256 or better.",
    },
  ],
  nextStep: { slug: "password-generator", text: "Need a strong secret to start from? Generate a password." },
  related: ["jwt-decoder", "base64-encoder", "password-generator"],
});
