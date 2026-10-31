import { Network } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "subnet-calculator",
  name: "IP & Subnet Calculator",
  tagline: "Work out CIDR ranges, netmasks and host counts for IPv4 and IPv6.",
  description:
    "Enter a network such as 192.168.1.0/24 or 2001:db8::/32 to see its netmask, range and number of hosts. Split it into smaller subnets, turn an address range into CIDR blocks, check whether an address belongs to a network, or merge a list. It runs in your browser; nothing is sent anywhere.",
  primaryKeyword: "subnet calculator",
  seoTitle: "Subnet Calculator: IPv4 and IPv6 CIDR Ranges",
  seoDescription:
    "Work out the netmask, range and host count of a subnet. Split networks, turn ranges into CIDR blocks and merge lists. Free, in your browser.",
  answer:
    "IP & Subnet Calculator shows the netmask, address range and host count for an IPv4 or IPv6 network such as 192.168.1.0/24. It can split a network into subnets, turn an address range into CIDR blocks, check whether an address belongs to a network and merge a list. It runs in your browser.",
  category: "developer",
  keywords: ["subnet calculator", "cidr calculator", "ip calculator", "ipv4 subnet", "ipv6 subnet", "netmask", "wildcard mask", "ip range to cidr", "split subnet", "summarize cidr"],
  icon: Network,
  howTo: [
    "Pick what you want to do: look at a network, split it, convert a range, check an address, or merge a list.",
    "Type the network or addresses. A bare address means a single host.",
    "Read the result and copy any value with its Copy button.",
  ],
  faq: [
    {
      question: "Is anything I type sent to a server?",
      answer: "No. All the arithmetic runs in your browser, and the addresses are kept out of the page address, so a network plan stays on your device.",
    },
    {
      question: "Why does a /24 have 254 usable hosts and not 256?",
      answer: "The first address names the network and the last one is the broadcast address, so neither can be given to a host. A /31 is the exception: it has two addresses and both are usable on a point-to-point link (RFC 3021). A /32 is one address.",
    },
    {
      question: "Does it work with IPv6?",
      answer: "Yes. IPv6 has no broadcast address or netmask, so those lines are left out. Addresses are shown in the short form from RFC 5952, and the full form and the reverse DNS name are given too.",
    },
    {
      question: "Why is 010.0.0.1 refused?",
      answer: "A leading zero is read as octal by some systems and as decimal by others, so 010 can mean 8 or 10. Write the number without the zero.",
    },
    {
      question: "How does the range converter pick blocks?",
      answer: "It uses the fewest CIDR blocks that cover exactly the addresses from the start to the end, never more. Merging a list does the same after joining blocks that overlap or touch.",
    },
  ],
  nextStep: { slug: "port-numbers", text: "Writing firewall rules? Look up common port numbers." },
  related: ["port-numbers", "url-parser", "http-header-explainer", "chmod-calculator", "number-base-converter"],
});
