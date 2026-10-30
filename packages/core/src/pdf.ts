/** PDF manipulation with pdf-lib. Everything operates on in-memory bytes; nothing is uploaded. */

import { degrees, PDFDict, PDFDocument, PDFName, rgb, StandardFonts } from "pdf-lib";

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfError";
  }
}

async function load(bytes: Uint8Array, label = "PDF"): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/encrypted/i.test(message)) throw new PdfError(`${label} is password-protected. Remove the password first.`);
    throw new PdfError(`${label} could not be read. It may be corrupted or not a PDF.`);
  }
}

export const isPdf = (bytes: Uint8Array) => bytes.length > 4 && String.fromCharCode(bytes[0] as number, bytes[1] as number, bytes[2] as number, bytes[3] as number) === "%PDF";

/**
 * Parse a page selection like `1-3, 5, 8-` into zero-based indexes.
 * Supports ranges, open ends (`8-`, `-3`) and the keyword `last`. Order and duplicates are preserved.
 */
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const out: number[] = [];
  const parts = spec.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new PdfError("Enter at least one page or range, for example 1-3, 5.");
  const num = (token: string): number => {
    if (token.toLowerCase() === "last") return pageCount;
    if (!/^\d+$/.test(token)) throw new PdfError(`"${token}" is not a valid page number.`);
    return Number(token);
  };
  for (const part of parts) {
    let start: number;
    let end: number;
    if (part.includes("-")) {
      const [a = "", b = ""] = part.split("-").map((x) => x.trim());
      start = a === "" ? 1 : num(a);
      end = b === "" ? pageCount : num(b);
    } else {
      start = end = num(part);
    }
    if (start < 1 || end > pageCount) throw new PdfError(`Page ${start < 1 ? start : end} is out of range (this PDF has ${pageCount} pages).`);
    if (start > end) {
      for (let p = start; p >= end; p--) out.push(p - 1);
    } else {
      for (let p = start; p <= end; p++) out.push(p - 1);
    }
  }
  return out;
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length < 2) throw new PdfError("Add at least two PDFs to merge.");
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const doc = await load(files[i] as Uint8Array, `File ${i + 1}`);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save({ useObjectStreams: true });
}

/** Build a new PDF from the given zero-based page indexes (in order). */
export async function extractPages(bytes: Uint8Array, pageIndexes: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  if (pageIndexes.length === 0) throw new PdfError("No pages selected.");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, pageIndexes);
  pages.forEach((p) => out.addPage(p));
  return out.save({ useObjectStreams: true });
}

export async function deletePages(bytes: Uint8Array, pageIndexes: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  const remove = new Set(pageIndexes);
  const keep = src.getPageIndices().filter((i) => !remove.has(i));
  if (keep.length === 0) throw new PdfError("You cannot delete every page.");
  return extractPages(bytes, keep);
}

export type SplitMode = { type: "each" } | { type: "every"; pages: number } | { type: "ranges"; spec: string };

export interface SplitPart {
  name: string;
  data: Uint8Array;
  pages: number[];
}

export async function splitPdf(bytes: Uint8Array, mode: SplitMode, baseName = "split"): Promise<SplitPart[]> {
  const src = await load(bytes);
  const count = src.getPageCount();
  let groups: number[][];
  if (mode.type === "each") {
    groups = src.getPageIndices().map((i) => [i]);
  } else if (mode.type === "every") {
    if (!Number.isInteger(mode.pages) || mode.pages < 1) throw new PdfError("Pages per file must be a positive whole number.");
    groups = [];
    for (let i = 0; i < count; i += mode.pages) groups.push(src.getPageIndices().slice(i, i + mode.pages));
  } else {
    groups = mode.spec
      .split(";")
      .map((g) => g.trim())
      .filter(Boolean)
      .map((g) => parsePageRanges(g, count));
    if (groups.length === 0) throw new PdfError("Enter at least one range. Separate files with semicolons: 1-3; 4-6.");
  }
  const pad = String(groups.length).length;
  const parts: SplitPart[] = [];
  for (let i = 0; i < groups.length; i++) {
    const pages = groups[i] as number[];
    parts.push({ name: `${baseName}-${String(i + 1).padStart(pad, "0")}.pdf`, data: await extractPages(bytes, pages), pages: pages.map((p) => p + 1) });
  }
  return parts;
}

export async function rotatePdf(bytes: Uint8Array, angle: 90 | 180 | 270, pageIndexes?: number[]): Promise<Uint8Array> {
  const doc = await load(bytes);
  const targets = pageIndexes ?? doc.getPageIndices();
  for (const i of targets) {
    const page = doc.getPage(i);
    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  }
  return doc.save({ useObjectStreams: true });
}

export async function reorderPages(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  return extractPages(bytes, order);
}

/** One page of the output: which source page (zero-based) to use and how far to turn it. */
export interface PageOp {
  source: number;
  /** Extra clockwise rotation, added to whatever the page already has. */
  rotate?: 0 | 90 | 180 | 270;
}

/**
 * Build a new PDF page by page. A source page may appear more than once (duplicated),
 * be left out (removed), and be turned, all in a single pass.
 */
export async function organizePages(bytes: Uint8Array, ops: PageOp[]): Promise<Uint8Array> {
  if (ops.length === 0) throw new PdfError("There are no pages left. Keep at least one page.");
  const src = await load(bytes);
  const count = src.getPageCount();
  for (const op of ops) {
    if (!Number.isInteger(op.source) || op.source < 0 || op.source >= count) throw new PdfError(`Page ${op.source + 1} does not exist (this PDF has ${count} pages).`);
  }
  const out = await PDFDocument.create();
  const copies = await out.copyPages(src, ops.map((op) => op.source));
  copies.forEach((page, i) => {
    const extra = ops[i]?.rotate ?? 0;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    out.addPage(page);
  });
  return out.save({ useObjectStreams: true });
}

