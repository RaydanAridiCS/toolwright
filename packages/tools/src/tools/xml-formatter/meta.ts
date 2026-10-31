import { FileCode } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "xml-formatter",
  name: "XML Formatter & Converter",
  tagline: "Check, format and shrink XML, or convert it to and from JSON.",
  description:
    "Paste XML to check that it is well-formed, with the line and column of the first problem, then format it with the indent you like, shrink it to one line, or convert it to JSON and back. Everything runs in your browser, so your XML is never uploaded.",
  primaryKeyword: "xml formatter",
  seoTitle: "XML Formatter and Validator, XML to JSON",
  seoDescription:
    "Check that XML is well-formed, format it with your indent, shrink it or convert it to JSON and back. Free, and runs in your browser.",
  answer:
    "XML Formatter & Converter checks that XML is well-formed, with the line and column of the first problem, then formats it, shrinks it to one line or converts it to JSON and back. It checks well-formedness only, not XSD or DTD validity, and everything runs in your browser.",
  category: "developer",
  keywords: ["xml formatter", "xml validator", "xml beautifier", "xml minifier", "xml to json", "json to xml", "pretty print xml", "format xml online", "xml checker"],
  icon: FileCode,
  howTo: [
    "Paste your XML, or drop a file.",
    "Choose Format, Minify, Check, XML to JSON or JSON to XML.",
    "Copy the result or download it.",
  ],
  faq: [
    {
      question: "Is my XML uploaded?",
      answer: "No. The text is read and written in your browser. Nothing is sent anywhere.",
    },
    {
      question: "What does Check look at?",
      answer: "Whether the XML is well-formed: every tag is closed in the right order, attributes are quoted and not repeated, there is one root element, and ampersands are written as entities. It tells you the line and column of the first problem. It does not check the file against a schema (XSD) or a DTD.",
    },
    {
      question: "Does formatting change my data?",
      answer: "Text, attribute values, entities and CDATA are kept exactly as written. Only the space between tags is changed. When an element mixes text and tags, as in a paragraph with bold words, its content is left alone so words are never glued together or split apart.",
    },
    {
      question: "Is it safe with files that declare entities?",
      answer: "Yes. Entities declared in a DOCTYPE are never expanded and external files are never loaded, so a file built to blow up memory (a \"billion laughs\" file) or to read your files is just shown as text.",
    },
    {
      question: "How is XML turned into JSON?",
      answer: "Attributes become keys that start with @, text next to attributes or tags goes under #text, and repeated tags become a list. Empty tags become null, every value stays text (so 007 is not turned into 7), and comments are dropped. Converting back reads the same conventions.",
    },
    {
      question: "Why does my HTML fail the check?",
      answer: "HTML allows things XML does not, like tags that are never closed (<br>), unquoted attributes and &nbsp;. Use an HTML tool for HTML.",
    },
  ],
  nextStep: { slug: "json-formatter", text: "Converted to JSON? Format and validate it next." },
  related: ["json-formatter", "json-yaml-converter", "yaml-validator", "svg-editor", "json-csv-converter", "html-entities"],
});
