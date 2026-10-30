"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Button, DownloadButton, FileDropzone, FileListItem, formatFileSize } from "@toolwright/ui";
import { getPdfInfo, isPdf, type PdfInfo } from "@toolwright/core/pdf";
import { errorMessage } from "./format";

export interface PdfSource {
  file: File;
  bytes: Uint8Array;
  info: PdfInfo;
}

/** Loads a single PDF from a drop, reads its structure, and tracks errors. */
export function usePdfSource() {
  const [source, setSource] = useState<PdfSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isPdf(bytes)) throw new Error(`${file.name} does not look like a PDF file.`);
      const info = await getPdfInfo(bytes);
      setSource({ file, bytes, info });
    } catch (err) {
      setSource(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSource(null);
    setError(null);
  }, []);

  return { source, error, setError, loading, load, clear };
}

export function PdfDrop({ onFile, onReject, loading }: { onFile: (file: File) => void; onReject?: (message: string) => void; loading?: boolean }) {
  return (
    <FileDropzone
      accept=".pdf,application/pdf"
      label={loading ? "Reading PDF…" : "Drop a PDF here, or click to browse"}
      hint="Your PDF is processed in this tab and never uploaded."
      disabled={loading}
      onReject={onReject}
      onFiles={([f]) => f && onFile(f)}
    />
  );
}

export function PdfSourceCard({ source, onRemove }: { source: PdfSource; onRemove: () => void }) {
  return (
    <ul>
      <FileListItem name={source.file.name} size={source.file.size} detail={`${source.info.pageCount} page${source.info.pageCount === 1 ? "" : "s"}`} onRemove={onRemove} />
    </ul>
  );
}

/** Runs an async job with busy and error state. */
export function useJob<T>() {
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (job: () => Promise<T>) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await job());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, busy, run, reset };
}

export function RunButton({ busy, disabled, onClick, children }: { busy: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="primary" size="lg" disabled={busy || disabled} onClick={onClick} className="self-start">
      {busy ? <Loader2 className="animate-spin" /> : null}
      {busy ? "Working…" : children}
    </Button>
  );
}

/** Progress for long jobs: a flat bar, a label such as "Page 3 of 12", and a polite spoken update every quarter. */
export function RunProgress({ label, done, total }: { label: string; done: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2.5 border border-foreground bg-card">
        <div className="h-full bg-marker" style={{ width: `${percent}%` }} />
      </div>
      <p role="status" className="sr-only">
        {Math.floor(percent / 25) * 25}% done
      </p>
    </div>
  );
}

export function JobError({ error }: { error: string | null }) {
  return error ? <Alert tone="error">{error}</Alert> : null;
}

export function DownloadResult({ data, filename, mime = "application/pdf", note }: { data: Uint8Array; filename: string; mime?: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border border-l-4 border-foreground border-l-success bg-card p-4 shadow-md">
      <div className="min-w-0 flex-1">
        <p className="font-medium">Done! Your file is ready.</p>
        <p className="truncate text-sm text-muted-foreground">
          {filename} · {formatFileSize(data.length)}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
      <DownloadButton data={data} filename={filename} mime={mime} variant="primary" size="md" label="Download" />
    </div>
  );
}
