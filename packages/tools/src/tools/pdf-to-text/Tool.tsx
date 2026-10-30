"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, CopyButton, DownloadButton, ResultSlab, Stat, StatGrid, Textarea, Toggle, baseName } from "@toolwright/ui";
import { PdfCancelled } from "@toolwright/core/pdf-to-images";
import { TEXT_LIMITS, assembleDocument, checkTextRun, countCharacters, describeCoverage, textStats } from "@toolwright/core/pdf-to-text";
import { extractPdfText } from "../../shared/pdf-raster";
import { PdfDrop, PdfSourceCard, RunProgress, usePdfSource } from "../../shared/pdf-ui";
import { errorMessage, formatInt } from "../../shared/format";

interface Read {
  pages: string[];
  pageCount: number;
  truncated: boolean;
}

export default function Tool() {
  const pdf = usePdfSource();
  const [joinHyphens, setJoinHyphens] = useState(true);
  const [pageMarkers, setPageMarkers] = useState(true);
  const [read, setRead] = useState<Read | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const source = pdf.source;
  const limit = source ? checkTextRun(source.file.size, source.info.pageCount) : {};

  // Read the file as soon as it is chosen, and again when the hyphen setting changes. Older runs are cancelled.
  useEffect(() => {
    if (!source) return;
    if (checkTextRun(source.file.size, source.info.pageCount).refuse) return;
    const stop = new AbortController();
    controller.current?.abort();
    controller.current = stop;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: source.info.pageCount });
    (async () => {
      try {
        const result = await extractPdfText(source.file, { joinHyphens, signal: stop.signal, onProgress: setProgress });
        if (!stop.signal.aborted) setRead({ pages: result.pages, pageCount: result.pageCount, truncated: result.truncated });
      } catch (err) {
        if (stop.signal.aborted || err instanceof PdfCancelled) return;
        setRead(null);
        setError(errorMessage(err, "The text could not be read."));
      } finally {
        // Also reached when this run was replaced; only the newest run may clear the busy state.
        if (controller.current === stop) {
          setBusy(false);
          setProgress(null);
        }
      }
    })();
    return () => stop.abort();
  }, [source, joinHyphens]);

  function remove() {
    controller.current?.abort();
    pdf.clear();
    setRead(null);
    setError(null);
    setBusy(false);
    setProgress(null);
  }

  const text = useMemo(() => (read ? assembleDocument(read.pages, { joinHyphens, pageMarkers }) : ""), [read, joinHyphens, pageMarkers]);
  const coverage = useMemo(() => (read ? describeCoverage(read.pages.map(countCharacters)) : null), [read]);
  const stats = useMemo(() => textStats(read ? assembleDocument(read.pages, { joinHyphens, pageMarkers: false }) : ""), [read, joinHyphens]);

  return (
    <div className="flex flex-col gap-6">
      {!source ? <PdfDrop onFile={(f) => void pdf.load(f)} onReject={pdf.setError} loading={pdf.loading} /> : <PdfSourceCard source={source} onRemove={remove} />}
      {pdf.error ? <Alert tone="error">{pdf.error}</Alert> : null}
      {limit.refuse ? <Alert tone="error">{limit.refuse}</Alert> : null}
      {limit.warn ? <Alert tone="warning">{limit.warn}</Alert> : null}

      {source ? (
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Toggle label="Mark each page" checked={pageMarkers} onCheckedChange={setPageMarkers} hint="Adds a line such as --- Page 2 --- before each page." />
          <Toggle label="Join words split at a line end" checked={joinHyphens} onCheckedChange={setJoinHyphens} hint="Turns exam- and ple into example." />
        </div>
      ) : null}

      {busy ? (
        <div className="flex flex-col gap-2">
          <RunProgress label={`Reading page ${Math.min((progress?.done ?? 0) + 1, progress?.total ?? 1)} of ${progress?.total ?? 0}`} done={progress?.done ?? 0} total={progress?.total ?? 0} />
          <Button variant="outline" size="sm" className="self-start" onClick={() => controller.current?.abort()}>
            Cancel
          </Button>
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {read && !busy ? (
        <div className="flex flex-col gap-4">
          {coverage && coverage.kind !== "ok" ? <Alert tone="warning">{coverage.message}</Alert> : null}
          {read.truncated ? <Alert tone="warning">The text was cut short because it passed {formatInt(TEXT_LIMITS.maxCharacters / 1_000_000)} million characters. Split the PDF to read the rest.</Alert> : null}
          <ResultSlab label="Words" value={formatInt(stats.words)} valueTestId="pdf-text-words" note={`${formatInt(stats.characters)} characters on ${formatInt(read.pages.length)} of ${formatInt(read.pageCount)} pages`} />
          <StatGrid>
            <Stat label="Pages with text" value={formatInt(coverage?.pagesWithText ?? 0)} />
            <Stat label="Lines" value={formatInt(stats.lines)} />
          </StatGrid>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={text} label="Copy text" disabled={!text} />
            <DownloadButton data={text} filename={`${baseName(source?.file.name ?? "document")}.txt`} mime="text/plain" label="Download .txt" />
          </div>
          <Textarea readOnly rows={18} value={text} aria-label="Text from the PDF" placeholder="No text was found." />
        </div>
      ) : null}
    </div>
  );
}
