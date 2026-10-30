/// <reference lib="webworker" />
/**
 * Traces a picture into SVG off the main thread. Tracing a large picture can take several seconds, and a worker can be
 * terminated instantly when the user cancels. The pixels are moved in once and are never sent anywhere else.
 */
import { traceImage, type TraceOptions, type TraceResult } from "@toolwright/core/image-trace";

export interface TraceRequest {
  width: number;
  height: number;
  pixels: ArrayBuffer;
  options: TraceOptions;
}

export type TraceReply = { type: "result"; result: TraceResult } | { type: "error"; message: string };

const scope = self as unknown as { postMessage(message: TraceReply): void; onmessage: ((event: MessageEvent<TraceRequest>) => void) | null };

scope.onmessage = (event) => {
  const { width, height, pixels, options } = event.data;
  try {
    scope.postMessage({ type: "result", result: traceImage({ width, height, data: new Uint8ClampedArray(pixels) }, options) });
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : "The picture could not be traced." });
  }
};
