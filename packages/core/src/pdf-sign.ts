/**
 * Put a picture of a signature on pages of a PDF. This is a visual signature, like signing a printout: it is not a
 * cryptographic digital signature and proves nothing by itself. The geometry is the hard part: pages can be turned
 * by 90, 180 or 270 degrees, and PDF coordinates start at the bottom left of the unturned page, so a position on
 * the page as it is shown has to be converted. Keep this file free of React, the DOM and the network.
 */
import { degrees, rgb, StandardFonts } from "pdf-lib";
import { loadPdf, PdfError } from "./pdf";

export interface PageGeometry {
  /** The visible box of the page in PDF user space (the CropBox, or the MediaBox when there is none). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The page's own turn, clockwise, in degrees. */
  rotate: 0 | 90 | 180 | 270;
}

/** Visible size of a page in points, as it appears to the reader (after any turn). */
export function displaySize(g: PageGeometry): { width: number; height: number } {
  const w = g.x1 - g.x0;
  const h = g.y1 - g.y0;
  return g.rotate === 90 || g.rotate === 270 ? { width: h, height: w } : { width: w, height: h };
}

/**
 * Convert a point on the page as shown (`u` from the left, `v` down from the top, in points) to PDF user space.
 */
export function displayToUser(g: PageGeometry, u: number, v: number): { x: number; y: number } {
  switch (g.rotate) {
    case 90:
      return { x: g.x0 + v, y: g.y0 + u };
    case 180:
      return { x: g.x1 - u, y: g.y0 + v };
    case 270:
      return { x: g.x1 - v, y: g.y1 - u };
    default:
      return { x: g.x0 + u, y: g.y1 - v };
  }
}

/** The inverse of `displayToUser`. */
export function userToDisplay(g: PageGeometry, x: number, y: number): { u: number; v: number } {
  switch (g.rotate) {
    case 90:
      return { u: y - g.y0, v: x - g.x0 };
    case 180:
      return { u: g.x1 - x, v: y - g.y0 };
    case 270:
      return { u: g.y1 - y, v: g.x1 - x };
    default:
      return { u: x - g.x0, v: g.y1 - y };
  }
}

