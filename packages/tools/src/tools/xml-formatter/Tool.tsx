"use client";

import { Stat, StatGrid, TransformTool, formatFileSize } from "@toolwright/ui";
import { describeValidation, formatXml, jsonToXml, minifyXml, validateXml, xmlToJson, type IndentChoice } from "@toolwright/core/xml-formatter";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- A small catalogue -->
<catalog xmlns:dc="http://purl.org/dc/elements/1.1/"><book id="bk101" lang="en"><dc:title>XML Developer's Guide</dc:title><author>Gambardella, Matthew</author><price currency="USD">44.95</price><description><![CDATA[An in-depth look at creating <applications> with XML.]]></description></book><book id="bk102"><dc:title>Midnight Rain</dc:title><author>Ralls, Kim</author><price currency="USD">5.95</price><description>A former architect battles corporate zombies &amp; an evil sorceress.</description></book></catalog>
`;

type Mode = "format" | "minify" | "check" | "to-json" | "from-json";

function indentOf(value: unknown): IndentChoice {
  return value === "4" ? 4 : value === "tab" ? "tab" : 2;
}

export default function Tool() {
  return (
    <TransformTool
      transform={(input, o) => {
        const mode = o.mode as Mode;
        const indent = indentOf(o.indent);
        switch (mode) {
          case "format":
            return formatXml(input, indent);
          case "minify":
            return minifyXml(input, { keepComments: Boolean(o.keepComments) });
          case "check":
            return describeValidation(validateXml(input));
          case "to-json":
            return xmlToJson(input, { indent });
          case "from-json":
            return jsonToXml(input, { indent, rootName: String(o.rootName ?? ""), declaration: Boolean(o.declaration) });
        }
      }}
      options={[
        {
          key: "mode",
          label: "Do this",
          type: "select",
          default: "format",
          options: [
            { value: "format", label: "Format (pretty print)" },
            { value: "minify", label: "Minify (one line)" },
            { value: "check", label: "Check that it is valid" },
            { value: "to-json", label: "XML to JSON" },
            { value: "from-json", label: "JSON to XML" },
          ],
        },
        {
          key: "indent",
          label: "Indent with",
          type: "select",
          default: "2",
          hint: "For Format and both conversions.",
          options: [
            { value: "2", label: "2 spaces" },
            { value: "4", label: "4 spaces" },
            { value: "tab", label: "Tab" },
          ],
        },
        { key: "keepComments", label: "Keep comments when minifying", type: "toggle", default: false },
        { key: "declaration", label: "Add the <?xml?> line (JSON to XML)", type: "toggle", default: true },
        { key: "rootName", label: "Root element name (JSON to XML)", type: "text", default: "root", placeholder: "root", hint: "Used when the JSON has several top-level keys." },
      ]}
      inputLabel="XML or JSON"
      outputLabel="Result"
      inputPlaceholder="Paste XML here, or drop a file"
      sample={SAMPLE}
      acceptFile=".xml,.xsd,.xsl,.xslt,.rss,.atom,.svg,.plist,.json,.txt"
      outputFilename="result.txt"
      outputMime="text/plain"
      rows={16}
      shareable={false}
      inputMono
      outputMono
      renderExtra={({ input, output }) =>
        input.trim() && output ? (
          <StatGrid>
            <Stat label="Input" value={formatFileSize(new Blob([input]).size)} />
            <Stat label="Result" value={formatFileSize(new Blob([output]).size)} />
          </StatGrid>
        ) : null
      }
    />
  );
}
