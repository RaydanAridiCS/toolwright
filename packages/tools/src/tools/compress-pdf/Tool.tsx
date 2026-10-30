"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, DownloadButton, FileDropzone, FileListItem, ResultSlab, SegmentedControl, Stat, StatGrid, baseName, formatFileSize } from "@toolwright/ui";
import {
  COMPRESS_LIMITS,
  COMPRESS_PRESETS,
  CompressCancelled,
  DPI_RANGE,
  QUALITY_RANGE,
  SMALLEST_MIN_GAIN,
  checkFileSize,
  checkPageCount,
  matchPreset,
  pickSmaller,
  summarizeSkips,
  validateSettings,
  type CompressMode,
  type CompressPresetId,
  type CompressSettings,
  type PdfAnalysis,
  type SizeOutcome,
} from "@toolwright/core/pdf-compress";
import { CompressAborted, CompressSession } from "../../shared/pdf-compress-client";
import { rasterizePdf } from "../../shared/pdf-raster";
import { JobError, RunButton, RunProgress, useJob } from "../../shared/pdf-ui";
import { NumberField, num } from "../../shared/number-field";
import { errorMessage, formatInt, pluralize } from "../../shared/format";

type Outcome =
  | { kind: "cancelled" }
  | { kind: "done"; mode: CompressMode; settings: CompressSettings; data: Uint8Array | null; outcome: SizeOutcome; notes: string[]; headline: string };

const PRESET_OPTIONS: { value: CompressPresetId | "custom"; label: string }[] = [
  ...(Object.entries(COMPRESS_PRESETS) as [CompressPresetId, (typeof COMPRESS_PRESETS)[CompressPresetId]][]).map(([value, p]) => ({ value, label: p.label })),
  { value: "custom", label: "Custom" },
];

const percent = (fraction: number) => `−${Math.max(0, Math.round(fraction * 100))}%`;

async function looksLinearized(file: File): Promise<boolean> {
  try {
    return (await file.slice(0, 1024).text()).includes("/Linearized");
  } catch {
    return false;
  }
}

