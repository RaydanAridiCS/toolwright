/// <reference lib="webworker" />
/**
 * Runs the "Keep text" mode off the main thread. Parsing and saving a large PDF are long synchronous calls
 * that would freeze the tab, and a worker can be terminated instantly when the user cancels.
 * The bytes arrive once, are kept here, and are never sent anywhere else.
 */
import { analyzePdf, compressPdfImages, CompressCancelled, stripJpegExif, type CompressSettings, type PdfAnalysis, type Recompress } from "@toolwright/core/pdf-compress";

export type WorkerRequest =
  | { type: "load"; bytes: Uint8Array }
  | { type: "analyze"; id: number }
  | { type: "compress"; id: number; settings: CompressSettings };

export type WorkerReply =
  | { type: "analysis"; id: number; analysis: PdfAnalysis }
  | { type: "progress"; id: number; done: number; total: number }
  | { type: "result"; id: number; result: Awaited<ReturnType<typeof compressPdfImages>> }
  | { type: "error"; id: number; message: string; cancelled?: boolean };

const scope = self as unknown as { postMessage(message: WorkerReply, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null };
let bytes: Uint8Array | null = null;

/** Decodes a JPEG, scales it to the target size and encodes it again. Null means "leave this image alone". */
const recompress: Recompress = async (job) => {
  let bitmap: ImageBitmap | null = null;
  try {
    // A PDF ignores the EXIF orientation tag, but browsers apply it when decoding (even with imageOrientation: "none"),
    // so the tag is cut out first. If the decoded size still differs from the PDF's, leave the image alone.
    bitmap = await createImageBitmap(new Blob([stripJpegExif(job.data) as BlobPart], { type: "image/jpeg" }), { imageOrientation: "none" });
    if (bitmap.width !== job.width || bitmap.height !== job.height) return null;
    const canvas = new OffscreenCanvas(job.targetWidth, job.targetHeight);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, job.targetWidth, job.targetHeight);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: job.quality });
    if (blob.type !== "image/jpeg") return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), width: job.targetWidth, height: job.targetHeight, components: 3 };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
};

const messageOf = (err: unknown) => (err instanceof Error && err.message ? err.message : "The PDF could not be processed.");

scope.onmessage = async (event) => {
  const request = event.data;
  if (request.type === "load") {
    bytes = request.bytes;
    return;
  }
  const { id } = request;
  try {
    if (!bytes) throw new Error("The PDF was not loaded.");
    if (request.type === "analyze") {
      scope.postMessage({ type: "analysis", id, analysis: await analyzePdf(bytes) });
    } else {
      const result = await compressPdfImages(bytes, request.settings, recompress, { onProgress: (p) => scope.postMessage({ type: "progress", id, ...p }) });
      scope.postMessage({ type: "result", id, result }, result.data ? [result.data.buffer as ArrayBuffer] : []);
    }
  } catch (err) {
    scope.postMessage({ type: "error", id, message: messageOf(err), cancelled: err instanceof CompressCancelled });
  }
};
