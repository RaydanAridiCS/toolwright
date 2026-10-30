"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, CopyButton, DownloadButton, Field, FileDropzone, formatFileSize, Panel, ResultSlab, Select, SegmentedControl, Stat, StatGrid, baseName, Toggle } from "@toolwright/ui";
import type { TraceMode, TraceOptions, TraceResult } from "@toolwright/core/image-trace";
import { NumberField, num } from "../../shared/number-field";
import { SvgPreview, useObjectUrl } from "../../shared/svg-preview";
import { decodePicture, traceInWorker, TraceAborted, type DecodedPicture } from "../../shared/image-trace-client";
import { errorMessage } from "../../shared/format";

const MODES: { value: TraceMode; label: string }[] = [
  { value: "black-white", label: "Black and white" },
  { value: "color", label: "Colour" },
];

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [picture, setPicture] = useState<DecodedPicture | null>(null);
  const [mode, setMode] = useState<TraceMode>("black-white");
  const [colors, setColors] = useState("8");
  const [auto, setAuto] = useState(true);
  const [threshold, setThreshold] = useState("128");
  const [detail, setDetail] = useState<NonNullable<TraceOptions["detail"]>>("balanced");
  const [specks, setSpecks] = useState("8");
  const [soften, setSoften] = useState("0");
  const [removeBackground, setRemoveBackground] = useState(false);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = useObjectUrl(file);

  const options = useMemo<TraceOptions>(
    () => ({
      mode,
      colors: Math.round(num(colors)),
      threshold: mode === "black-white" && !auto ? num(threshold) : undefined,
      detail,
      ignoreSpecks: num(specks),
      soften: num(soften),
      removeBackground,
    }),
    [mode, colors, auto, threshold, detail, specks, soften, removeBackground],
  );

  // Trace again a moment after any setting changes. An older run is cancelled so a slow one can never overwrite a newer one.
  useEffect(() => {
    if (!picture) return;
    let live = true;
    let cancel = () => {};
    const timer = setTimeout(() => {
      setBusy(true);
      const task = traceInWorker(picture, options);
      cancel = task.cancel;
      task.promise
        .then((r) => {
          if (!live) return;
          setResult(r);
          setError(null);
        })
        .catch((err) => {
          if (!live || err instanceof TraceAborted) return;
          setResult(null);
          setError(errorMessage(err, "The picture could not be traced."));
        })
        .finally(() => live && setBusy(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
      cancel();
    };
  }, [picture, options]);

  const load = async (next: File) => {
    setError(null);
    setResult(null);
    setPicture(null);
    setFile(next);
    try {
      setPicture(await decodePicture(next));
    } catch (err) {
      setFile(null);
      setError(errorMessage(err));
    }
  };

  const name = file ? `${baseName(file.name)}.svg` : "traced.svg";

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" label="Drop a picture here, or click to browse" hint="PNG, JPG, WebP, GIF or BMP. It is traced in this tab and never uploaded." maxSizeMB={25} onReject={setError} onFiles={([f]) => f && load(f)} />

      <Alert tone="info">Tracing works best on logos, icons, signatures and flat drawings. A photograph gives a huge, lumpy result.</Alert>

      <div className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <SegmentedControl label="Colours" value={mode} onValueChange={setMode} options={MODES} />
        </div>
        {mode === "color" ? (
          <NumberField label="Number of colours" value={colors} onChange={setColors} min={2} max={64} step={1} hint="2 to 64." />
        ) : (
          <>
            <Toggle label="Choose the cut-off automatically" checked={auto} onCheckedChange={setAuto} />
            {!auto ? <NumberField label="Dark/light cut-off" value={threshold} onChange={setThreshold} min={0} max={255} step={1} hint="Pixels this dark or darker become black." /> : null}
          </>
        )}
        <Field label="Detail">
          {(id) => (
            <Select id={id} value={detail} onChange={(e) => setDetail(e.target.value as typeof detail)}>
              <option value="smooth">Smooth (fewer points)</option>
              <option value="balanced">Balanced</option>
              <option value="exact">Exact (follows every pixel)</option>
            </Select>
          )}
        </Field>
        <NumberField label="Ignore specks" value={specks} onChange={setSpecks} min={0} max={100} step={1} hint="Bigger removes more noise." />
        <NumberField label="Soften first" value={soften} onChange={setSoften} min={0} max={5} step={1} hint="Smooths a noisy picture." />
        {mode === "color" ? <Toggle label="Remove the background" checked={removeBackground} onCheckedChange={setRemoveBackground} /> : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {picture?.shrunkFrom ? (
        <Alert tone="warning">
          Your picture is {picture.shrunkFrom.width} × {picture.shrunkFrom.height}, so it was scaled to {picture.width} × {picture.height} to keep tracing fast.
        </Alert>
      ) : null}
      {busy ? <p className="text-sm text-muted-foreground">Tracing…</p> : null}

      {file && original ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Original">
            <div className="grid min-h-48 place-items-center border border-border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab */}
              <img src={original} alt="The original picture" className="block max-h-80 max-w-full object-contain" />
            </div>
          </Panel>
          <Panel
            title="Traced SVG"
            actions={
              result ? (
                <>
                  <CopyButton text={result.svg} label="Copy" />
                  <DownloadButton data={result.svg} filename={name} mime="image/svg+xml" label="Download" />
                </>
              ) : null
            }
          >
            {result ? <SvgPreview svg={result.svg} label="The traced SVG" maxHeight={320} className="min-h-48" /> : <p className="grid min-h-48 place-items-center text-sm text-muted-foreground">{busy ? "Tracing…" : "The result appears here."}</p>}
          </Panel>
        </div>
      ) : null}

      {result ? (
        <>
          <ResultSlab label="SVG size" size="md" value={formatFileSize(result.bytes)} note={file ? `The original file is ${formatFileSize(file.size)}.` : undefined} valueTestId="trace-size" />
          <StatGrid>
            <Stat label="Paths" value={String(result.paths)} />
            <Stat label="Colours" value={String(result.colors)} />
          </StatGrid>
        </>
      ) : null}
    </div>
  );
}
