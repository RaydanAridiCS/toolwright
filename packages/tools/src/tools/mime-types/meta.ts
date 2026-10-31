import { FileType } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "mime-types",
  name: "MIME Type Lookup",
  tagline: "Find the Content-Type for any file extension.",
  description: "Search common MIME types by file extension or media type, such as .png → image/png or application/json. Handy for HTTP headers, uploads and server configuration.",
  primaryKeyword: "mime types",
  seoTitle: "MIME Types List: Find Content-Type by Extension",
  seoDescription:
    "Look up the MIME type for a file extension, such as .png to image/png or .json to application/json. Searchable and free.",
  answer:
    "MIME Type Lookup finds the Content-Type for a file extension or media type, such as .png to image/png or application/json, in a searchable list of common MIME types. It is handy for HTTP headers, uploads and server configuration.",
  category: "developer",
  keywords: ["mime types", "content-type", "file extension to mime", "media type", "mime type list"],
  icon: FileType,
  howTo: ["Type a file extension or a media type.", "Find the matching row.", "Copy the MIME type."],
  faq: [
    { question: "What is a MIME type?", answer: "A label such as image/png or application/json that tells a browser or server what kind of data a file holds." },
    { question: "What Content-Type should I use for JSON?", answer: "Use application/json for JSON data." },
    { question: "Where is the MIME type used?", answer: "In the Content-Type header of HTTP responses and requests, in upload checks and in server configuration." },
  ],
  nextStep: { slug: "http-header-explainer", text: "Setting Content-Type in a response? Have the full header set explained." },
  related: ["http-status-codes", "port-numbers", "image-to-base64"],
});
