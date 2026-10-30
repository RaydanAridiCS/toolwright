/** Browser-side image helpers built on canvas. Nothing here touches the network. */

import { squareLayout, type IconFit } from "@toolwright/core/favicon-generator";

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export const FORMAT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Release decoded resources when done. */
  dispose: () => void;
}

/** Decode an image file, honouring EXIF orientation. */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch {
      // fall back to <img> for formats createImageBitmap rejects (e.g. SVG in some browsers)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("This image could not be read. It may be corrupted or in an unsupported format."));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export interface RenderOptions {
  width: number;
  height: number;
  type: OutputFormat;
  /** 0–1, used for JPEG, WebP and AVIF. */
  quality?: number;
  /** Fill colour behind transparent pixels. Always applied for JPEG. */
  background?: string | null;
}

export interface RenderedImage {
  blob: Blob;
  width: number;
  height: number;
  /** The browser could not encode the requested format and used another one. */
  fellBack: boolean;
}

export async function renderImage(image: LoadedImage, options: RenderOptions): Promise<RenderedImage> {
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support canvas, which this tool needs.");
  const background = options.background ?? (options.type === "image/jpeg" ? "#ffffff" : null);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image.source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.type, options.quality));
  if (!blob) throw new Error("The image could not be encoded. It may be too large for this browser.");
  canvas.width = canvas.height = 0; // free memory early
  return { blob, width, height, fellBack: blob.type !== options.type };
}

export interface FitOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** Never enlarge beyond the original. */
  noUpscale?: boolean;
}

/** Scale (width, height) to fit within the maximums, preserving aspect ratio. */
export function fitWithin(width: number, height: number, { maxWidth, maxHeight, noUpscale = true }: FitOptions): { width: number; height: number } {
  let scale = Infinity;
  if (maxWidth && maxWidth > 0) scale = Math.min(scale, maxWidth / width);
  if (maxHeight && maxHeight > 0) scale = Math.min(scale, maxHeight / height);
  if (!Number.isFinite(scale)) return { width, height };
  if (noUpscale) scale = Math.min(scale, 1);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function outputName(original: string, mime: string, suffix = ""): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `${base}${suffix}.${FORMAT_EXTENSIONS[mime] ?? "img"}`;
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(blob);
  });
}

export interface SquareIconOptions {
  fit: IconFit;
  /** Empty space kept on every side, as a percentage of the icon size. */
  padding: number;
  /** Fill colour behind the image. Leave null to keep transparency. */
  background?: string | null;
}

/** Draw an image onto a square PNG of the given size. */
export async function renderSquareIcon(image: LoadedImage, size: number, options: SquareIconOptions): Promise<Uint8Array> {
  const layout = squareLayout(image.width, image.height, size, options.fit, options.padding);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support canvas, which this tool needs.");
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.clip.x, layout.clip.y, layout.clip.size, layout.clip.size);
  ctx.clip();
  ctx.drawImage(image.source, layout.x, layout.y, layout.width, layout.height);
  ctx.restore();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = canvas.height = 0; // free memory early
  if (!blob) throw new Error("The icon could not be encoded. Try a smaller source image.");
  return blobToBytes(blob);
}
