"use client";

import { Alert, TransformTool } from "@toolwright/ui";
import { svgToJsx } from "@toolwright/core/svg-to-jsx";
import { SvgPreview } from "../../shared/svg-preview";

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" class="icon" style="margin-right: 4px">
  <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>
</svg>
`;

export default function Tool() {
  return (
    <TransformTool
      transform={(input, o) =>
        svgToJsx(input, {
          typescript: o.typescript as boolean,
          componentName: o.name as string,
          removeDimensions: o.dimensions as boolean,
          currentColor: o.current as boolean,
          memo: o.memo as boolean,
          spreadProps: o.props as boolean,
          exportStyle: o.exportStyle as "default" | "named",
          importReact: o.importReact as boolean,
        }).code
      }
      options={[
        { key: "name", label: "Component name", type: "text", default: "SvgIcon", placeholder: "SvgIcon" },
        { key: "typescript", label: "TypeScript (TSX)", type: "toggle", default: false },
        { key: "props", label: "Pass props to the svg", type: "toggle", default: true, hint: "className, onClick, width and so on." },
        { key: "dimensions", label: "Remove width and height", type: "toggle", default: false, hint: "Size it with CSS instead." },
        { key: "current", label: "Use currentColor", type: "toggle", default: false, hint: "The icon takes the text colour." },
        { key: "memo", label: "Wrap in React.memo", type: "toggle", default: false },
        { key: "exportStyle", label: "Export", type: "select", default: "default", options: [{ value: "default", label: "export default" }, { value: "named", label: "Named export" }] },
        { key: "importReact", label: "Import React", type: "toggle", default: false, hint: "For older setups without the automatic JSX runtime." },
      ]}
      inputLabel="SVG"
      outputLabel="React component"
      inputPlaceholder="Paste an SVG here, or drop a file"
      sample={SAMPLE}
      acceptFile=".svg,image/svg+xml"
      outputFilename="SvgIcon.tsx"
      outputMime="text/plain"
      rows={14}
      shareable={false}
      inputMono
      outputMono
      renderExtra={({ input, options }) => {
        if (!input.trim()) return null;
        let notes: string[] = [];
        try {
          notes = svgToJsx(input, { componentName: options.name as string }).notes;
        } catch {
          return null;
        }
        return (
          <div className="flex flex-col gap-4">
            {notes.length > 0 ? (
              <Alert tone="info" title="Changed on the way">
                <ul className="list-disc pl-5">
                  {notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            <SvgPreview svg={input} label="The SVG" maxHeight={200} />
          </div>
        );
      }}
    />
  );
}