export default function Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [linearized, setLinearized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<CompressMode>("keep-text");
  const [values, setValues] = useState({ quality: String(COMPRESS_PRESETS.balanced.quality), maxDpi: String(COMPRESS_PRESETS.balanced.maxDpi) });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const job = useJob<Outcome>();
  const session = useRef<CompressSession | null>(null);
  const stop = useRef<(() => void) | null>(null);

  const release = useCallback(() => {
    stop.current?.();
    stop.current = null;
    session.current?.dispose();
    session.current = null;
  }, []);
  useEffect(() => release, [release]);

  const parsed = useMemo(() => {
    try {
      return { settings: validateSettings({ quality: num(values.quality), maxDpi: num(values.maxDpi) }), error: null };
    } catch (err) {
      return { settings: null, error: errorMessage(err) };
    }
  }, [values]);
  const activePreset = parsed.settings ? (matchPreset(parsed.settings) ?? "custom") : "custom";

  const clear = useCallback(() => {
    release();
    setFile(null);
    setAnalysis(null);
    setLoadError(null);
    setProgress(null);
    job.reset();
  }, [release, job]);

  const load = useCallback(
    async (next: File) => {
      release();
      job.reset();
      setAnalysis(null);
      setLoadError(null);
      setFile(null);
      const size = checkFileSize(next.size);
      if (size.refuse) return setLoadError(size.refuse);
      if (next.size < 8 || (await next.slice(0, 5).text()) !== "%PDF-") return setLoadError(`${next.name} does not look like a PDF file.`);
      setFile(next);
      setLoading(true);
      const created = new CompressSession(next);
      session.current = created;
      const task = created.analyze();
      stop.current = task.cancel;
      try {
        const [result, isLinear] = await Promise.all([task.promise, looksLinearized(next)]);
        setAnalysis(result);
        setLinearized(isLinear);
      } catch (err) {
        if (err instanceof CompressAborted) return;
        setFile(null);
        setLoadError(errorMessage(err, "This PDF could not be read."));
      } finally {
        if (session.current === created) stop.current = null;
        setLoading(false);
      }
    },
    [release, job],
  );

  const edit = (patch: Partial<typeof values>) => {
    job.reset();
    setValues((v) => ({ ...v, ...patch }));
  };

  const pageCheck = analysis ? checkPageCount(analysis.pageCount, mode) : {};
  const sizeCheck = file ? checkFileSize(file.size) : {};
  const skips = analysis ? summarizeSkips(analysis) : [];
  const nothingToDo = !!analysis && mode === "keep-text" && analysis.recompressibleBytes === 0;
  const blocked = !parsed.settings || !!pageCheck.refuse || nothingToDo;

  const run = () => {
    if (!file || !analysis || !parsed.settings) return;
    const settings = parsed.settings;
    const runMode = mode;
    const source = file;
    setProgress(null);
    job.run(async (): Promise<Outcome> => {
      try {
        if (runMode === "keep-text") {
          const current = session.current ?? (session.current = new CompressSession(source));
          const task = current.compress(settings, setProgress);
          stop.current = task.cancel;
          const { data, outcome, report } = await task.promise;
          const notes: string[] = [];
          if (report.recompressed > 0) notes.push(`Recompressed ${pluralize(report.recompressed, "image")} of ${formatInt(report.images)}, from ${formatFileSize(report.imageBytesBefore)} of images to ${formatFileSize(report.imageBytesAfter)}.`);
          if (report.keptOriginal > 0) notes.push(`${pluralize(report.keptOriginal, "image")} kept as they were, because the new version was not at least 10% smaller.`);
          if (report.unreadable > 0) notes.push(`${pluralize(report.unreadable, "image")} could not be read by this browser and were kept as they were.`);
          for (const skip of skips) notes.push(`${pluralize(skip.count, "image")} (${formatFileSize(skip.bytes)}) skipped: ${skip.reason}.`);
          if (report.recompressed === 0 && data) notes.push("No image was replaced; the saving comes from storing the file's structure more compactly.");
          if (data && linearized) notes.push("The original was set up for fast web view; the new file is not.");
          return { kind: "done", mode: runMode, settings, data, outcome, notes, headline: "Keep text" };
        }
        const controller = new AbortController();
        stop.current = () => controller.abort();
        const raster = await rasterizePdf(source, settings, { onProgress: setProgress, signal: controller.signal });
        const outcome = pickSmaller(source.size, raster.data.length, SMALLEST_MIN_GAIN);
        const notes = [`Every page was drawn as a picture at up to ${settings.maxDpi} dpi. The text in the new file cannot be selected or searched.`];
        if (raster.cappedPages > 0) notes.push(`${pluralize(raster.cappedPages, "page")} drawn at a lower resolution to stay within this browser's canvas limit.`);
        if (!outcome.smaller && raster.data.length < source.size) notes.push(`The result is only ${percent(outcome.savedFraction).replace("−", "")} smaller, which is not worth losing the text. Your original is the better file.`);
        return { kind: "done", mode: runMode, settings, data: outcome.smaller ? raster.data : null, outcome, notes, headline: "Smallest file" };
      } catch (err) {
        if (err instanceof CompressAborted || err instanceof CompressCancelled) return { kind: "cancelled" };
        throw err;
      } finally {
        stop.current = null;
        setProgress(null);
      }
    });
  };

  const result = job.result;
  const done = result?.kind === "done" ? result : null;
  const progressLabel = progress ? (mode === "keep-text" ? `Image ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : `Page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`) : "Reading the file…";
  const warnings = [sizeCheck.warn, pageCheck.warn].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-5">
      {file ? (
        <ul>
          <FileListItem name={file.name} size={file.size} detail={analysis ? pluralize(analysis.pageCount, "page") : loading ? "Reading…" : undefined} onRemove={clear} />
        </ul>
      ) : (
        <FileDropzone
          accept=".pdf,application/pdf"
          label={loading ? "Reading PDF…" : "Drop a PDF here, or click to browse"}
          hint="Your PDF is processed in this tab and never uploaded."
          maxSizeMB={4096}
          disabled={loading}
          onReject={setLoadError}
          onFiles={([f]) => f && load(f)}
        />
      )}
      <JobError error={loadError} />

      {file && loading ? <p className="text-sm text-muted-foreground">Reading the file and counting its images…</p> : null}

      {file && analysis ? (
        <>
          <StatGrid>
            <Stat label="File size" value={formatFileSize(file.size)} />
            <Stat label="Pages" value={formatInt(analysis.pageCount)} />
            <Stat label="Images" value={formatInt(analysis.images.length)} />
            <Stat label="Images take" value={analysis.fileSize > 0 ? `${Math.round((analysis.imageBytes / analysis.fileSize) * 100)}%` : "0%"} />
          </StatGrid>

          {analysis.signed ? <Alert tone="warning">This PDF is digitally signed. Any change, in either mode, makes the signature invalid.</Alert> : null}
          {file.size < COMPRESS_LIMITS.smallFileBytes ? <Alert tone="info">This file is already small ({formatFileSize(file.size)}). There may be little to gain.</Alert> : null}
          {warnings.map((w) => (
            <Alert key={w} tone="info">
              {w}
            </Alert>
          ))}
          {pageCheck.refuse ? <Alert tone="error">{pageCheck.refuse}</Alert> : null}

          <div className="flex flex-col gap-4 border border-border bg-card p-4">
            <SegmentedControl
              label="Mode"
              value={mode}
              onValueChange={(m) => (setMode(m), job.reset())}
              options={[
                { value: "keep-text", label: "Keep text" },
                { value: "smallest", label: "Smallest file" },
              ]}
            />
            {mode === "keep-text" ? (
              <p className="text-sm text-muted-foreground">
                Recompresses the JPEG photos inside the PDF. Text, links, forms and bookmarks are not touched.
                {analysis.recompressibleBytes > 0
                  ? ` ${formatFileSize(analysis.recompressibleBytes)} of this file can be recompressed, so it can shrink by at most about that much.`
                  : ""}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Draws every page and saves it as a picture. This usually gives the smallest file.</p>
            )}

            <SegmentedControl
              label="Strength"
              value={activePreset}
              onValueChange={(id) => {
                if (id === "custom") return setAdvancedOpen(true);
                const preset = COMPRESS_PRESETS[id];
                edit({ quality: String(preset.quality), maxDpi: String(preset.maxDpi) });
              }}
              options={PRESET_OPTIONS}
            />
            <details open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)} className="text-sm">
              <summary className="cursor-pointer font-semibold">Advanced</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <NumberField label="Image quality" value={values.quality} onChange={(quality) => edit({ quality })} min={QUALITY_RANGE.min} max={QUALITY_RANGE.max} step={1} hint={`${QUALITY_RANGE.min} to ${QUALITY_RANGE.max}. Lower is smaller.`} />
                <NumberField
                  label={mode === "keep-text" ? "Maximum image resolution" : "Page resolution"}
                  value={values.maxDpi}
                  onChange={(maxDpi) => edit({ maxDpi })}
                  suffix="dpi"
                  min={DPI_RANGE.min}
                  max={DPI_RANGE.max}
                  step={1}
                  hint={mode === "keep-text" ? "Larger images are scaled down to this." : "Every page is drawn at this resolution."}
                />
              </div>
            </details>
            {parsed.error ? <Alert tone="error">{parsed.error}</Alert> : null}
          </div>

          {mode === "smallest" ? (
            <Alert tone="warning" title="This removes selectable text">
              Smallest file turns each page into a picture. You will lose selectable and searchable text, copy and paste, links, fillable fields, bookmarks and screen-reader structure. Choose Keep text if you need any of those.
            </Alert>
          ) : null}

          {nothingToDo ? (
            <Alert tone="info" title={analysis.images.length === 0 ? "This PDF has no images" : "No image can be recompressed in this mode"}>
              {analysis.images.length === 0
                ? "Text and vector content are already compact, so there is nothing for Keep text to shrink."
                : `${pluralize(analysis.images.length, "image")} found, but none are JPEG photos Keep text can handle.`}
              {skips.length > 0 ? (
                <ul className="mt-1 list-disc pl-5">
                  {skips.map((s) => (
                    <li key={s.reason}>
                      {pluralize(s.count, "image")} ({formatFileSize(s.bytes)}): {s.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {analysis.imageBytes / Math.max(1, analysis.fileSize) > 0.3 ? " Smallest file can still shrink them, at the cost of the text." : ""}
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <RunButton busy={job.busy} disabled={blocked} onClick={run}>
              {mode === "smallest" ? "Flatten pages and compress" : "Compress PDF"}
            </RunButton>
            {job.busy ? (
              <Button variant="outline" size="lg" onClick={() => stop.current?.()}>
                Cancel
              </Button>
            ) : null}
            {nothingToDo ? <DownloadButton data={file} filename={file.name} mime="application/pdf" label="Download original" /> : null}
          </div>
          {job.busy ? <RunProgress label={progressLabel} done={progress?.done ?? 0} total={progress?.total ?? 0} /> : null}
        </>
      ) : null}

      <JobError error={job.error} />
      {result?.kind === "cancelled" ? <Alert tone="info">Cancelled. Your original file is untouched.</Alert> : null}

      {done && file ? (
        done.data ? (
          <>
            <ResultSlab label={`${done.headline}: new size`} value={`${formatFileSize(done.outcome.before)} → ${formatFileSize(done.outcome.after)}`} note={`${percent(done.outcome.savedFraction)} · saved ${formatFileSize(done.outcome.savedBytes)}`} valueTestId="compress-sizes" size="md" />
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {done.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-4 border border-l-4 border-foreground border-l-success bg-card p-4 shadow-md">
              <div className="min-w-0 flex-1">
                <p className="font-medium">Your smaller file is ready.</p>
                <p className="truncate text-sm text-muted-foreground">
                  {baseName(file.name)}-compressed.pdf · {formatFileSize(done.data.length)}
                </p>
              </div>
              <DownloadButton data={done.data} filename={`${baseName(file.name)}-compressed.pdf`} mime="application/pdf" variant="primary" size="md" label="Download" />
            </div>
          </>
        ) : (
          <>
            <Alert tone="warning" title="This could not be made smaller">
              {done.outcome.after >= done.outcome.before
                ? `The result would be ${formatFileSize(done.outcome.after)}, and your original is ${formatFileSize(done.outcome.before)}.`
                : `The best result was ${formatFileSize(done.outcome.after)} against ${formatFileSize(done.outcome.before)}, which is not worth the loss.`}{" "}
              Your original is still the best file you have.
              {done.notes.length > 0 ? (
                <ul className="mt-1 list-disc pl-5">
                  {done.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
            <div>
              <DownloadButton data={file} filename={file.name} mime="application/pdf" label="Download original" />
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
