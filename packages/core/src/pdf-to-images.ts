/**
 * Planning for PDF to Images: which pages, how big, what to call the files, and when to stop. The drawing itself
 * is done by PDF.js in the browser (`packages/tools/src/shared/pdf-raster.ts`). Keep this file free of React, the DOM and the network.
 */

import { PdfError, parsePageRanges } from "./pdf";
import { planRaster, type RasterPlan } from "./pdf-compress";

export type PageImageFormat = "png" | "jpeg" | "webp";

export const PAGE_IMAGE_FORMATS: { id: PageImageFormat; label: string; mime: string; extension: string; lossy: boolean }[] = [
  { id: "png", label: "PNG (sharp, larger)", mime: "image/png", extension: "png", lossy: false },
  { id: "jpeg", label: "JPG (smaller)", mime: "image/jpeg", extension: "jpg", lossy: true },
  { id: "webp", label: "WebP (smallest)", mime: "image/webp", extension: "webp", lossy: true },
];

export function formatInfo(id: PageImageFormat) {
  const found = PAGE_IMAGE_FORMATS.find((f) => f.id === id);
  if (!found) throw new PdfError(`Unknown picture format "${String(id)}".`);
  return found;
}

export const DPI_CHOICES = [72, 96, 150, 200, 300] as const;

const MB = 1024 * 1024;

/** Starting values. Real memory use depends on the device, so these are conservative and meant to be tuned. */
export const PAGE_IMAGE_LIMITS = {
  maxFileBytes: 200 * MB,
  /** Pages drawn in one run. */
  maxPages: 500,
  warnPages: 100,
  /** A page is drawn at a lower resolution than asked if it would pass this many pixels (the iOS Safari canvas ceiling is about 16.7 million). */
  maxPagePixels: 16_000_000,
  /** The run stops, keeping what is finished, when the pictures together pass this many bytes. */
  maxTotalBytes: 400 * MB,
} as const;

export const QUALITY_CHOICES = { min: 40, max: 100, default: 90 } as const;

/**
 * Turns "1-3, 5, last" (or nothing) into sorted, unique, zero-based page numbers. An empty text means every page.
 * Unlike the page tools that reorder, pictures come out in page order, so repeats and backwards ranges are tidied.
 */
export function selectPages(spec: string, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new PdfError("This PDF has no pages.");
  const all = Array.from({ length: pageCount }, (_, i) => i);
  if (spec.trim() === "") return all;
  const chosen = [...new Set(parsePageRanges(spec, pageCount))].sort((a, b) => a - b);
  return chosen;
}

export interface LimitCheck {
  /** Set when the run must not start. */
  refuse?: string;
  /** Set when it can run but may be slow or large. */
  warn?: string;
}

export function checkRun(fileBytes: number, selectedPages: number): LimitCheck {
  if (fileBytes > PAGE_IMAGE_LIMITS.maxFileBytes) {
    return { refuse: `This file is ${Math.round(fileBytes / MB)} MB. The limit here is ${PAGE_IMAGE_LIMITS.maxFileBytes / MB} MB so a normal browser tab does not run out of memory.` };
  }
  if (selectedPages < 1) return { refuse: "No pages are selected." };
  if (selectedPages > PAGE_IMAGE_LIMITS.maxPages) {
    return { refuse: `${selectedPages} pages are selected. At most ${PAGE_IMAGE_LIMITS.maxPages} can be drawn in one run; pick a page range.` };
  }
  if (selectedPages > PAGE_IMAGE_LIMITS.warnPages) return { warn: `${selectedPages} pages is a lot. It can take a few minutes and a lot of memory; choose a lower resolution or fewer pages if the tab slows down.` };
  return {};
}

/** How large to draw one page: `view` is the page's visible box `[x0, y0, x1, y1]` in points and `rotate` its own rotation. */
export function planPageImage(view: readonly [number, number, number, number], rotate: number, dpi: number): RasterPlan {
  if (!Number.isFinite(dpi) || dpi < 36 || dpi > 1200) throw new PdfError("Resolution must be between 36 and 1200 DPI.");
  return planRaster(view, rotate, dpi, PAGE_IMAGE_LIMITS.maxPagePixels);
}

/** `report-page-007.png`: padded so the files sort in page order, with at least three digits. */
export function pageImageName(baseName: string, pageIndex: number, pageCount: number, extension: string): string {
  const digits = Math.max(3, String(Math.max(1, pageCount)).length);
  const clean = safeBaseName(baseName);
  return `${clean}-page-${String(pageIndex + 1).padStart(digits, "0")}.${extension}`;
}

export function zipFileName(baseName: string): string {
  return `${safeBaseName(baseName)}-pages.zip`;
}

/** A file name without its extension and without characters that break paths or zip entries. */
export function safeBaseName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");
  return stem.slice(0, 80) || "document";
}

/** True once the finished pictures together are too big to keep in memory. */
export function overBudget(totalBytes: number): boolean {
  return totalBytes > PAGE_IMAGE_LIMITS.maxTotalBytes;
}

/** Thrown when the person stops a run. The tool treats it as "nothing went wrong". */
export class PdfCancelled extends Error {
  constructor() {
    super("Stopped.");
    this.name = "PdfCancelled";
  }
}

export function normalizeQuality(quality: number): number {
  if (!Number.isFinite(quality)) return QUALITY_CHOICES.default / 100;
  return Math.min(QUALITY_CHOICES.max, Math.max(QUALITY_CHOICES.min, Math.round(quality))) / 100;
}