export interface PageSize {
  width: number;
  height: number;
}

export const PAGE_SIZES: Record<string, PageSize> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
  a5: { width: 419.53, height: 595.28 },
};

export interface ImagesToPdfOptions {
  /** `fit` makes each page exactly the size of its image. */
  pageSize?: "fit" | keyof typeof PAGE_SIZES;
  /** Margin in PDF points (1/72 inch). */
  margin?: number;
  landscape?: boolean;
}

export type ImageInput = { data: Uint8Array; type: "png" | "jpeg" };

export async function imagesToPdf(images: ImageInput[], options: ImagesToPdfOptions = {}): Promise<Uint8Array> {
  if (images.length === 0) throw new PdfError("Add at least one image.");
  const { pageSize = "a4", margin = 24, landscape = false } = options;
  const doc = await PDFDocument.create();
  for (const image of images) {
    let embedded;
    try {
      embedded = image.type === "png" ? await doc.embedPng(image.data) : await doc.embedJpg(image.data);
    } catch {
      throw new PdfError("One of the images could not be read. Only PNG and JPEG files are supported.");
    }
    if (pageSize === "fit") {
      const page = doc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      continue;
    }
    const base = PAGE_SIZES[pageSize] as PageSize;
    const size = landscape ? { width: base.height, height: base.width } : base;
    const page = doc.addPage([size.width, size.height]);
    const maxW = size.width - margin * 2;
    const maxH = size.height - margin * 2;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, { x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h });
  }
  return doc.save({ useObjectStreams: true });
}

export interface PdfInfo {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pages: { number: number; width: number; height: number; rotation: number }[];
}

export async function getPdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const doc = await load(bytes);
  return {
    pageCount: doc.getPageCount(),
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
    creator: doc.getCreator(),
    producer: doc.getProducer(),
    creationDate: doc.getCreationDate()?.toISOString(),
    modificationDate: doc.getModificationDate()?.toISOString(),
    pages: doc.getPages().map((p, i) => ({ number: i + 1, width: p.getWidth(), height: p.getHeight(), rotation: p.getRotation().angle })),
  };
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
}

/** Overwrite document metadata. Pass an empty string to clear a field. */
export async function setPdfMetadata(bytes: Uint8Array, meta: PdfMetadata): Promise<Uint8Array> {
  const doc = await load(bytes);
  if (meta.title !== undefined) doc.setTitle(meta.title);
  if (meta.author !== undefined) doc.setAuthor(meta.author);
  if (meta.subject !== undefined) doc.setSubject(meta.subject);
  if (meta.keywords !== undefined) doc.setKeywords(meta.keywords === "" ? [] : meta.keywords.split(",").map((k) => k.trim()));
  if (meta.creator !== undefined) doc.setCreator(meta.creator);
  if (meta.producer !== undefined) doc.setProducer(meta.producer);
  return doc.save({ useObjectStreams: true });
}

/** Remove the Info dictionary (title, author, dates…) and any XMP metadata stream. */
export async function stripPdfMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await load(bytes);
  const infoRef = doc.context.trailerInfo.Info;
  const info = infoRef ? doc.context.lookupMaybe(infoRef, PDFDict) : undefined;
  if (info) for (const key of info.keys()) info.delete(key);
  doc.catalog.delete(PDFName.of("Metadata"));
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false });
}

export interface PageNumberOptions {
  position?: "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";
  format?: "n" | "n-of-total" | "page-n";
  startAt?: number;
  fontSize?: number;
  margin?: number;
}

export async function addPageNumbers(bytes: Uint8Array, options: PageNumberOptions = {}): Promise<Uint8Array> {
  const { position = "bottom-center", format = "n", startAt = 1, fontSize = 10, margin = 28 } = options;
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  doc.getPages().forEach((page, i) => {
    const n = startAt + i;
    const text = format === "n-of-total" ? `${n} of ${total + startAt - 1}` : format === "page-n" ? `Page ${n}` : String(n);
    const width = font.widthOfTextAtSize(text, fontSize);
    const { width: pw, height: ph } = page.getSize();
    const x = position.endsWith("left") ? margin : position.endsWith("right") ? pw - margin - width : (pw - width) / 2;
    const y = position.startsWith("top") ? ph - margin : margin - fontSize / 2;
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
  });
  return doc.save({ useObjectStreams: true });
}

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  opacity?: number;
  /** Rotation in degrees, counter-clockwise. */
  angle?: number;
  color?: { r: number; g: number; b: number };
}

export async function addTextWatermark(bytes: Uint8Array, options: WatermarkOptions): Promise<Uint8Array> {
  const { text, fontSize = 64, opacity = 0.2, angle = 45, color = { r: 0.5, g: 0.5, b: 0.5 } } = options;
  if (!text.trim()) throw new PdfError("Enter the watermark text.");
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const rad = (angle * Math.PI) / 180;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    // Rotate around the text centre so it lands in the middle of the page.
    const x = width / 2 - (Math.cos(rad) * textWidth) / 2 + (Math.sin(rad) * fontSize) / 3;
    const y = height / 2 - (Math.sin(rad) * textWidth) / 2 - (Math.cos(rad) * fontSize) / 3;
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(color.r, color.g, color.b), opacity, rotate: degrees(angle) });
  }
  return doc.save({ useObjectStreams: true });
}
