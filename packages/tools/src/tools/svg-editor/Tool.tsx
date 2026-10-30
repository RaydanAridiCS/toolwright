"use client";

import { useMemo, useState } from "react";
import { Download, Wand2 } from "lucide-react";
import { Alert, Badge, Button, CopyButton, downloadBlob, DownloadButton, FileDropzone, formatFileSize, Panel, SegmentedControl, Stat, StatGrid, Textarea, useDebounced } from "@toolwright/ui";
import { aspectHeight, fixSvg, formatSvg, padBox, parseViewBox, setSvgSize, setSvgViewBox, svgInfo, viewBoxText, type SvgIssue } from "@toolwright/core/svg-tools";
import { parseSvg, getAttr } from "@toolwright/core/svg-xml";
import { NumberField, num } from "../../shared/number-field";
import { BACKDROPS, SvgPreview, svgToPngBlob, type Backdrop } from "../../shared/svg-preview";
import { errorMessage } from "../../shared/format";

const SAMPLE = `<svg viewBox="0 0 120 80">
  <rect width="120" height="80" fill="#f4efe3"/>
  <circle cx="40" cy="40" r="22" fill="#1d6b57"/>
  <path d="M70 58 L90 22 L110 58 Z" fill="#2b4a8c"/>
</svg>
`;

const TONE: Record<SvgIssue["severity"], "danger" | "accent" | "neutral"> = { error: "danger", warning: "accent", info: "neutral" };
const LABEL: Record<SvgIssue["severity"], string> = { error: "Error", warning: "Watch out", info: "Tip" };

export default function Tool() {
  // Plain state, not the URL: SVGs are often client or design work.
  const [text, setText] = useState("");
  const [backdrop, setBackdrop] = useState<Backdrop>("white");
  const [fileError, setFileError] = useState<string | null>(null);
  const [width, setWidth] = useState("");
  const [pad, setPad] = useState("0");
  const [scale, setScale] = useState("2");
  const [action, setAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const debounced = useDebounced(text, 250);
  const analysis = useMemo(() => {
    if (!debounced.trim()) return null;
    try {
      return { info: svgInfo(debounced), error: null as string | null };
    } catch (err) {
      return { info: null, error: errorMessage(err, "This is not a valid SVG.") };
    }
  }, [debounced]);

  const apply = (fn: (source: string) => string, note?: string) => {
    try {
      setText((cur) => fn(cur));
      setAction(note ?? null);
    } catch (err) {
      setAction(errorMessage(err));
    }
  };

  const info = analysis?.info ?? null;
  const box = useMemo(() => {
    try {
      return debounced.trim() ? parseViewBox(getAttr(parseSvg(debounced).root, "viewBox")) : null;
    } catch {
      return null;
    }
  }, [debounced]);

  const exportPng = async () => {
    setBusy(true);
    try {
      const factor = Math.min(16, Math.max(0.1, num(scale) || 1));
      const w = (box?.width ?? 100) * factor;
      const h = (box?.height ?? 100) * factor;
      const png = await svgToPngBlob(text, w, h, backdrop === "transparent" ? undefined : backdrop === "white" ? "#ffffff" : undefined);
      downloadBlob(png, "picture.png", "image/png");
      setAction(null);
    } catch (err) {
      setAction(errorMessage(err, "The PNG could not be made."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone
        accept=".svg,image/svg+xml"
        label="Drop an SVG file here, or click to browse"
        hint="Or write and paste it below. It is read in this tab and never uploaded."
        maxSizeMB={10}
        onReject={setFileError}
        onFiles={async ([file]) => {
          if (!file) return;
          setFileError(null);
          setText(await file.text());
        }}
      />
      {fileError ? <p className="text-sm text-danger">{fileError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="SVG code"
          actions={
            <>
              <Button size="sm" variant="ghost" onClick={() => setText(SAMPLE)}>
                Sample
              </Button>
              <Button size="sm" variant="ghost" disabled={!text.trim()} onClick={() => apply((s) => formatSvg(s, 2), "Formatted with 2 spaces.")}>
                Format
              </Button>
              <Button size="sm" variant="ghost" disabled={!text.trim()} onClick={() => apply((s) => formatSvg(s, "tab"), "Formatted with tabs.")}>
                Tabs
              </Button>
              <CopyButton text={text} label="Copy" />
            </>
          }
        >
          <Textarea aria-label="SVG code" rows={20} className="min-h-80 font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder='<svg viewBox="0 0 24 24">…</svg>' spellCheck={false} />
        </Panel>

        <Panel title="Preview" actions={<SegmentedControl label="Preview background" value={backdrop} onValueChange={setBackdrop} options={BACKDROPS} />}>
          <SvgPreview svg={debounced} backdrop={backdrop} label="The SVG as drawn" maxHeight={420} className="min-h-80" />
        </Panel>
      </div>

      {analysis?.error ? <Alert tone="error">{analysis.error}</Alert> : null}
      {action ? <Alert tone="info">{action}</Alert> : null}

      {info ? (
        <>
          <StatGrid>
            <Stat label="Size" value={formatFileSize(info.bytes)} />
            <Stat label="Elements" value={String(info.elements)} />
            <Stat label="Width × height" value={`${info.width ?? "—"} × ${info.height ?? "—"}`} />
            <Stat label="viewBox" value={box ? viewBoxText(box) : "none"} />
          </StatGrid>

          {info.issues.length > 0 ? (
            <ul aria-label="Checks" className="flex flex-col gap-2 border-t border-border">
              {info.issues.map((issue) => (
                <li key={issue.message} className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm">
                  <Badge tone={TONE[issue.severity]}>{LABEL[issue.severity]}</Badge>
                  <span className="min-w-0 flex-1">{issue.message}</span>
                  {issue.fix ? (
                    <Button size="sm" variant="ghost" onClick={() => apply((s) => {
                      const fixed = fixSvg(s);
                      setAction(fixed.applied.join(" ") || "Nothing needed fixing.");
                      return fixed.svg;
                    })}>
                      <Wand2 /> Fix
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No problems found.</p>
          )}

          <Panel title="Size and framing">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField label="Width in pixels" value={width} onChange={setWidth} min={1} placeholder={info.width ?? "auto"} hint="Height follows the shape." />
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  disabled={!num(width)}
                  onClick={() =>
                    apply((s) => {
                      const w = num(width);
                      const h = aspectHeight(s, w);
                      if (h === null) throw new Error("Add a viewBox first so the height can be worked out.");
                      return setSvgSize(s, w, h);
                    }, "Width and height set.")
                  }
                >
                  Set size
                </Button>
              </div>
              <NumberField label="Space around the drawing" value={pad} onChange={setPad} min={0} hint="In viewBox units." />
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  disabled={!box}
                  onClick={() => apply((s) => {
                    const current = parseViewBox(getAttr(parseSvg(s).root, "viewBox"));
                    if (!current) throw new Error("This SVG has no viewBox to add space to.");
                    return setSvgViewBox(s, padBox(current, num(pad)));
                  }, "Space added around the drawing.")}
                >
                  Add space
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Export">
            <div className="flex flex-wrap items-end gap-4">
              <DownloadButton data={text} filename="picture.svg" mime="image/svg+xml" label="Download SVG" />
              <NumberField label="PNG scale" value={scale} onChange={setScale} min={0.1} max={16} step={0.5} suffix="×" className="w-36" />
              <Button variant="primary" disabled={busy || !!analysis?.error} onClick={exportPng}>
                <Download /> {busy ? "Making PNG…" : "Download PNG"}
              </Button>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
