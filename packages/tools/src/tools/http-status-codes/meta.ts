import { Signal } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "http-status-codes",
  name: "HTTP Status Codes",
  tagline: "Searchable reference of every HTTP response status code.",
  description: "Look up what any HTTP status code means, from 200 OK to 418 I'm a teapot and 503 Service Unavailable. Search by number, name or description.",
  primaryKeyword: "http status codes",
  seoTitle: "HTTP Status Codes: Full List and Meanings",
  seoDescription:
    "Look up any HTTP status code, from 200 OK to 404 Not Found and 503 Service Unavailable. Search by number, name or description. Free.",
  answer:
    "HTTP Status Codes is a searchable reference of response status codes, from 200 OK to 418 I'm a teapot and 503 Service Unavailable. Search by number, name or description.",
  category: "developer",
  keywords: ["http status codes", "http response codes", "404 meaning", "301 vs 302", "status code reference"],
  icon: Signal,
  howTo: ["Type a status code, name or keyword.", "Open the matching entry.", "Read what it means and when it is used."],
  faq: [
    { question: "What is the difference between 301 and 302?", answer: "A 301 is a permanent redirect, so clients and search engines should use the new address from now on. A 302 is temporary, so the original address is still the one to keep." },
    { question: "What does a 404 mean?", answer: "The server could not find what was asked for at that address. It does not say whether the page is gone for good; 410 Gone does." },
    { question: "What is the difference between 401 and 403?", answer: "401 means the request is not authenticated, so credentials are missing or wrong. 403 means the server knows who you are and still refuses." },
  ],
  nextStep: { slug: "http-header-explainer", text: "Debugging a response? Paste its headers to have them explained." },
  related: ["mime-types", "port-numbers", "url-parser", "http-header-explainer"],
});