const snapTurn = (angle: number): 0 | 90 | 180 | 270 => ((((Math.round(angle / 90) * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270;

/** Read the visible box and turn of every page. */
export async function readPageGeometry(bytes: Uint8Array): Promise<PageGeometry[]> {
  const doc = await loadPdf(bytes);
  return doc.getPages().map((page) => {
    const box = page.getCropBox();
    return { x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + box.height, rotate: snapTurn(page.getRotation().angle) };
  });
}

/** A quick check for a digital signature: signed files carry a /ByteRange entry. Any change to them breaks the signature. */
export function looksDigitallySigned(bytes: Uint8Array): boolean {
  const needle = [0x2f, 0x42, 0x79, 0x74, 0x65, 0x52, 0x61, 0x6e, 0x67, 0x65]; // /ByteRange
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    if (bytes[i] !== 0x2f) continue;
    for (let j = 1; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

export interface SignaturePlacement {
  /** Zero-based page number. */
  page: number;
  /** Distance of the picture's left edge from the left of the page as shown, in points. */
  left: number;
  /** Distance of its top edge from the top of the page as shown. */
  top: number;
  /** Width in points. The height follows the shape of the picture. */
  width: number;
}

export interface SignOptions {
  /** A PNG, ideally with a transparent background. */
  image: Uint8Array;
  placements: SignaturePlacement[];
  /** Small text printed under each signature, such as a date. */
  caption?: string;
  captionSize?: number;
}

const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/** Stamp the signature picture, and optionally a caption, at each placement. Throws readable errors. */
export async function signPdf(bytes: Uint8Array, options: SignOptions): Promise<Uint8Array> {
  const { image, placements, caption, captionSize = 9 } = options;
  if (placements.length === 0) throw new PdfError("Choose where the signature goes.");
  if (!isPng(image)) throw new PdfError("The signature is not a PNG picture. Draw, type or upload it again.");

  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  let embedded;
  try {
    embedded = await doc.embedPng(image);
  } catch {
    throw new PdfError("The signature picture could not be read.");
  }
  const font = caption ? await doc.embedFont(StandardFonts.Helvetica) : null;
  if (font && caption) {
    try {
      font.widthOfTextAtSize(caption, captionSize);
    } catch {
      throw new PdfError("The caption has characters that the standard PDF font cannot print. Use plain letters, digits and punctuation.");
    }
  }

  for (const place of placements) {
    const page = pages[place.page];
    if (!page) throw new PdfError(`Page ${place.page + 1} does not exist (this PDF has ${pages.length} pages).`);
    if (!(place.width > 0) || !Number.isFinite(place.left) || !Number.isFinite(place.top)) throw new PdfError("The signature needs a position and a size.");
    const box = page.getCropBox();
    const g: PageGeometry = { x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + box.height, rotate: snapTurn(page.getRotation().angle) };
    const shown = displaySize(g);
    const height = (place.width * embedded.height) / embedded.width;
    if (place.left >= shown.width || place.top >= shown.height || place.left + place.width <= 0 || place.top + height <= 0) {
      throw new PdfError(`The signature is outside page ${place.page + 1}. Move it onto the page.`);
    }
    // The picture's bottom-left corner as shown. Turning the picture by the page's own turn keeps it upright for the reader.
    const anchor = displayToUser(g, place.left, place.top + height);
    page.drawImage(embedded, { x: anchor.x, y: anchor.y, width: place.width, height, rotate: degrees(g.rotate) });
    if (font && caption) {
      const text = displayToUser(g, place.left, place.top + height + captionSize + 2);
      page.drawText(caption, { x: text.x, y: text.y, size: captionSize, font, color: rgb(0.25, 0.25, 0.25), rotate: degrees(g.rotate) });
    }
  }
  return doc.save({ useObjectStreams: true });
}

/* ----------------------------------------------------------------------------------------------- */
/* Picture helpers, on raw RGBA pixels so they can be tested without a canvas                         */
/* ----------------------------------------------------------------------------------------------- */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The smallest rectangle (plus padding) that holds every pixel that is not transparent. Null for a blank picture. */
export function inkBounds(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, padding = 0, alphaThreshold = 8): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((rgba[(y * width + x) * 4 + 3] as number) > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  return { x, y, width: Math.min(width, maxX + 1 + padding) - x, height: Math.min(height, maxY + 1 + padding) - y };
}

export interface Ink {
  r: number;
  g: number;
  b: number;
}

/**
 * Turn a picture of a signature on paper (dark ink, light background) into ink on a transparent background:
 * how dark a pixel is becomes how opaque it is, and everything is tinted with the chosen ink colour.
 * Pixels at or above `whiteLevel` become fully transparent, and at or below `blackLevel` fully opaque.
 */
export function inkFromScan(rgba: Uint8ClampedArray | Uint8Array, ink: Ink, whiteLevel = 225, blackLevel = 100): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = 0.299 * (rgba[i] as number) + 0.587 * (rgba[i + 1] as number) + 0.114 * (rgba[i + 2] as number);
    const darkness = Math.min(1, Math.max(0, (whiteLevel - lum) / Math.max(1, whiteLevel - blackLevel)));
    // Already-transparent pixels stay transparent.
    const alpha = Math.round(darkness * 255 * ((rgba[i + 3] as number) / 255));
    rgba[i] = ink.r;
    rgba[i + 1] = ink.g;
    rgba[i + 2] = ink.b;
    rgba[i + 3] = alpha;
  }
}

/** True when any pixel is at least partly transparent. */
export function hasTransparency(rgba: Uint8ClampedArray | Uint8Array): boolean {
  for (let i = 3; i < rgba.length; i += 4) if ((rgba[i] as number) < 250) return true;
  return false;
}

/** Parse "1-3, 5" style page lists into zero-based page numbers, for "sign these pages". Order and duplicates are removed. */
export function pagesFromSpec(spec: string, pageCount: number): number[] {
  const out = new Set<number>();
  for (const part of spec.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) throw new PdfError(`“${part}” is not a page or a range. Use numbers such as 1, 3-5.`);
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || b < 1 || a > pageCount || b > pageCount) throw new PdfError(`Page ${a < 1 || a > pageCount ? a : b} is out of range (this PDF has ${pageCount} pages).`);
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) out.add(p - 1);
  }
  if (out.size === 0) throw new PdfError("Enter at least one page, for example 1 or 2-4.");
  return [...out].sort((x, y) => x - y);
}
