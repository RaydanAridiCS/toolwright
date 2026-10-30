import { FileCheck2 } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "yaml-validator",
  name: "YAML Validator and Linter",
  tagline: "Check YAML for errors, and for values that parsers read differently.",
  description:
    "Paste or drop YAML and see whether it is valid, with the exact line and column of any error. It also flags classic traps: unquoted yes and no, leading-zero numbers, and versions such as 3.10 that lose a zero. See the result as JSON. Runs in your browser; nothing is uploaded.",
  category: "developer",
  keywords: ["yaml validator", "yaml linter", "validate yaml", "yaml checker", "yaml syntax check", "yaml lint online", "yaml error line number"],
  icon: FileCheck2,
  howTo: ["Paste your YAML, or drop a .yaml or .yml file.", "If it is invalid, read the line and column of the first error.", "If it is valid, read the notes on values that other tools may read differently, and copy the JSON if you need it."],
  faq: [
    {
      question: "Is my YAML uploaded?",
      answer: "No. It is read in your browser and kept out of the address bar, since YAML files often hold configuration and secrets.",
    },
    {
      question: "Why does it warn about yes and no?",
      answer: "In YAML 1.1 (used by PyYAML, Ansible, older Kubernetes tooling and others) yes, no, on, off, y and n are booleans. YAML 1.2 treats them as text. A file can mean different things in different tools, so quoting the value removes the doubt. The classic case is the country code NO becoming false.",
    },
    {
      question: "Which YAML version does the check use?",
      answer: "It follows YAML 1.2 with the standard safe types. Tags that could create functions or objects are refused, so a document cannot run code here.",
    },
    {
      question: "Does it check my Kubernetes or Docker Compose schema?",
      answer: "No. It checks YAML syntax and common traps, not whether the keys mean anything to a particular tool. Use the tool's own validator for that.",
    },
    {
      question: "Why is the JSON view missing?",
      answer: "A document that repeats an alias many times can expand into a huge JSON text. When the JSON would be over about 1 MB, the view is hidden and a note says so.",
    },
  ],
  related: ["json-yaml-converter", "json-formatter", "dockerfile-linter", "json-schema-generator", "csv-delimiter-converter"],
});
