/**
 * "Smallest file": draws every page with PDF.js and rebuilds the PDF from JPEGs.
 *
 * This is the only file that may mention `pdfjs-dist` (a test enforces it), and PDF.js is imported only when a
 * run starts, so nothing from it reaches the shared bundles or the page chunk. The renderer, its worker, fonts
 * and character maps are all served from this site (see scripts/copy-pdfjs-assets.mjs); nothing is fetched elsewhere.
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

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The page could not be encoded."))), "image/jpeg", quality));
}

export async function rasterizePdf(file: File, settings: CompressSettings, options: RasterOptions = {}): Promise<RasterResult> {
  const { onProgress, signal } = options;
  const cancelled = () => signal?.aborted === true;
  if (cancelled()) throw new CompressCancelled();

  // Loaded here and nowhere else: this is what keeps ~1.7 MB of PDF.js out of everything that does not need it.
  // The minified build has no type declarations of its own; it exports the same API as the main entry.
  // @ts-expect-error TS7016: no declaration file for the .min.mjs build
  const pdfjs: typeof import("pdfjs-dist") = await import("pdfjs-dist/build/pdf.min.mjs");
  if (cancelled()) throw new CompressCancelled();

  // The worker is a plain file served from this site, not bundled: the bundler rewrites worker entries into a
  // classic-script wrapper, and PDF.js's worker never completes its handshake inside that wrapper.
  const worker = new Worker(`${ASSETS}pdf.worker.min.mjs`, { type: "module" });
  const canvas = document.createElement("canvas");
  let loading: ReturnType<typeof pdfjs.getDocument> | null = null;
  let rendering: { cancel(): void } | null = null;
  const onAbort = () => rendering?.cancel();
  signal?.addEventListener("abort", onAbort);

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
        const blob = await toBlob(canvas, settings.quality / 100);
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
    await loading?.destroy().catch(() => undefined);
    worker.terminate();
  }
}
