"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, Button, Field, Input, SegmentedControl, Toggle, baseName } from "@toolwright/ui";
import { displaySize, looksDigitallySigned, pagesFromSpec, readPageGeometry, signPdf, type PageGeometry } from "@toolwright/core/pdf-sign";
import { DownloadResult, JobError, PdfDrop, PdfSourceCard, RunButton, useJob, usePdfSource } from "../../shared/pdf-ui";
import { createThumbnailer, type PageThumbnailer } from "../../shared/pdf-raster";
import { SignatureMaker, type Signature } from "../../shared/signature-maker";

type Scope = "this" | "all" | "last" | "pick";

/** Position and size of the signature as fractions of the page as shown, so it works on pages of any size. */
interface Place {
  left: number;
  top: number;
  width: number;
}

const START: Place = { left: 0.55, top: 0.8, width: 0.3 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const todayText = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Tool() {
  const pdf = usePdfSource();
  const source = pdf.source;
  const [geometry, setGeometry] = useState<PageGeometry[] | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [page, setPage] = useState(0);
  const [place, setPlace] = useState<Place>(START);
  const [scope, setScope] = useState<Scope>("this");
  const [spec, setSpec] = useState("1");
  const [captionOn, setCaptionOn] = useState(false);
  const [caption, setCaption] = useState("");
  const [signed, setSigned] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const viewer = useRef<PageThumbnailer | null>(null);
  const [viewerReady, setViewerReady] = useState(0);
  const job = useJob<Uint8Array>();
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "size"; x: number; y: number; start: Place } | null>(null);

  // Page sizes and turns, and whether the file already carries a digital signature.
  useEffect(() => {
    let live = true;
    setGeometry(null);
    setSigned(false);
    setPage(0);
    setPlace(START);
    if (!source) return;
    readPageGeometry(source.bytes).then(
      (g) => live && setGeometry(g),
      () => undefined,
    );
    setSigned(looksDigitallySigned(source.bytes));
    return () => {
      live = false;
    };
  }, [source]);

  // One renderer per file, closed when the file changes.
  useEffect(() => {
    if (!source) return;
    let live = true;
    let made: PageThumbnailer | null = null;
    setPreviewFailed(false);
    createThumbnailer(source.file, 1000).then(
      (t) => {
        if (!live) return t.dispose();
        made = t;
        viewer.current = t;
        setViewerReady((n) => n + 1);
      },
      () => live && setPreviewFailed(true),
    );
    return () => {
      live = false;
      made?.dispose();
      viewer.current = null;
    };
  }, [source]);

  // The picture of the current page.
  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    let live = true;
    let url: string | null = null;
    v.render(page, 1000).then(
      (blob) => {
        url = URL.createObjectURL(blob);
        if (live) setPreviewUrl(url);
        else URL.revokeObjectURL(url);
      },
      () => live && setPreviewFailed(true),
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [page, viewerReady]);

  const g = geometry?.[page];
  const shown = g ? displaySize(g) : null;
  const heightFrac = signature && shown ? place.width * (signature.height / signature.width) * (shown.width / shown.height) : 0;

  const move = (patch: Partial<Place>) => {
    job.reset();
    setPlace((p) => {
      const width = clamp(patch.width ?? p.width, 0.05, 0.9);
      const hFrac = signature && shown ? width * (signature.height / signature.width) * (shown.width / shown.height) : 0.1;
      return { width, left: clamp(patch.left ?? p.left, 0, Math.max(0, 1 - width)), top: clamp(patch.top ?? p.top, 0, Math.max(0, 1 - hFrac)) };
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = stage.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.x) / rect.width;
    const dy = (e.clientY - d.y) / rect.height;
    if (d.mode === "move") move({ left: d.start.left + dx, top: d.start.top + dy });
    else move({ width: d.start.width + dx });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const keys: Record<string, Partial<Place> | undefined> = {
      ArrowLeft: { left: place.left - step },
      ArrowRight: { left: place.left + step },
      ArrowUp: { top: place.top - step },
      ArrowDown: { top: place.top + step },
      "+": { width: place.width + 0.02 },
      "=": { width: place.width + 0.02 },
      "-": { width: place.width - 0.02 },
    };
    const patch = keys[e.key];
    if (patch) {
      e.preventDefault();
      move(patch);
    }
  };

  const pageCount = source?.info.pageCount ?? 0;
  const targets = useMemo(() => {
    try {
      if (scope === "all") return { pages: Array.from({ length: pageCount }, (_, i) => i) };
      if (scope === "last") return { pages: [pageCount - 1] };
      if (scope === "pick") return { pages: pagesFromSpec(spec, pageCount) };
      return { pages: [page] };
    } catch (err) {
      return { pages: [] as number[], error: err instanceof Error ? err.message : "Check the page list." };
    }
  }, [scope, spec, page, pageCount]);

  const run = () => {
    if (!source || !signature || !geometry) return;
    job.run(() =>
      signPdf(source.bytes, {
        image: signature.png,
        caption: captionOn && caption.trim() ? caption.trim() : undefined,
        placements: targets.pages.map((p) => {
          const size = displaySize(geometry[p] as PageGeometry);
          return { page: p, left: place.left * size.width, top: place.top * size.height, width: place.width * size.width };
        }),
      }),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {source ? <PdfSourceCard source={source} onRemove={() => (pdf.clear(), job.reset())} /> : <PdfDrop onFile={pdf.load} onReject={pdf.setError} loading={pdf.loading} />}
      <JobError error={pdf.error} />

      {source ? (
        <>
          <section aria-labelledby="sign-step-1" className="flex flex-col gap-3">
            <h3 id="sign-step-1" className="font-display text-[17px] font-bold">
              1. Make your signature
            </h3>
            <SignatureMaker
              onChange={(s) => {
                job.reset();
                setSignature(s);
              }}
            />
          </section>

          <section aria-labelledby="sign-step-2" className="flex flex-col gap-3">
            <h3 id="sign-step-2" className="font-display text-[17px] font-bold">
              2. Place it on the page
            </h3>
            {!signature ? <p className="text-sm text-muted-foreground">Make a signature above, then drag it into position here.</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <span className="font-mono text-sm" aria-live="polite">
                Page {page + 1} of {pageCount}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>

            <div className="flex justify-center border border-border bg-muted p-3">
              <div
                ref={stage}
                className="relative w-full max-w-[34rem] select-none bg-card shadow-md"
                style={{ aspectRatio: shown ? `${shown.width} / ${shown.height}` : "612 / 792" }}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab
                  <img src={previewUrl} alt={`Page ${page + 1} of the PDF`} className="absolute inset-0 size-full" draggable={false} />
                ) : (
                  <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{previewFailed ? "The page could not be drawn, but you can still place the signature by number below." : "Drawing the page…"}</p>
                )}
                {signature && shown ? (
                  <div
                    tabIndex={0}
                    role="group"
                    aria-label="Signature. Drag to move it, use the arrow keys to nudge it, and plus and minus to resize it."
                    data-testid="signature-box"
                    onKeyDown={onKey}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = { mode: "move", x: e.clientX, y: e.clientY, start: place };
                    }}
                    className="absolute cursor-move touch-none border border-dashed border-primary outline-offset-2 focus-visible:outline-3 focus-visible:outline-ring"
                    style={{ left: `${place.left * 100}%`, top: `${place.top * 100}%`, width: `${place.width * 100}%`, height: `${heightFrac * 100}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL made in this tab */}
                    <img src={signature.url} alt="" className="pointer-events-none size-full" draggable={false} />
                    <button
                      type="button"
                      aria-label="Resize signature"
                      tabIndex={-1}
                      className="absolute -bottom-2 -right-2 size-4 cursor-nwse-resize touch-none border border-foreground bg-marker"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        drag.current = { mode: "size", x: e.clientX, y: e.clientY, start: place };
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section aria-labelledby="sign-step-3" className="flex flex-col gap-3">
            <h3 id="sign-step-3" className="font-display text-[17px] font-bold">
              3. Choose the pages and sign
            </h3>
            <div className="flex flex-col gap-4 border border-border bg-card p-4">
              <SegmentedControl
                label="Sign"
                value={scope}
                onValueChange={(s) => (setScope(s), job.reset())}
                options={[
                  { value: "this", label: "This page" },
                  { value: "last", label: "Last page" },
                  { value: "all", label: "Every page" },
                  { value: "pick", label: "Choose pages" },
                ]}
              />
              {scope === "pick" ? <Field label="Pages" hint={`For example 1, 3-5. This PDF has ${pageCount} pages.`}>{(id) => <Input id={id} mono value={spec} onChange={(e) => (setSpec(e.target.value), job.reset())} />}</Field> : null}
              <Toggle
                label="Print a line of text under the signature, such as the date"
                checked={captionOn}
                onCheckedChange={(on) => {
                  setCaptionOn(on);
                  if (on && !caption) setCaption(todayText());
                  job.reset();
                }}
              />
              {captionOn ? <Field label="Text under the signature">{(id) => <Input id={id} value={caption} maxLength={80} onChange={(e) => (setCaption(e.target.value), job.reset())} />}</Field> : null}
            </div>

            {signed ? <Alert tone="warning">This PDF looks digitally signed. Adding a signature picture changes the file, so the existing digital signature will no longer be valid.</Alert> : null}
            {"error" in targets && targets.error ? <Alert tone="error">{targets.error}</Alert> : null}
            <Alert tone="info" title="A picture of a signature, not a digital signature">
              This puts an image of your signature on the page, like signing a printout. It does not add a certificate or prove who signed, and anyone with the file can copy the picture. Use it where a visible signature is enough; use a certified e-signature service where the law or the other party requires one.
            </Alert>

            <RunButton busy={job.busy} disabled={!signature || !geometry || targets.pages.length === 0} onClick={run}>
              Sign {targets.pages.length > 1 ? `${targets.pages.length} pages` : "PDF"}
            </RunButton>
          </section>
        </>
      ) : null}

      <JobError error={job.error} />
      {job.result && source ? <DownloadResult data={job.result} filename={`${baseName(source.file.name)}-signed.pdf`} note={`${targets.pages.length} page${targets.pages.length === 1 ? "" : "s"} signed`} /> : null}
    </div>
  );
}
