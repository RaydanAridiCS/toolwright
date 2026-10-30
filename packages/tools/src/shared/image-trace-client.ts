import { MAX_TRACE_PIXELS } from "@toolwright/core/image-trace-limits";
import type { TraceOptions, TraceResult } from "@toolwright/core/image-trace";
import type { TraceReply, TraceRequest } from "./image-trace.worker";

export class TraceAborted extends Error {
  constructor() {
    super("Tracing was cancelled.");
    this.name = "TraceAborted";
  }
}

export interface DecodedPicture {
  width: number;
  height: number;
  pixels: ArrayBuffer;
  /** Set when the picture was made smaller to fit the tracing limit: its original size. */
  shrunkFrom?: { width: number; height: number };
}

/** Read a picture file into pixels, shrinking it if it is above the tracing limit. Needs the browser. */
export async function decodePicture(file: File): Promise<DecodedPicture> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This picture could not be read. Use a PNG, JPG, WebP, GIF or BMP file.");
  }
  try {
    const shrink = Math.min(1, Math.sqrt(MAX_TRACE_PIXELS / (bitmap.width * bitmap.height)));
    const width = Math.max(1, Math.floor(bitmap.width * shrink));
    const height = Math.max(1, Math.floor(bitmap.height * shrink));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot read pictures.");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    return { width, height, pixels: data.buffer.slice(0) as ArrayBuffer, shrunkFrom: shrink < 1 ? { width: bitmap.width, height: bitmap.height } : undefined };
  } finally {
    bitmap.close();
  }
}

/** Trace in a worker. `cancel()` stops it at once. */
export function traceInWorker(picture: DecodedPicture, options: TraceOptions): { promise: Promise<TraceResult>; cancel(): void } {
  const worker = new Worker(new URL("./image-trace.worker.ts", import.meta.url), { type: "module" });
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<TraceResult>((res, rej) => {
    reject = rej;
    worker.onmessage = (event: MessageEvent<TraceReply>) => {
      worker.terminate();
      if (event.data.type === "result") res(event.data.result);
      else rej(new Error(event.data.message));
    };
    worker.onerror = () => {
      worker.terminate();
      rej(new Error("Tracing failed in this browser."));
    };
  });
  // The pixels are copied, so the same decoded picture can be traced again with other settings.
  const request: TraceRequest = { width: picture.width, height: picture.height, pixels: picture.pixels.slice(0), options };
  worker.postMessage(request, [request.pixels]);
  return {
    promise,
    cancel() {
      worker.terminate();
      reject(new TraceAborted());
    },
  };
}
