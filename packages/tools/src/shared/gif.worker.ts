/// <reference lib="webworker" />
/**
 * Reads, edits and writes animated GIFs off the main thread. Decoding and quantizing hundreds of frames are long
 * synchronous calls that would freeze the tab, and a worker can be terminated instantly when the user cancels.
 * The file's bytes arrive once and are never sent anywhere else.
 */
import {
  boomerangFrames,
  changeSpeed,
  checkGifBudget,
  decodeGif,
  dropFrames,
  encodeGif,
  fitRgba,
  flipGif,
  heightForWidth,
  resizeGif,
  reverseFrames,
  rotateGif,
  setDelay,
  totalDuration,
  trimFrames,
  type EncodeOptions,
  type GifImage,
} from "@toolwright/core/gif-tools";

export interface GifInfo {
  width: number;
  height: number;
  frames: number;
  loop: number;
  durationMs: number;
}

export interface EditSettings {
  /** Frames to keep, counted from 1 and including both ends. */
  from: number;
  to: number;
  /** Keep one frame in every n. 1 keeps all. */
  keepEvery: number;
  order: "normal" | "reverse" | "boomerang";
  /** Playing speed. 1 leaves the timing alone. */
  speed: number;
  /** When set, every frame gets this delay (ms) instead. */
  fixedDelayMs: number | null;
  rotate: 0 | 90 | 180 | 270;
  flip: "none" | "horizontal" | "vertical";
  /** New width in pixels, or null to keep the size. */
  width: number | null;
  loop: number;
  maxColors: number;
  optimize: boolean;
}

export interface MakeSettings {
  pictures: { width: number; height: number; pixels: ArrayBuffer }[];
  width: number;
  height: number;
  fit: "contain" | "cover" | "stretch";
  background: [number, number, number, number];
  delayMs: number;
  loop: number;
  maxColors: number;
  optimize: boolean;
}

export type GifRequest =
  | { type: "load"; id: number; bytes: Uint8Array }
  | { type: "edit"; id: number; settings: EditSettings }
  | { type: "frames"; id: number }
  | { type: "make"; id: number; settings: MakeSettings };

export type GifReply =
  | { type: "loaded"; id: number; info: GifInfo }
  | { type: "progress"; id: number; done: number; total: number }
  | { type: "result"; id: number; bytes: Uint8Array; info: GifInfo }
  | { type: "frames"; id: number; width: number; height: number; frames: { pixels: ArrayBuffer; delayMs: number }[] }
  | { type: "error"; id: number; message: string };

const scope = self as unknown as { postMessage(message: GifReply, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<GifRequest>) => void) | null };
let loaded: GifImage | null = null;

const infoOf = (image: GifImage): GifInfo => ({ width: image.width, height: image.height, frames: image.frames.length, loop: image.loop, durationMs: totalDuration(image.frames) });

function encodeWithProgress(image: GifImage, id: number, options: EncodeOptions): Uint8Array {
  const budget = checkGifBudget(image.width, image.height, image.frames.length);
  if (budget) throw new Error(budget);
  return encodeGif(image, { ...options, onProgress: (done, total) => scope.postMessage({ type: "progress", id, done, total }) });
}

function applyEdits(source: GifImage, s: EditSettings): GifImage {
  let frames = trimFrames(source.frames, s.from, s.to);
  if (s.keepEvery > 1) frames = dropFrames(frames, s.keepEvery);
  if (s.order === "reverse") frames = reverseFrames(frames);
  else if (s.order === "boomerang") frames = boomerangFrames(frames);
  if (s.fixedDelayMs !== null) frames = setDelay(frames, s.fixedDelayMs);
  else if (s.speed !== 1) frames = changeSpeed(frames, s.speed);
  let image: GifImage = { ...source, frames, loop: s.loop };
  if (s.rotate !== 0) image = rotateGif(image, s.rotate);
  if (s.flip !== "none") image = flipGif(image, s.flip);
  if (s.width !== null && s.width !== image.width) image = resizeGif(image, s.width, heightForWidth(image.width, image.height, s.width));
  return image;
}

scope.onmessage = (event) => {
  const request = event.data;
  try {
    switch (request.type) {
      case "load": {
        loaded = decodeGif(request.bytes);
        scope.postMessage({ type: "loaded", id: request.id, info: infoOf(loaded) });
        break;
      }
      case "edit": {
        if (!loaded) throw new Error("Load a GIF first.");
        const s = request.settings;
        const image = applyEdits(loaded, s);
        const bytes = encodeWithProgress(image, request.id, { maxColors: s.maxColors, optimize: s.optimize });
        scope.postMessage({ type: "result", id: request.id, bytes, info: infoOf(image) }, [bytes.buffer as ArrayBuffer]);
        break;
      }
      case "frames": {
        if (!loaded) throw new Error("Load a GIF first.");
        const frames = loaded.frames.map((f) => ({ pixels: f.rgba.slice().buffer as ArrayBuffer, delayMs: f.delayMs }));
        scope.postMessage({ type: "frames", id: request.id, width: loaded.width, height: loaded.height, frames }, frames.map((f) => f.pixels));
        break;
      }
      case "make": {
        const s = request.settings;
        if (s.pictures.length === 0) throw new Error("Add at least one picture.");
        const frames = s.pictures.map((p) => ({ rgba: fitRgba(new Uint8ClampedArray(p.pixels), p.width, p.height, s.width, s.height, s.fit, s.background), delayMs: s.delayMs }));
        const image: GifImage = { width: s.width, height: s.height, frames, loop: s.loop };
        const bytes = encodeWithProgress(image, request.id, { maxColors: s.maxColors, optimize: s.optimize });
        scope.postMessage({ type: "result", id: request.id, bytes, info: infoOf(image) }, [bytes.buffer as ArrayBuffer]);
        break;
      }
    }
  } catch (err) {
    scope.postMessage({ type: "error", id: request.id, message: err instanceof Error ? err.message : "Something went wrong with this GIF." });
  }
};
