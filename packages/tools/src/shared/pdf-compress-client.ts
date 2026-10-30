import type { CompressProgress, CompressResult, CompressSettings, PdfAnalysis } from "@toolwright/core/pdf-compress";
import type { WorkerReply, WorkerRequest } from "./pdf-compress.worker";

export class CompressAborted extends Error {
  constructor() {
    super("Compression was cancelled.");
    this.name = "CompressAborted";
  }
}

export interface CompressTask<T> {
  promise: Promise<T>;
  /** Stops the work at once and frees the worker's memory. */
  cancel(): void;
}

/**
 * One worker for one PDF. The file's bytes are read once and moved into the worker, so the tab never holds
 * two copies. After `cancel()` the worker is gone; the next call starts a fresh one and reads the file again.
 */
export class CompressSession {
  private worker: Worker | null = null;
  private nextId = 1;
  private abort: (() => void) | null = null;

  constructor(private readonly file: File) {}

  private async start(): Promise<Worker> {
    if (this.worker) return this.worker;
    const bytes = new Uint8Array(await this.file.arrayBuffer());
    const worker = new Worker(new URL("./pdf-compress.worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;
    worker.postMessage({ type: "load", bytes } satisfies WorkerRequest, [bytes.buffer]);
    return worker;
  }

  private run<T>(build: (id: number) => WorkerRequest, pick: (reply: WorkerReply) => T | undefined, onProgress?: (p: CompressProgress) => void): CompressTask<T> {
    let settle: { resolve(value: T): void; reject(reason: unknown): void } | null = null;
    let cancelled = false;
    const promise = new Promise<T>((resolve, reject) => {
      settle = { resolve, reject };
    });
    const finish = () => {
      if (this.abort === cancel) this.abort = null;
    };
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      this.worker?.terminate();
      this.worker = null;
      finish();
      settle?.reject(new CompressAborted());
    };
    this.abort = cancel;

    this.start().then(
      (worker) => {
        if (cancelled) return;
        const id = this.nextId++;
        worker.onmessage = (event: MessageEvent<WorkerReply>) => {
          const reply = event.data;
          if (reply.id !== id) return;
          if (reply.type === "progress") return onProgress?.({ done: reply.done, total: reply.total });
          finish();
          if (reply.type === "error") return settle?.reject(new Error(reply.message));
          const value = pick(reply);
          if (value !== undefined) settle?.resolve(value);
        };
        worker.onerror = () => {
          finish();
          this.worker = null;
          settle?.reject(new Error("Compression could not start in this browser. Try Smallest file instead."));
        };
        worker.postMessage(build(id));
      },
      (err) => {
        finish();
        settle?.reject(err);
      },
    );
    return { promise, cancel };
  }

  analyze(): CompressTask<PdfAnalysis> {
    return this.run(
      (id) => ({ type: "analyze", id }),
      (reply) => (reply.type === "analysis" ? reply.analysis : undefined),
    );
  }

  compress(settings: CompressSettings, onProgress?: (p: CompressProgress) => void): CompressTask<CompressResult> {
    return this.run(
      (id) => ({ type: "compress", id, settings }),
      (reply) => (reply.type === "result" ? reply.result : undefined),
      onProgress,
    );
  }

  /** Stops whatever is running, if anything, and releases the worker. */
  dispose() {
    this.abort?.();
    this.worker?.terminate();
    this.worker = null;
  }
}
