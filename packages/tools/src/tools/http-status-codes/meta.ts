import { Signal } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "http-status-codes",
  name: "HTTP Status Codes",
  tagline: "Searchable reference of every HTTP response status code.",
  description: "Look up what any HTTP status code means, from 200 OK to 418 I'm a teapot and 503 Service Unavailable. Search by number, name or description.",
  category: "developer",
  keywords: ["http status codes", "http response codes", "404 meaning", "301 vs 302", "status code reference"],
  icon: Signal,
  related: ["mime-types", "port-numbers", "url-parser", "http-header-explainer"],
});
