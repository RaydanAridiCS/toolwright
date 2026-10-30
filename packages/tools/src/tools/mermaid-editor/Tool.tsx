"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Minus, Plus } from "lucide-react";
import { Alert, Button, CopyButton, Field, Panel, Select, Textarea, downloadBlob, useDebounced, useShareableState } from "@toolwright/ui";
import { checkDiagramText, DIAGRAM_SAMPLES, detectDiagram, diagramFileName, pngSize, standaloneSvg, svgSize } from "@toolwright/core/mermaid-tools";
import { renderMermaid, type MermaidTheme } from "../../shared/mermaid-render";
import { errorMessage } from "../../shared/format";

type Background = "white" | "dark" | "transparent";
const BACKGROUND: Record<Background, string | undefined> = { white: "#ffffff", dark: "#1b1a15", transparent: undefined };
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3] as const;

export default function Tool() {
  const { state, setState } = useShareableState({ code: DIAGRAM_SAMPLES[0]!.code, theme: "default" as MermaidTheme, bg: "white" as Background });
  const { code, theme, bg } = state;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pngScale, setPngScale] = useState("2");
  const [exportError, setExportError] = useState<string | null>(null);
  const debounced = useDebounced(code, 350);

  const info = useMemo(() => detectDiagram(code), [code]);
  const problem = useMemo(() => checkDiagramText(debounced), [debounced]);

  // Draw when the text (after a short pause) or the theme changes. A failed draw keeps the last good picture on screen.
  useEffect(() => {
    if (problem) {
      // A draw that was still running is abandoned, so it will not clear the busy flag itself.
      setBusy(false);
      setError(debounced.trim() ? problem : null);
      if (!debounced.trim()) setSvg(null);
      return;
    }
    let live = true;
    setBusy(true);
    renderMermaid(debounced, theme).then(
      (out) => {
        if (!live) return;
        setSvg(out);
        setError(null);
      },
      (err: unknown) => live && setError(errorMessage(err, "The diagram could not be drawn.")),
    ).finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [debounced, theme, problem]);

  const file = useMemo(() => {
    if (!svg) return null;
    try {
      const standalone = standaloneSvg(svg, { background: BACKGROUND[bg] });
      return { text: standalone, size: svgSize(svg)! };
    } catch {
      return null;
    }
  }, [svg, bg]);

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const made = URL.createObjectURL(new Blob([file.text], { type: "image/svg+xml" }));
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);

  const name = diagramFileName(info.title, info.kind);

  const savePng = async () => {
    if (!file) return;
    setExportError(null);
    const target = pngSize(file.size.width, file.size.height, Number(pngScale));
    const blobUrl = URL.createObjectURL(new Blob([file.text], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = new Image();
      img.src = blobUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot make PNG pictures.");
      ctx.drawImage(img, 0, 0, target.width, target.height);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("The PNG could not be made.");
      downloadBlob(png, `${name}.png`, "image/png");
      if (target.capped) setExportError(`The picture was made smaller than asked (${target.width} × ${target.height}) because this drawing is very large.`);
    } catch (err) {
      setExportError(errorMessage(err, "The PNG could not be made."));
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Example">
          {(id) => (
            <Select
              id={id}
              value=""
              onChange={(e) => {
                const sample = DIAGRAM_SAMPLES.find((s) => s.id === e.target.value);
                if (sample) setState((s) => ({ ...s, code: sample.code }));
              }}
            >
              <option value="">Load an example…</option>
              {DIAGRAM_SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Theme">
          {(id) => (
            <Select id={id} value={theme} onChange={(e) => setState((s) => ({ ...s, theme: e.target.value as MermaidTheme }))}>
              <option value="default">Default</option>
              <option value="neutral">Neutral</option>
              <option value="forest">Forest</option>
              <option value="dark">Dark</option>
            </Select>
          )}
        </Field>
        <Field label="Background">
          {(id) => (
            <Select id={id} value={bg} onChange={(e) => setState((s) => ({ ...s, bg: e.target.value as Background }))}>
              <option value="white">White</option>
              <option value="dark">Dark</option>
              <option value="transparent">Transparent</option>
            </Select>
          )}
        </Field>
        <Field label="PNG size">
          {(id) => (
            <Select id={id} value={pngScale} onChange={(e) => setPngScale(e.target.value)}>
              <option value="1">1x</option>
              <option value="2">2x (sharper)</option>
              <option value="3">3x (print)</option>
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={info.kind ? `Diagram text · ${info.kind.label}` : "Diagram text"}>
          <Textarea aria-label="Mermaid diagram text" rows={20} className="min-h-96 font-mono" value={code} onChange={(e) => setState((s) => ({ ...s, code: e.target.value }))} spellCheck={false} />
        </Panel>

        <Panel
          title="Preview"
          actions={
            <>
              <Button size="sm" variant="outline" aria-label="Zoom out" disabled={!file || fit || zoom <= ZOOMS[0]} onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z as (typeof ZOOMS)[number]) - 1)] ?? z)}>
                <Minus />
              </Button>
              <Button size="sm" variant={fit ? "primary" : "outline"} disabled={!file} onClick={() => setFit((f) => !f)} aria-pressed={fit}>
                {fit ? "Fit" : `${Math.round(zoom * 100)}%`}
              </Button>
              <Button size="sm" variant="outline" aria-label="Zoom in" disabled={!file || (!fit && zoom >= (ZOOMS[ZOOMS.length - 1] as number))} onClick={() => (fit ? (setFit(false), setZoom(1.5)) : setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z as (typeof ZOOMS)[number]) + 1)] ?? z))}>
                <Plus />
              </Button>
            </>
          }
        >
          {error ? (
            <Alert tone={debounced.trim() ? "error" : "info"} title={debounced.trim() ? "The diagram has a problem" : undefined}>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">{error}</pre>
              {svg && debounced.trim() ? <p className="mt-2 text-sm">Showing the last version that worked.</p> : null}
            </Alert>
          ) : null}
          <div
            className="min-h-64 overflow-auto border border-border p-3"
            style={{ backgroundColor: BACKGROUND[bg] ?? "transparent" }}
            aria-busy={busy}
          >
            {url && file ? (
              // eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab
              <img
                src={url}
                alt={`Preview of the ${info.kind?.label.toLowerCase() ?? "diagram"}`}
                data-testid="diagram-preview"
                className="mx-auto block"
                style={fit ? { maxWidth: "100%", height: "auto" } : { width: file.size.width * zoom, maxWidth: "none" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{busy ? "Drawing…" : "Your diagram appears here."}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" disabled={!file} onClick={() => file && downloadBlob(file.text, `${name}.svg`, "image/svg+xml")}>
              <Download /> Download SVG
            </Button>
            <Button size="sm" variant="primary" disabled={!file} onClick={savePng}>
              <Download /> Download PNG
            </Button>
            <CopyButton text={file?.text ?? ""} label="Copy SVG" disabled={!file} />
          </div>
          {exportError ? <Alert tone="warning">{exportError}</Alert> : null}
        </Panel>
      </div>
    </div>
  );
}
