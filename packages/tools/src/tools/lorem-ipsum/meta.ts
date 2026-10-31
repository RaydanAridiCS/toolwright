import { Pilcrow } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "lorem-ipsum",
  name: "Lorem Ipsum Generator",
  tagline: "Placeholder text by paragraph, sentence or word.",
  description: "Generate lorem ipsum placeholder text for mockups and layouts: paragraphs, sentences or words, optionally wrapped in HTML paragraph tags. Generated locally, no sign-up.",
  primaryKeyword: "lorem ipsum generator",
  seoTitle: "Lorem Ipsum Generator: Placeholder Text",
  seoDescription:
    "Generate lorem ipsum placeholder text by paragraph, sentence or word, with optional HTML paragraph tags. Free, no sign-up.",
  answer:
    "Lorem Ipsum Generator makes placeholder text for mockups and layouts as paragraphs, sentences or words, optionally wrapped in HTML paragraph tags. It is generated in your browser.",
  category: "generators",
  keywords: ["lorem ipsum", "placeholder text", "dummy text", "filler text", "sample text"],
  icon: Pilcrow,
  popular: true,
  howTo: ["Choose paragraphs, sentences or words and the amount.", "Turn on HTML paragraph tags if you want them.", "Copy the text."],
  faq: [
    { question: "What is lorem ipsum?", answer: "Placeholder text that fills a layout so you can judge the design without real copy. It is scrambled Latin and carries no meaning." },
    { question: "Can I get the text wrapped in HTML?", answer: "Yes. Turn on the option to wrap each paragraph in paragraph tags." },
    { question: "Is anything sent to a server?", answer: "No. The text is generated in your browser." },
  ],
  nextStep: { slug: "word-counter", text: "Filling a layout? Count the words in your placeholder text." },
  related: ["word-counter", "unique-id-generator", "password-generator"],
});
