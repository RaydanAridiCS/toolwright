"use client";

import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { Alert, Button, CopyButton, DownloadButton, FileDropzone, Input, Panel, SegmentedControl, Textarea } from "@toolwright/ui";
import { findColors, replaceColors, setSingleColor, transformColors, useCurrentColor as makeCurrentColor, type ColorOperation } from "@toolwright/core/svg-colors";
import { BACKDROPS, SvgPreview, type Backdrop } from "../../shared/svg-preview";
import { errorMessage } from "../../shared/format";

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
  <rect width="120" height="80" fill="#f4efe3"/>
  <circle cx="40" cy="40" r="22" fill="#1d6b57" stroke="#10382d" stroke-width="3"/>
  <path d="M70 58 L90 22 L110 58 Z" fill="#2b4a8c"/>
</svg>
`;

const QUICK: { op: ColorOperation; label: string }[] = [
  { op: "invert", label: "Invert" },
  { op: "grayscale", label: "Grayscale" },
  { op: "lighten", label: "Lighten" },
  { op: "darken", label: "Darken" },
];

/** The colour picker only takes six-digit codes, so a colour with transparency gets a text box only. */
const isSolidHex = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex);

export default function Tool() {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [backdrop, setBackdrop] = useState<Backdrop>("white");
  const [single, setSingle] = useState("#1d6b57");
  const [message, setMessage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const report = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { colors: findColors(text), error: null as string | null };
    } catch (err) {
      return { colors: null, error: errorMessage(err, "This is not a valid SVG.") };
    }
  }, [text]);

  const change = (fn: (source: string) => { svg: string; changed: number }, what: string) => {
    try {
      const out = fn(text);
      if (out.changed === 0) return setMessage("Nothing to change: no colours were found.");
      setHistory((h) => [...h.slice(-29), text]);
      setText(out.svg);
      setMessage(`${what}: ${out.changed} ${out.changed === 1 ? "colour" : "colours"} changed.`);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };
  const load = (source: string) => {
    setHistory([]);
    setMessage(null);
    setText(source);
  };

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone
        accept=".svg,image/svg+xml"
        label="Drop an SVG file here, or click to browse"
        hint="Or paste it below. It is read in this tab and never uploaded."
        maxSizeMB={10}
        onReject={setFileError}
        onFiles={async ([file]) => {
          if (!file) return;
          setFileError(null);
          load(await file.text());
        }}
      />
      {fileError ? <p className="text-sm text-danger">{fileError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="SVG code"
          actions={
            <>
              <Button size="sm" variant="ghost" onClick={() => load(SAMPLE)}>
                Sample
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={history.length === 0}
                onClick={() => {
                  setText(history[history.length - 1] ?? "");
                  setHistory((h) => h.slice(0, -1));
                  setMessage(null);
                }}
              >
                <Undo2 /> Undo
              </Button>
              <CopyButton text={text} label="Copy" />
              <DownloadButton data={text} filename="recolored.svg" mime="image/svg+xml" label="Download" />
            </>
          }
        >
          <Textarea aria-label="SVG code" rows={14} className="min-h-64 font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder='<svg viewBox="0 0 24 24">…</svg>' spellCheck={false} />
        </Panel>
        <Panel title="Preview" actions={<SegmentedControl label="Preview background" value={backdrop} onValueChange={setBackdrop} options={BACKDROPS} />}>
          <SvgPreview svg={text} backdrop={backdrop} label="The recoloured SVG" className="min-h-64" />
        </Panel>
      </div>

      {report?.error ? <Alert tone="error">{report.error}</Alert> : null}
      {message ? <Alert tone="info">{message}</Alert> : null}

      {report?.colors ? (
        <>
          <Panel title={report.colors.colors.length === 1 ? "1 colour in this file" : `${report.colors.colors.length} colours in this file`}>
            {report.colors.colors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No colours are set in this file. Shapes without a fill draw in black.</p>
            ) : (
              <ul aria-label="Colours" className="grid gap-3 sm:grid-cols-2">
                {report.colors.colors.map((c) => (
                  <li key={c.hex} className="flex items-center gap-3 border border-border p-2">
                    <span aria-hidden className="size-8 shrink-0 border border-border" style={{ backgroundColor: c.hex }} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm">{c.hex}</span>
                      <span className="block text-xs text-muted-foreground">used {c.count} {c.count === 1 ? "time" : "times"}</span>
                    </span>
                    <Input
                      key={`${c.hex}-text`}
                      aria-label={`New value for ${c.hex}`}
                      mono
                      className="w-28"
                      defaultValue={c.hex}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") change((s) => replaceColors(s, { [c.hex]: e.currentTarget.value }), `Replaced ${c.hex}`);
                      }}
                      onBlur={(e) => {
                        if (e.currentTarget.value.trim().toLowerCase() !== c.hex) change((s) => replaceColors(s, { [c.hex]: e.currentTarget.value }), `Replaced ${c.hex}`);
                      }}
                    />
                    {isSolidHex(c.hex) ? (
                      <input
                        type="color"
                        aria-label={`Pick a new colour for ${c.hex}`}
                        className="size-9 shrink-0 cursor-pointer border border-border bg-transparent p-0"
                        value={c.hex}
                        onChange={(e) => change((s) => replaceColors(s, { [c.hex]: e.target.value }), `Replaced ${c.hex}`)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {report.colors.currentColor > 0 || report.colors.none > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Also in this file: currentColor {report.colors.currentColor} {report.colors.currentColor === 1 ? "time" : "times"}, none {report.colors.none} {report.colors.none === 1 ? "time" : "times"}. These are left alone.
              </p>
            ) : null}
          </Panel>

          <Panel title="Change every colour at once">
            <div className="flex flex-wrap items-end gap-3">
              {QUICK.map((q) => (
                <Button key={q.op} variant="ghost" onClick={() => change((s) => transformColors(s, q.op, 0.15), q.label)}>
                  {q.label}
                </Button>
              ))}
              <Button variant="ghost" onClick={() => change((s) => makeCurrentColor(s), "Used currentColor")}>
                Use currentColor
              </Button>
              <label className="flex items-center gap-2 text-sm">
                One colour for everything
                <input type="color" aria-label="One colour for all fills and strokes" className="size-9 cursor-pointer border border-border bg-transparent p-0" value={single} onChange={(e) => setSingle(e.target.value)} />
              </label>
              <Button variant="ghost" onClick={() => change((s) => setSingleColor(s, single), `Set to ${single}`)}>
                Apply
              </Button>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
