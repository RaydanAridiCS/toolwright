import { Fingerprint } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "unique-id-generator",
  name: "UUID, ULID & NanoID Generator",
  tagline: "Generate UUID v4, UUID v7, ULID and NanoID values in bulk.",
  description:
    "Generate random unique identifiers: UUID v4, time-ordered UUID v7, sortable ULIDs and compact NanoIDs. Create up to 1,000 at once with your browser's cryptographic random number generator.",
  category: "generators",
  keywords: ["uuid generator", "guid generator", "uuid v4", "uuid v7", "ulid generator", "nanoid", "random id"],
  icon: Fingerprint,
  popular: true,
  faq: [
    { question: "Which should I use, UUID v4 or v7?", answer: "v4 is fully random. v7 starts with a timestamp so values sort by creation time, which is friendlier to database indexes. Both are fine for uniqueness." },
    { question: "How random are these IDs?", answer: "They use crypto.getRandomValues, the same cryptographically secure source browsers use for TLS keys." },
  ],
  related: ["password-generator", "hash-generator", "lorem-ipsum", "barcode-generator"],
});
