import { KeyRound } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "jwt-decoder",
  name: "JWT Decoder",
  tagline: "Decode and inspect JSON Web Tokens, and verify HMAC signatures.",
  description:
    "Decode the header and payload of any JWT, see expiry and issued-at times in plain English, and verify HS256/HS384/HS512 signatures with your secret. Tokens are decoded locally and never transmitted.",
  primaryKeyword: "jwt decoder",
  seoTitle: "JWT Decoder: Inspect JSON Web Tokens Online",
  seoDescription:
    "Decode a JWT's header and payload, see expiry in plain English and verify HS256, HS384 or HS512 signatures. Tokens never leave your browser.",
  answer:
    "JWT Decoder shows the header and payload of a JSON Web Token, turns the expiry and issued-at times into readable dates and verifies HS256, HS384 and HS512 signatures with your secret. The token is decoded in your browser and never transmitted.",
  category: "developer",
  keywords: ["jwt decoder", "jwt debugger", "decode jwt", "json web token", "jwt expiry", "verify jwt"],
  icon: KeyRound,
  popular: true,
  howTo: ["Paste the token.", "Read the decoded header and payload, with the expiry in plain English.", "Enter the secret if you want to check an HMAC signature."],
  faq: [
    { question: "Is it safe to paste a real token here?", answer: "Decoding happens entirely in your browser and the page makes no network requests. Even so, treat production tokens as secrets and prefer test tokens when you can." },
    { question: "Does decoding mean the token is valid?", answer: "No. Anyone can decode a JWT. Only verifying the signature with the right key proves it was issued by a trusted party and was not modified." },
  ],
  nextStep: { slug: "base64-encoder", text: "Want to see what the Base64 parts hold? Decode them by hand." },
  related: ["base64-encoder", "json-formatter", "timestamp-converter", "hash-generator"],
});
