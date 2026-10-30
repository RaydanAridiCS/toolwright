"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Panel, Stat, StatGrid, Textarea, useDebounced, type BadgeTone } from "@toolwright/ui";
import { explainHeaders, type CheckStatus, type FlagLevel, type HeaderGroup } from "@toolwright/core/http-header-explainer";

const SAMPLE_RESPONSE = `HTTP/2 200
content-type: text/html
cache-control: public, max-age=31536000, immutable
strict-transport-security: max-age=31536000
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'
x-content-type-options: nosniff
set-cookie: session=abc123; Path=/; HttpOnly
server: nginx/1.25.3
vary: Accept-Encoding
access-control-allow-origin: *`;

const SAMPLE_REQUEST = `GET /api/items?page=2 HTTP/1.1
Host: api.example.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64)
Accept: application/json, text/plain;q=0.8, */*;q=0.5
Accept-Encoding: gzip, br
Accept-Language: en-GB,en;q=0.8
Authorization: Bearer eyJhbGciOi...
Cookie: session=abc123; theme=dark
Origin: https://app.example.com`;

const STATUS: Record<CheckStatus, { label: string; tone: BadgeTone }> = {
  good: { label: "Good", tone: "success" },
  warn: { label: "Weak", tone: "danger" },
  missing: { label: "Missing", tone: "accent" },
};
const FLAG: Record<FlagLevel, { label: string; tone: BadgeTone }> = {
  good: { label: "Good", tone: "success" },
  warn: { label: "Check", tone: "danger" },
  info: { label: "Note", tone: "neutral" },
};
const GROUP: Record<HeaderGroup, string> = {
  caching: "Caching",
  security: "Security",
  content: "Content",
  cors: "CORS",
  auth: "Authentication",
  cookies: "Cookies",
  connection: "Connection",
  request: "Request",
  other: "General",
};

export default function Tool() {
  // Headers often carry cookies and tokens, so this lives in component state and never in the shareable URL.
  const [value, setValue] = useState("");
  const text = useDebounced(value, 150);
  const report = useMemo(() => (text.trim() ? explainHeaders(text) : null), [text]);

  const graded = report?.checks.filter((c) => c.status !== "good").length ?? 0;
  const kind = report?.message.kind;

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Headers"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setValue(SAMPLE_RESPONSE)}>
              Sample response
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setValue(SAMPLE_REQUEST)}>
              Sample request
            </Button>
          </>
        }
      >
        <Textarea
          aria-label="HTTP headers"
          rows={12}
          className="min-h-56 font-mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={"Paste request or response headers, for example from your browser's network tab or curl -i"}
          spellCheck={false}
        />
      </Panel>

      {report && report.message.warnings.length ? (
        <Alert tone="warning" title="Some lines were skipped.">
          <ul className="list-disc pl-5">
            {report.message.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {report && !report.entries.length ? <Alert tone="info" title="No headers found.">Each header needs a name, a colon and a value, like Content-Type: text/html.</Alert> : null}

      {report && report.entries.length ? (
        <>
          <StatGrid className="sm:grid-cols-3 lg:grid-cols-3">
            <Stat label="Kind" value={kind === "request" ? "Request" : kind === "response" ? "Response" : "Not sure"} />
            <Stat label="Headers" value={report.entries.length} />
            {report.checks.length ? <Stat label="Security checks to review" value={graded} /> : <Stat label="Start line" value={report.message.startLine ?? "None"} />}
          </StatGrid>

          {report.checks.length ? (
            <Panel title="Security checklist">
              {kind === "unknown" ? <p className="text-sm text-muted-foreground">These headers could be either direction, so they are graded as a response. Add the HTTP/1.1 200 OK line to be sure.</p> : null}
              <ul className="divide-y divide-border border border-border bg-card" aria-label="Security checks">
                {report.checks.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                    <span className="flex shrink-0 items-center gap-2 sm:w-64">
                      <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                      <span className="font-mono text-[13px] font-medium">{c.title}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">{c.message}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">A missing header is a prompt to check, not proof of a hole. Judge each one for the kind of page it protects.</p>
            </Panel>
          ) : null}

          <Panel title="Header by header">
            <ol className="divide-y divide-border border border-border bg-card" aria-label="Headers explained">
              {report.entries.map((e, i) => (
                <li key={i} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-sm font-semibold">{e.info?.name ?? e.header.name}</span>
                    {e.info ? <Badge>{GROUP[e.info.group]}</Badge> : <Badge>Custom</Badge>}
                  </div>
                  <p className="break-all font-mono text-[13px] text-muted-foreground">{e.header.value || "(empty)"}</p>
                  {e.info ? <p className="text-sm">{e.info.summary}</p> : <p className="text-sm text-muted-foreground">Not a standard header this tool knows. Names starting with X- are usually custom to one site.</p>}
                  {e.details.length ? (
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {e.details.map((d, j) => (
                        <li key={j} className="break-words">
                          {d}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {e.flags.map((f, j) => (
                    <p key={j} className="flex items-start gap-2 text-sm">
                      <Badge tone={FLAG[f.level].tone}>{FLAG[f.level].label}</Badge>
                      <span>{f.text}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
