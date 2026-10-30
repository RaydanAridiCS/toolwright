"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, CopyButton, FileDropzone, Panel, ResultSlab, Textarea } from "@toolwright/ui";
import { validateYaml, type YamlSeverity } from "@toolwright/core/yaml-validator";

const SAMPLE = `name: web
replicas: 3
debug: yes
mode: 0755
image:
  repository: ghcr.io/example/web
  tag: 1.10
ports:
  - 80
  - 443
`;

const TONE: Record<YamlSeverity, "danger" | "accent" | "neutral"> = { error: "danger", warning: "accent", info: "neutral" };
const LABEL: Record<YamlSeverity, string> = { error: "Error", warning: "Watch out", info: "Tip" };
const KIND = { mapping: "a mapping (key: value pairs)", list: "a list", value: "a single value", empty: "empty" } as const;

export default function Tool() {
  // Plain state, not the URL: YAML files are often configuration with secrets in them.
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const report = useMemo(() => (text.trim() ? validateYaml(text) : null), [text]);
  const lines = text.split("\n");

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone
        accept=".yaml,.yml,text/yaml,text/plain"
        label="Drop a YAML file here, or click to browse"
        hint="Or paste it below. It is read in this tab and never uploaded."
        maxSizeMB={5}
        onReject={setFileError}
        onFiles={async ([file]) => {
          if (!file) return;
          setFileError(null);
          setText(await file.text());
        }}
      />
      {fileError ? <p className="text-sm text-danger">{fileError}</p> : null}

      <Panel
        title="YAML"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setText(SAMPLE)}>
            Sample
          </Button>
        }
      >
        <Textarea aria-label="YAML" rows={14} className="min-h-56 font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="name: value" spellCheck={false} />
      </Panel>

      {report ? (
        <>
          <ResultSlab
            label="Result"
            size="md"
            value={report.valid ? "Valid YAML" : "Not valid YAML"}
            note={report.valid ? `${report.documents} document${report.documents === 1 ? "" : "s"}; the first is ${report.kind ? KIND[report.kind] : "empty"}.` : "Fix this first. Reading stops at the first error."}
            valueTestId="yaml-summary"
          />

          {report.issues.length > 0 ? (
            <Panel title={report.valid ? "Things to check" : "The problem"}>
              <ol aria-label="Issues" className="border-t border-border">
                {report.issues.map((issue, i) => (
                  <li key={`${issue.rule}-${issue.line}-${i}`} className="flex flex-col gap-1 border-b border-border py-3">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={TONE[issue.severity]}>{LABEL[issue.severity]}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {issue.line > 0 ? `Line ${issue.line}${issue.column > 0 ? `, column ${issue.column}` : ""}` : "Whole file"}
                      </span>
                    </p>
                    <p className="text-sm">{issue.message}</p>
                    {issue.line > 0 && lines[issue.line - 1] !== undefined ? <pre className="overflow-x-auto bg-muted px-3 py-2 font-mono text-xs">{lines[issue.line - 1]}</pre> : null}
                  </li>
                ))}
              </ol>
            </Panel>
          ) : report.valid ? (
            <Alert tone="success">No problems found.</Alert>
          ) : null}

          {report.json ? (
            <Panel title="As JSON" actions={<CopyButton text={report.json} label="Copy JSON" />}>
              <Textarea aria-label="YAML as JSON" readOnly rows={10} className="min-h-40 font-mono" value={report.json} spellCheck={false} />
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
