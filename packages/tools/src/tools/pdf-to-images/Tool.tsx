"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Alert, Button, Field, Input, Panel, ResultSlab, Select, Stat, StatGrid, baseName, downloadBlob, formatFileSize } from "@toolwright/ui";
import {
  DPI_CHOICES,
  PAGE_IMAGE_FORMATS,
  PAGE_IMAGE_LIMITS,
  PdfCancelled,
  QUALITY_CHOICES,
  checkRun,
  formatInfo,
  pageImageName,
  selectPages,
  zipFileName,
  type PageImageFormat,
} from "@toolwright/core/pdf-to-images";
import { renderPagesToImages, type PageImage } from "../../shared/pdf-raster";
import { PdfDrop, PdfSourceCard, RunButton, RunProgress, usePdfSource } from "../../shared/pdf-ui";
import { createZip } from "../../shared/zip";
import { errorMessage, formatInt, pluralize } from "../../shared/format";

/** Pictures shown as small previews. More than this and the list shows names only, so the tab stays light. */
const PREVIEW_LIMIT = 24;

interface Run {
  images: PageImage[];
  pageCount: number;
  base: string;
  format: PageImageFormat;
  stoppedEarly: boolean;
  cancelled: boolean;
}

function Preview({ image, name }: { image: PageImage; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const made = URL.createObjectURL(image.blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [image.blob]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab
    <img src={url} alt={`Preview of ${name}`} loading="lazy" decoding="async" className="h-20 w-16 shrink-0 border border-border bg-card object-contain" />
  ) : (
    <span aria-hidden className="h-20 w-16 shrink-0 border border-border bg-muted" />
  );
}

export default function Tool() {
  const pdf = usePdfSource();
  const [pages, setPages] = useState("");
  const [dpi, setDpi] = useState(150);
  const [format, setFormat] = useState<PageImageFormat>("png");
  const [quality, setQuality] = useState<number>(QUALITY_CHOICES.default);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [zipping, setZipping] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const source = pdf.source;
  const info = formatInfo(format);

  const selection = useMemo(() => {
    if (!source) return { pages: [] as number[], error: null as string | null };
    try {
      return { pages: selectPages(pages, source.info.pageCount), error: null };
    } catch (err) {
      return { pages: [], error: errorMessage(err) };
    }
  }, [source, pages]);

  const limit = source && !selection.error ? checkRun(source.file.size, selection.pages.length) : {};

  function remove() {
    controller.current?.abort();
    pdf.clear();
    setRun(null);
    setError(null);
    setPages("");
  }

  async function start() {
    if (!source || selection.error || limit.refuse) return;
    const stop = new AbortController();
    controller.current = stop;
    const finished: PageImage[] = [];
    setBusy(true);
    setError(null);
    setRun(null);
    setProgress({ done: 0, total: selection.pages.length });
    const base = baseName(source.file.name);
    try {
      const result = await renderPagesToImages(source.file, {
        pageIndexes: selection.pages,
        dpi,
        format,
        quality,
        signal: stop.signal,
        onProgress: setProgress,
        onPage: (image) => finished.push(image),
      });
      setRun({ images: result.images, pageCount: result.pageCount, base, format, stoppedEarly: result.stoppedEarly, cancelled: false });
    } catch (err) {
      if (err instanceof PdfCancelled) {
        // Keep whatever was finished, and say so.
        setRun(finished.length ? { images: finished, pageCount: source.info.pageCount, base, format, stoppedEarly: false, cancelled: true } : null);
        if (!finished.length) setError("Stopped. Nothing was saved.");
      } else {
        setError(errorMessage(err, "The pages could not be drawn."));
      }
    } finally {
      setBusy(false);
      setProgress(null);
      if (controller.current === stop) controller.current = null;
    }
  }

  async function downloadZip() {
    if (!run) return;
    setZipping(true);
    try {
      const entries = await Promise.all(
        run.images.map(async (image) => ({
          name: pageImageName(run.base, image.pageIndex, run.pageCount, formatInfo(run.format).extension),
          data: new Uint8Array(await image.blob.arrayBuffer()),
        })),
      );
      downloadBlob(createZip(entries), zipFileName(run.base), "application/zip");
    } catch (err) {
      setError(errorMessage(err, "The ZIP file could not be made."));
    } finally {
      setZipping(false);
    }
  }

  const totalBytes = run ? run.images.reduce((sum, image) => sum + image.blob.size, 0) : 0;
  const capped = run ? run.images.filter((image) => image.capped).length : 0;
  const runExt = run ? formatInfo(run.format).extension : info.extension;

  return (
    <div className="flex flex-col gap-6">
      {!source ? <PdfDrop onFile={(f) => void pdf.load(f)} onReject={pdf.setError} loading={pdf.loading} /> : <PdfSourceCard source={source} onRemove={remove} />}
      {pdf.error ? <Alert tone="error">{pdf.error}</Alert> : null}

      {source ? (
        <>
          <Panel title="Pictures">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Pages" hint={`Leave empty for all ${source.info.pageCount}. Or write 1-3, 5, last.`}>
                {(id) => <Input id={id} value={pages} placeholder="All pages" mono aria-invalid={selection.error ? true : undefined} onChange={(e) => setPages(e.target.value)} />}
              </Field>
              <Field label="Resolution">
                {(id) => (
                  <Select id={id} value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                    {DPI_CHOICES.map((value) => (
                      <option key={value} value={value}>
                        {value} DPI{value === 72 ? " (screen)" : value === 150 ? " (sharing)" : value === 300 ? " (print)" : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Picture format">
                {(id) => (
                  <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as PageImageFormat)}>
                    {PAGE_IMAGE_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {info.lossy ? (
                <Field label={`Quality (${quality})`}>
                  {(id) => <input id={id} type="range" min={QUALITY_CHOICES.min} max={QUALITY_CHOICES.max} step={1} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-primary" />}
                </Field>
              ) : null}
            </div>
            {selection.error ? <Alert tone="error">{selection.error}</Alert> : null}
            {limit.refuse ? <Alert tone="error">{limit.refuse}</Alert> : null}
            {limit.warn ? <Alert tone="warning">{limit.warn}</Alert> : null}
            <p className="text-xs text-muted-foreground">
              {pluralize(selection.pages.length, "page")} will be drawn in this tab. Very large pages are drawn a little smaller than asked, so the browser does not run out of memory (at most {formatInt(PAGE_IMAGE_LIMITS.maxPagePixels / 1_000_000)} million pixels per page).
            </p>
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <RunButton busy={busy} disabled={!!selection.error || !!limit.refuse || selection.pages.length === 0} onClick={() => void start()}>
              Make pictures
            </RunButton>
            {busy ? (
              <Button variant="outline" size="md" onClick={() => controller.current?.abort()}>
                Cancel
              </Button>
            ) : null}
          </div>
          {busy ? <RunProgress label={`Page ${Math.min((progress?.done ?? 0) + 1, progress?.total ?? 1)} of ${progress?.total ?? 0}`} done={progress?.done ?? 0} total={progress?.total ?? 0} /> : null}
        </>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {run ? (
        <div className="flex flex-col gap-4" aria-live="polite">
          <ResultSlab label={run.cancelled ? "Stopped. Pictures finished" : "Pictures made"} value={formatInt(run.images.length)} valueTestId="pictures-count" note={`${formatFileSize(totalBytes)} in total, ${runExt.toUpperCase()}`} />
          <StatGrid>
            <Stat label="Pages in the PDF" value={formatInt(run.pageCount)} />
            <Stat label="Format" value={runExt.toUpperCase()} />
            <Stat label="Total size" value={formatFileSize(totalBytes)} />
          </StatGrid>
          {run.stoppedEarly ? <Alert tone="warning">The run stopped after {pluralize(run.images.length, "page")} because the pictures together passed {PAGE_IMAGE_LIMITS.maxTotalBytes / 1024 / 1024} MB. Choose the remaining pages for another run.</Alert> : null}
          {run.cancelled ? <Alert tone="info">You stopped the run. The finished pictures are listed below.</Alert> : null}
          {capped > 0 ? <Alert tone="warning">{pluralize(capped, "page")} {capped === 1 ? "was" : "were"} drawn at a lower resolution than asked because the page is very large.</Alert> : null}

          <div className="flex flex-wrap items-center gap-2">
            {run.images.length > 1 ? (
              <Button variant="primary" size="md" disabled={zipping} onClick={() => void downloadZip()}>
                {zipping ? <Loader2 aria-hidden className="animate-spin" /> : <Download aria-hidden />}
                Download all as ZIP
              </Button>
            ) : null}
          </div>

          <ul aria-label="Pictures" className="flex max-h-[28rem] flex-col divide-y divide-border overflow-auto border border-border bg-card">
            {run.images.map((image, position) => {
              const name = pageImageName(run.base, image.pageIndex, run.pageCount, formatInfo(run.format).extension);
              return (
                <li key={image.pageIndex} className="flex items-center gap-3 p-3">
                  {position < PREVIEW_LIMIT ? <Preview image={image} name={name} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      Page {image.pageIndex + 1} · {image.width} × {image.height} px · {formatFileSize(image.blob.size)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" aria-label={`Download page ${image.pageIndex + 1}`} onClick={() => downloadBlob(image.blob, name, image.blob.type)}>
                    <Download aria-hidden />
                    Download
                  </Button>
                </li>
              );
            })}
          </ul>
          {run.images.length > PREVIEW_LIMIT ? <p className="text-xs text-muted-foreground">Previews are shown for the first {PREVIEW_LIMIT} pages only, to keep this tab light.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
