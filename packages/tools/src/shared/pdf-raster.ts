/**
 * Draws PDF pages with PDF.js: for Compress PDF's "Smallest file" mode (rebuild a PDF from page pictures) and for the
 * page previews in the PDF Page Organizer.
 *
 * This is the only file that may mention `pdfjs-dist` (a test enforces it), and PDF.js is imported only when a
 * file is actually drawn, so nothing from it reaches the shared bundles or the page chunks. The renderer, its worker,
 * fonts and character maps are all served from this site (see scripts/copy-pdfjs-assets.mjs); nothing is fetched elsewhere.
 */
import { COMPRESS_LIMITS, CompressCancelled, createImagePdfBuilder, planRaster, type CompressProgress, type CompressSettings } from "@toolwright/core/pdf-compress";
import { PdfError } from "@toolwright/core/pdf";

export interface RasterResult {
  data: Uint8Array;
  pages: number;
  /** Pages drawn at a lower resolution than asked, to stay under the canvas size limit. */
  cappedPages: number;
}

export interface RasterOptions {
  onProgress?: (progress: CompressProgress) => void;
  signal?: AbortSignal;
}

const ASSETS = "/pdfjs/";

type Pdfjs = typeof import("pdfjs-dist");
type PdfDocument = Awaited<ReturnType<Pdfjs["getDocument"]>["promise"]>;

interface OpenPdf {
  pdfjs: Pdfjs;
  pdf: PdfDocument;
  /** Frees the document and stops PDF.js's worker. Safe to call more than once. */
  close(): Promise<void>;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The page could not be encoded."))), type, quality));
}

/** Loads PDF.js (once per page load, cached by the module system) and opens a file in a fresh worker. */
async function openPdf(file: File): Promise<OpenPdf> {
  if (typeof Worker === "undefined") throw new PdfError("This browser cannot draw pages.");
  // Loaded here and nowhere else: this is what keeps ~1.7 MB of PDF.js out of everything that does not need it.
  // The minified build has no type declarations of its own; it exports the same API as the main entry.
  // @ts-expect-error TS7016: no declaration file for the .min.mjs build
  const pdfjs: Pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");

  // The worker is a plain file served from this site, not bundled: the bundler rewrites worker entries into a
  // classic-script wrapper, and PDF.js's worker never completes its handshake inside that wrapper.
  const worker = new Worker(`${ASSETS}pdf.worker.min.mjs`, { type: "module" });
  let loading: ReturnType<Pdfjs["getDocument"]> | null = null;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await loading?.destroy().catch(() => undefined);
    worker.terminate();
  };

  try {
    const origin = window.location.origin;
    loading = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      // The declared type of `port` is too narrow; PDF.js accepts any Worker here.
      worker: new pdfjs.PDFWorker({ port: worker as never }),
      // The production Content Security Policy has no 'wasm-unsafe-eval', so the JavaScript decoders are used.
      useWasm: false,
      wasmUrl: `${origin}${ASSETS}wasm/`,
      cMapUrl: `${origin}${ASSETS}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${origin}${ASSETS}standard_fonts/`,
      enableXfa: false,
    });
    const pdf = await loading.promise.catch((err: unknown) => {
      const name = err instanceof Error ? err.name : "";
      if (name === "PasswordException") throw new PdfError("This PDF is password-protected. Remove the password first.");
      throw new PdfError("This PDF could not be read. It may be corrupted or not a PDF.");
    });
    return { pdfjs, pdf, close };
  } catch (err) {
    await close();
    throw err;
  }
}

export async function rasterizePdf(file: File, settings: CompressSettings, options: RasterOptions = {}): Promise<RasterResult> {
  const { onProgress, signal } = options;
  const cancelled = () => signal?.aborted === true;
  if (cancelled()) throw new CompressCancelled();

  const canvas = document.createElement("canvas");
  let rendering: { cancel(): void } | null = null;
  const onAbort = () => rendering?.cancel();
  signal?.addEventListener("abort", onAbort);
  let open: OpenPdf | null = null;

  try {
    open = await openPdf(file);
    const { pdfjs, pdf } = open;
    if (cancelled()) throw new CompressCancelled();

    if (pdf.numPages > COMPRESS_LIMITS.maxSmallestPages) {
      throw new PdfError(`This PDF has ${pdf.numPages} pages. Smallest file is limited to ${COMPRESS_LIMITS.maxSmallestPages}. Split the file first, or use Keep text.`);
    }

    const metadata = await pdf.getMetadata().catch(() => null);
    const info = (metadata?.info ?? {}) as { Title?: unknown; Author?: unknown };
    const builder = await createImagePdfBuilder();
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new PdfError("This browser cannot draw pages.");
    let cappedPages = 0;

    for (let number = 1; number <= pdf.numPages; number++) {
      if (cancelled()) throw new CompressCancelled();
      onProgress?.({ done: number - 1, total: pdf.numPages });
      try {
        const page = await pdf.getPage(number);
        const plan = planRaster(page.view as [number, number, number, number], page.rotate, settings.maxDpi);
        if (plan.capped) cappedPages++;
        const viewport = page.getViewport({ scale: plan.scale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        // JPEG has no transparency: paint paper first, or empty areas would turn black.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const task = page.render({ canvas, canvasContext: context, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE });
        rendering = task;
        await task.promise;
        rendering = null;
        const blob = await toBlob(canvas, "image/jpeg", settings.quality / 100);
        await builder.addPage(new Uint8Array(await blob.arrayBuffer()), plan.widthPt, plan.heightPt);
        page.cleanup();
      } catch (err) {
        if (cancelled()) throw new CompressCancelled();
        if (err instanceof PdfError) throw err;
        throw new PdfError(`Page ${number} could not be drawn. Your original file is untouched.`);
      }
    }
    onProgress?.({ done: pdf.numPages, total: pdf.numPages });
    const data = await builder.finish({ title: typeof info.Title === "string" ? info.Title : undefined, author: typeof info.Author === "string" ? info.Author : undefined });
    return { data, pages: pdf.numPages, cappedPages };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    canvas.width = canvas.height = 0;
    await open?.close();
  }
}

export interface PageThumbnailer {
  pageCount: number;
  /** Draws one page (zero-based) as a JPEG with its longer side `maxSide` pixels (default: the size given to `createThumbnailer`), turned the way the PDF itself says. Draws happen one at a time. */
  render(pageIndex: number, maxSide?: number): Promise<Blob>;
  dispose(): void;
}

/** Opens a PDF for previews. `maxSide` is the longer side of each thumbnail in pixels. */
export async function createThumbnailer(file: File, maxSide = 160): Promise<PageThumbnailer> {
  const open = await openPdf(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    await open.close();
    throw new PdfError("This browser cannot draw pages.");
  }
  let queue: Promise<unknown> = Promise.resolve();
  let disposed = false;

  return {
    pageCount: open.pdf.numPages,
    render(pageIndex, size = maxSide) {
      const job = queue.then(async () => {
        if (disposed) throw new Error("The previews were closed.");
        const page = await open.pdf.getPage(pageIndex + 1);
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: size / Math.max(natural.width, natural.height) });
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport, annotationMode: open.pdfjs.AnnotationMode.ENABLE }).promise;
        const blob = await toBlob(canvas, "image/jpeg", size > 400 ? 0.9 : 0.8);
        page.cleanup();
        return blob;
      });
      queue = job.catch(() => undefined);
      return job;
    },
    dispose() {
      disposed = true;
      canvas.width = canvas.height = 0;
      void open.close();
    },
  };
}
