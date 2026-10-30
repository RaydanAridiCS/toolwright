import type { EditSettings, GifInfo, GifReply, GifRequest, MakeSettings } from "./gif.worker";

export type { EditSettings, GifInfo, MakeSettings };

export class GifAborted extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "GifAborted";
  }
}

/**
 * One worker, used for one GIF at a time. `cancel()` ends it at once and frees its memory; the next call starts a fresh
 * worker. Every request has an id, and only the newest request's answer is delivered.
 */
export class GifSession {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending: { id: number; resolve(reply: GifReply): void; reject(reason: unknown): void; onProgress?: (done: number, total: number) => void } | null = null;
  private loadedBytes: Uint8Array | null = null;

  private start(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./gif.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<GifReply>) => {
      const reply = event.data;
      const p = this.pending;
      if (!p || p.id !== reply.id) return;
      if (reply.type === "progress") return p.onProgress?.(reply.done, reply.total);
      this.pending = null;
      if (reply.type === "error") p.reject(new Error(reply.message));
      else p.resolve(reply);
    };
    worker.onerror = () => {
      const p = this.pending;
      this.pending = null;
      p?.reject(new Error("The GIF tools failed in this browser."));
    };
    this.worker = worker;
    return worker;
  }

  private send(build: (id: number) => GifRequest, transfer: Transferable[], onProgress?: (done: number, total: number) => void): Promise<GifReply> {
    // A new request replaces an older one that is still running.
    this.pending?.reject(new GifAborted());
    const worker = this.start();
    const id = this.nextId++;
    return new Promise<GifReply>((resolve, reject) => {
      this.pending = { id, resolve, reject, onProgress };
      worker.postMessage(build(id), transfer);
    });
  }

  /** Read a GIF. The bytes are kept so that a cancelled worker can be started again. */
  async load(file: File): Promise<GifInfo> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    this.loadedBytes = bytes;
    const copy = bytes.slice();
    const reply = await this.send((id) => ({ type: "load", id, bytes: copy }), [copy.buffer]);
    if (reply.type !== "loaded") throw new Error("Unexpected reply.");
    return reply.info;
  }

  async edit(settings: EditSettings, onProgress?: (done: number, total: number) => void): Promise<{ bytes: Uint8Array; info: GifInfo }> {
    const reply = await this.send((id) => ({ type: "edit", id, settings }), [], onProgress);
    if (reply.type !== "result") throw new Error("Unexpected reply.");
    return { bytes: reply.bytes, info: reply.info };
  }

  async frames(): Promise<{ width: number; height: number; frames: { pixels: ArrayBuffer; delayMs: number }[] }> {
    const reply = await this.send((id) => ({ type: "frames", id }), []);
    if (reply.type !== "frames") throw new Error("Unexpected reply.");
    return reply;
  }

  async make(settings: MakeSettings, onProgress?: (done: number, total: number) => void): Promise<{ bytes: Uint8Array; info: GifInfo }> {
    // The pixels are copied, so the pictures stay usable here for the next try.
    const copy: MakeSettings = { ...settings, pictures: settings.pictures.map((p) => ({ ...p, pixels: p.pixels.slice(0) })) };
    const reply = await this.send((id) => ({ type: "make", id, settings: copy }), copy.pictures.map((p) => p.pixels), onProgress);
    if (reply.type !== "result") throw new Error("Unexpected reply.");
    return { bytes: reply.bytes, info: reply.info };
  }

  /** Stop at once. The loaded GIF is read again the next time it is needed. */
  async cancel(): Promise<void> {
    this.worker?.terminate();
    this.worker = null;
    this.pending?.reject(new GifAborted());
    this.pending = null;
    if (this.loadedBytes) {
      const copy = this.loadedBytes.slice();
      await this.send((id) => ({ type: "load", id, bytes: copy }), [copy.buffer]).catch(() => {});
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending = null;
    this.loadedBytes = null;
  }
}
