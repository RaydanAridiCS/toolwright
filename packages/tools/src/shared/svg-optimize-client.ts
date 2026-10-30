import type { OptimizeOptions, OptimizeResult } from "@toolwright/core/svg-optimize";
import type { OptimizeReply, OptimizeRequest } from "./svg-optimize.worker";

export type OptimizeOutcome = { result: OptimizeResult } | { error: string };

/**
 * Optimize several SVGs in a worker. `onItem` is called as each one finishes. `cancel()` ends the worker at once, so changing a
 * setting never leaves an old run going.
 */
export function optimizeInWorker(jobs: { id: number; source: string }[], options: OptimizeOptions, onItem: (id: number, outcome: OptimizeOutcome) => void): { done: Promise<void>; cancel(): void } {
  const worker = new Worker(new URL("./svg-optimize.worker.ts", import.meta.url), { type: "module" });
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    worker.onmessage = (event: MessageEvent<OptimizeReply>) => {
      const reply = event.data;
      if (reply.type === "item") onItem(reply.id, { result: reply.result });
      else if (reply.type === "failed") onItem(reply.id, { error: reply.message });
      else {
        worker.terminate();
        resolve();
      }
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("The optimizer failed in this browser."));
    };
  });
  worker.postMessage({ jobs, options } satisfies OptimizeRequest);
  return {
    done,
    cancel() {
      worker.terminate();
      finish();
    },
  };
}
