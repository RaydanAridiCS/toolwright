import { Network } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "port-numbers",
  name: "Common Port Numbers",
  tagline: "Which service uses which TCP/UDP port.",
  description: "Quickly look up well-known and popular development ports: 22 SSH, 443 HTTPS, 5432 PostgreSQL, 6379 Redis, 3000 and more. Search by number or service name.",
  primaryKeyword: "common port numbers",
  seoTitle: "Common Port Numbers: TCP and UDP Port List",
  seoDescription:
    "Look up well-known and popular development ports: 22 SSH, 443 HTTPS, 5432 PostgreSQL, 6379 Redis, 3000 and more. Search by number or service.",
  answer:
    "Common Port Numbers is a searchable list of well-known and popular TCP and UDP ports, such as 22 for SSH, 443 for HTTPS, 5432 for PostgreSQL and 6379 for Redis. Search by port number or service name.",
  category: "developer",
  keywords: ["port numbers", "tcp ports", "default ports", "common ports", "postgres port", "redis port"],
  icon: Network,
  howTo: ["Type a port number or a service name.", "Find the matching row.", "Check the protocol and what the port is used for."],
  faq: [
    { question: "What port does HTTPS use?", answer: "HTTPS uses port 443 by default." },
    { question: "What port does SSH use?", answer: "SSH uses port 22 by default." },
    { question: "What is the default PostgreSQL port?", answer: "Port 5432. Redis uses 6379 by default." },
  ],
  nextStep: { slug: "subnet-calculator", text: "Planning a network? Work out subnets and CIDR ranges." },
  related: ["http-status-codes", "mime-types", "url-parser", "subnet-calculator"],
});
