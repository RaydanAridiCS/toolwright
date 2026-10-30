/// <reference lib="webworker" />
/**
 * Runs SVGO off the main thread. A large SVG can take seconds to optimize, which would freeze the tab, and a worker can be
 * terminated instantly when the settings change. SVGO (about 800 KB) is only fetched when the first file arrives.
 */
import { optimizeSvg, type OptimizeOptions, type OptimizeResult } from "@toolwright/core/svg-optimize";

export interface OptimizeRequest {
  jobs: { id: number; source: string }[];
  options: OptimizeOptions;
}

export type OptimizeReply = { type: "item"; id: number; result: OptimizeResult } | { type: "failed"; id: number; message: string } | { type: "done" };

const scope = self as unknown as { postMessage(message: OptimizeReply): void; onmessage: ((event: MessageEvent<OptimizeRequest>) => void) | null };

scope.onmessage = (event) => {
  const { jobs, options } = event.data;
  for (const job of jobs) {
    try {
      scope.postMessage({ type: "item", id: job.id, result: optimizeSvg(job.source, options) });
    } catch (err) {
      scope.postMessage({ type: "failed", id: job.id, message: err instanceof Error ? err.message : "This file could not be optimized." });
    }
  }
  scope.postMessage({ type: "done" });
};
