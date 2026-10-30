/** Canvas drawing for the Crop, Rotate & Flip tool. The maths lives in `@toolwright/core/image-crop`; this file only draws. */

import { cropMatrix, turnMatrix, turnedSize, type Rect, type Turn } from "@toolwright/core/image-crop";
import type { LoadedImage, OutputFormat, RenderedImage } from "./image";

/** Draws the turned picture (flipped, turned, straightened) into `canvas`, at most `maxSide` pixels on its longer side. Returns the scale used. */
export function drawTurned(canvas: HTMLCanvasElement, image: LoadedImage, turn: Turn, maxSide = 1200): number {
  const size = { width: image.width, height: image.height };
  const turned = turnedSize(size, turn);
  const scale = Math.min(1, maxSide / Math.max(turned.width, turned.height));
  canvas.width = Math.max(1, Math.round(turned.width * scale));
  canvas.height = Math.max(1, Math.round(turned.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support canvas, which this tool needs.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const m = cropMatrix(turnMatrix(size, turn), { x: 0, y: 0, width: turned.width, height: turned.height }, scale);
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(image.source, 0, 0);
  return scale;
}

export interface CropRenderOptions {
  type: OutputFormat;
  /** 0 to 1, for JPEG, WebP and AVIF. */
  quality: number;
  /** Colour behind transparent or empty areas. Always used for JPEG, which has no transparency. */
  background: string | null;
}

/** Cuts `crop` out of the turned picture at full size and encodes it. */
export async function renderCropped(image: LoadedImage, turn: Turn, crop: Rect, options: CropRenderOptions): Promise<RenderedImage> {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support canvas, which this tool needs.");
  const background = options.background ?? (options.type === "image/jpeg" ? "#ffffff" : null);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, crop.width, crop.height);
  }
  const m = cropMatrix(turnMatrix({ width: image.width, height: image.height }, turn), crop);
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(image.source, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.type, options.quality));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error("The picture could not be saved. It may be too large for this browser.");
  return { blob, width: crop.width, height: crop.height, fellBack: blob.type !== options.type };
}
