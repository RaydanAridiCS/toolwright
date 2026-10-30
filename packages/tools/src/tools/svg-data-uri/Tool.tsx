"use client";

import { Panel, Stat, StatGrid, TransformTool, formatFileSize } from "@toolwright/ui";
import { SNIPPETS, svgToDataUri, snippetFor, type SnippetKind, type DataUriEncoding } from "@toolwright/core/svg-data-uri";
import { SvgPreview } from "../../shared/svg-preview";

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1d6b57" stroke-width="2">
  <circle cx="12" cy="12" r="9"/>
  <path d="M8 12.5l3 3 5-6"/>
</svg>
`;

export default function Tool() {
  return (
    <TransformTool
      transform={(input, o) => snippetFor(o.snippet as SnippetKind, svgToDataUri(input, { encoding: o.encoding as DataUriEncoding }), "")}
      options={[
        { key: "snippet", label: "Output as", type: "select", default: "css-background", options: SNIPPETS.map((s) => ({ value: s.id, label: s.label })) },
        { key: "encoding", label: "Encoding", type: "select", default: "url", options: [{ value: "url", label: "URL-encoded (smaller)" }, { value: "base64", label: "Base64" }] },
      ]}
      inputLabel="SVG"
      outputLabel="Data URI"
      inputPlaceholder="Paste an SVG here, or drop a file"
      sample={SAMPLE}
      acceptFile=".svg,image/svg+xml"
      outputFilename="data-uri.txt"
      outputMime="text/plain"
      rows={12}
      shareable={false}
      inputMono
      outputMono
      renderExtra={({ input, output }) =>
        input.trim() && output ? (
          <div className="flex flex-col gap-4">
            <StatGrid>
              <Stat label="SVG size" value={formatFileSize(new Blob([input]).size)} />
              <Stat label="Output size" value={formatFileSize(new Blob([output]).size)} />
            </StatGrid>
            <Panel title="Picture">
              <SvgPreview svg={input} label="The SVG" />
            </Panel>
          </div>
        ) : null
      }
    />
  );
}
