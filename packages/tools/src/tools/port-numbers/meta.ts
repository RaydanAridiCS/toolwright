import { Network } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "port-numbers",
  name: "Common Port Numbers",
  tagline: "Which service uses which TCP/UDP port.",
  description: "Quickly look up well-known and popular development ports: 22 SSH, 443 HTTPS, 5432 PostgreSQL, 6379 Redis, 3000 and more. Search by number or service name.",
  category: "developer",
  keywords: ["port numbers", "tcp ports", "default ports", "common ports", "postgres port", "redis port"],
  icon: Network,
  related: ["http-status-codes", "mime-types", "url-parser", "subnet-calculator"],
});
