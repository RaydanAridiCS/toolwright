import { ArrowLeftRight } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "json-yaml-converter",
  name: "JSON to YAML Converter",
  tagline: "Convert JSON to YAML and YAML to JSON instantly.",
  description:
    "Switch between JSON and YAML in either direction, with optional key sorting and custom indentation. Parsing happens locally in your browser, so config files and secrets stay on your device.",
  category: "data",
  keywords: ["json to yaml", "yaml to json", "yaml converter", "convert yaml", "kubernetes yaml", "docker compose"],
  icon: ArrowLeftRight,
  popular: true,
  related: ["json-formatter", "json-csv-converter", "json-to-typescript", "xml-formatter"],
});
