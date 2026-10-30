"use client";

import { useMemo, useState } from "react";
import { Badge, Button, CopyButton, FileDropzone, Panel, ResultSlab, Stat, StatGrid, Textarea } from "@toolwright/ui";
import { lintDockerfile, type Finding, type Severity } from "@toolwright/core/dockerfile-linter";

const SAMPLE = `FROM node:latest
WORKDIR app
ADD . .
ENV API_TOKEN=abc123
RUN apt-get update
RUN apt-get install curl && cd /tmp && curl -fsSL https://example.com/install.sh | sh
EXPOSE 22 3000
CMD node server.js
`;

const TONE: Record<Severity, "danger" | "accent" | "neutral"> = { error: "danger", warning: "accent", info: "neutral" };
const LABEL: Record<Severity, string> = { error: "Error", warning: "Warning", info: "Tip" };

function report(findings: Finding[]): string {
  return findings.map((f) => `Line ${f.line} [${f.rule}] ${LABEL[f.severity]}: ${f.message}${f.fix ? ` Fix: ${f.fix}` : ""}`).join("\n");
}

export default function Tool() {
  // Plain state, not the URL: a Dockerfile can mention private registries and internal hosts.
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const result = useMemo(() => (text.trim() ? lintDockerfile(text) : null), [text]);
  const lines = text.split("\n").length;

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone
        accept=".dockerfile,Dockerfile,text/plain"
        label="Drop a Dockerfile here, or click to browse"
        hint="Or paste it below. It is read in this tab and never uploaded."
        maxSizeMB={2}
        onReject={setFileError}
        onFiles={async ([file]) => {
          if (!file) return;
          setFileError(null);
          setText(await file.text());
        }}
      />
      {fileError ? <p className="text-sm text-danger">{fileError}</p> : null}

      <Panel
        title="Dockerfile"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setText(SAMPLE)}>
            Sample
          </Button>
        }
      >
        <Textarea aria-label="Dockerfile" rows={14} className="min-h-56 font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="FROM node:22-slim…" spellCheck={false} />
      </Panel>

      {result ? (
        <>
          <ResultSlab
            label="Result"
            size="md"
            value={result.findings.length === 0 ? "No problems found" : `${result.findings.length} finding${result.findings.length === 1 ? "" : "s"}`}
            note={`${lines} lines, ${result.instructions.length} instructions, ${result.stages} build stage${result.stages === 1 ? "" : "s"}. Checked as text; nothing was built or run.`}
            valueTestId="lint-summary"
          />
          <StatGrid className="sm:grid-cols-3 lg:grid-cols-3">
            <Stat label="Errors" value={<span className={result.counts.error ? "text-danger" : undefined}>{result.counts.error}</span>} />
            <Stat label="Warnings" value={result.counts.warning} />
            <Stat label="Tips" value={result.counts.info} />
          </StatGrid>

          {result.findings.length > 0 ? (
            <Panel title="Findings" actions={<CopyButton text={report(result.findings)} label="Copy report" />}>
              <ol aria-label="Findings" className="border-t border-border">
                {result.findings.map((f, i) => (
                  <li key={`${f.line}-${f.rule}-${i}`} className="flex flex-col gap-1 border-b border-border py-3">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={TONE[f.severity]}>{LABEL[f.severity]}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        Line {f.line} · {f.rule}
                      </span>
                    </p>
                    <p className="text-sm">{f.message}</p>
                    {f.fix ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Fix: </span>
                        {f.fix}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
