/**
 * PDF compression logic that needs no DOM.
 *
 * Two modes share this module:
 *  - "Keep text" recompresses the JPEG images inside a PDF. The actual decode/encode is injected as a
 *    `Recompress` function, because canvas only exists in the browser.
 *  - "Smallest file" renders every page to a JPEG in the browser (PDF.js) and rebuilds the file here.
 */

import { PDFArray, PDFBool, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from "pdf-lib";
import { loadPdf, PdfError } from "./pdf";

/* ----------------------------------------------------------------------------------------------- */
/* Settings, presets and limits                                                                     */
/* ----------------------------------------------------------------------------------------------- */

export type CompressMode = "keep-text" | "smallest";

export interface CompressSettings {
  /** JPEG quality, 30 to 95. */
  quality: number;
  /** Highest resolution kept for images (Keep text) or for rendered pages (Smallest file), 50 to 600. */
  maxDpi: number;
}

export type CompressPresetId = "light" | "balanced" | "strong";

export const COMPRESS_PRESETS: Record<CompressPresetId, CompressSettings & { label: string }> = {
  light: { label: "Light", quality: 85, maxDpi: 300 },
  balanced: { label: "Balanced", quality: 72, maxDpi: 150 },
  strong: { label: "Strong", quality: 55, maxDpi: 100 },
};

export const QUALITY_RANGE = { min: 30, max: 95 } as const;
export const DPI_RANGE = { min: 50, max: 600 } as const;

export function validateSettings(settings: CompressSettings): CompressSettings {
  const { quality, maxDpi } = settings;
  if (!Number.isFinite(quality) || quality < QUALITY_RANGE.min || quality > QUALITY_RANGE.max) {
    throw new PdfError(`Image quality must be between ${QUALITY_RANGE.min} and ${QUALITY_RANGE.max}.`);
  }
  if (!Number.isFinite(maxDpi) || maxDpi < DPI_RANGE.min || maxDpi > DPI_RANGE.max) {
    throw new PdfError(`Maximum resolution must be between ${DPI_RANGE.min} and ${DPI_RANGE.max} DPI.`);
  }
  return { quality: Math.round(quality), maxDpi: Math.round(maxDpi) };
}

/** The preset these settings match exactly, or `null` for custom settings. */
export function matchPreset(settings: CompressSettings): CompressPresetId | null {
  for (const [id, preset] of Object.entries(COMPRESS_PRESETS) as [CompressPresetId, (typeof COMPRESS_PRESETS)[CompressPresetId]][]) {
    if (preset.quality === settings.quality && preset.maxDpi === settings.maxDpi) return id;
  }
  return null;
}

const MB = 1024 * 1024;

/** Starting values. Real memory use depends on the device, so these are conservative and meant to be tuned. */
export const COMPRESS_LIMITS = {
  warnBytes: 50 * MB,
  warnPages: 200,
  maxBytes: 200 * MB,
  maxSmallestPages: 1000,
  /** Largest canvas drawn for one page in Smallest file mode (the iOS Safari canvas ceiling is about 16.7 MP). */
  maxPagePixels: 16_000_000,
  /** Below this size there is rarely anything to gain; the tool says so but still runs. */
  smallFileBytes: 100 * 1024,
} as const;

/** Smallest file turns text into pictures, so it must save at least this share to be worth offering. */
export const SMALLEST_MIN_GAIN = 0.1;
/** Keep text only replaces an image when the new one is at least this much smaller. */
export const IMAGE_MIN_GAIN = 0.1;

export interface LimitCheck {
  /** Set when the file must not be processed. */
  refuse?: string;
  /** Set when it can be processed but may be slow. */
  warn?: string;
}

const sizeLabel = (bytes: number) => (bytes >= MB ? `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Checked from `file.size` before the file is read into memory. */
export function checkFileSize(bytes: number): LimitCheck {
  if (bytes > COMPRESS_LIMITS.maxBytes) {
    return { refuse: `This file is ${sizeLabel(bytes)}. Compress PDF handles files up to ${sizeLabel(COMPRESS_LIMITS.maxBytes)} in a browser tab. Split it first with Split PDF.` };
  }
  if (bytes >= COMPRESS_LIMITS.warnBytes) return { warn: `This file is ${sizeLabel(bytes)}. It can take a minute or more. Keep this tab open.` };
  return {};
}

/** Checked once the page count is known. */
export function checkPageCount(pages: number, mode: CompressMode): LimitCheck {
  if (mode === "smallest" && pages > COMPRESS_LIMITS.maxSmallestPages) {
    return { refuse: `This PDF has ${pages} pages. Smallest file draws every page, so it is limited to ${COMPRESS_LIMITS.maxSmallestPages}. Split the file first, or use Keep text.` };
  }
  if (pages >= COMPRESS_LIMITS.warnPages) return { warn: `This PDF has ${pages} pages. It can take a minute or more. Keep this tab open.` };
  return {};
}

export interface SizeOutcome {
  /** True when the candidate is small enough to offer. */
  smaller: boolean;
  before: number;
  after: number;
  savedBytes: number;
  /** Fraction of the original saved; negative when the candidate is bigger. */
  savedFraction: number;
}

/**
 * The rule that keeps the tool honest: a result is only offered when it is smaller than the original
 * by at least `minGain` (a fraction, so 0.1 means 10%). With `minGain` 0 it must still be strictly smaller.
 */
export function pickSmaller(before: number, after: number, minGain = 0): SizeOutcome {
  const savedBytes = before - after;
  const savedFraction = before > 0 ? savedBytes / before : 0;
  return { smaller: after < before && savedFraction >= minGain, before, after, savedBytes, savedFraction };
}

/* ----------------------------------------------------------------------------------------------- */
/* Reading JPEG headers                                                                              */
/* ----------------------------------------------------------------------------------------------- */

export interface JpegInfo {
  width: number;
  height: number;
  components: number;
  progressive: boolean;
}

/** Reads the start-of-frame marker. Returns `null` when the bytes are not a JPEG with a readable header. */
export function readJpegInfo(data: Uint8Array): JpegInfo | null {
  const at = (i: number) => data[i] ?? 0;
  if (data.length < 4 || at(0) !== 0xff || at(1) !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= data.length) {
    if (at(i) !== 0xff) {
      i++;
      continue;
    }
    const marker = at(i + 1);
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = (at(i + 2) << 8) | at(i + 3);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 10 > data.length) return null;
      return { height: (at(i + 5) << 8) | at(i + 6), width: (at(i + 7) << 8) | at(i + 8), components: at(i + 9), progressive: marker === 0xc2 };
    }
    i += 2 + length;
  }
  return null;
}

/**
 * Removes EXIF and XMP segments (APP1) from a JPEG. A PDF ignores the EXIF orientation tag but browsers apply it
 * when decoding, which would turn the picture. Colour profiles (APP2) and everything else are kept.
 * Returns the same array when there is nothing to remove.
 */
export function stripJpegExif(data: Uint8Array): Uint8Array {
  const at = (i: number) => data[i] ?? 0;
  if (data.length < 4 || at(0) !== 0xff || at(1) !== 0xd8) return data;
  const kept: Uint8Array[] = [data.subarray(0, 2)];
  let i = 2;
  let removed = false;
  while (i + 4 <= data.length && at(i) === 0xff) {
    const marker = at(i + 1);
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xda || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) break;
    const end = i + 2 + ((at(i + 2) << 8) | at(i + 3));
    if (end > data.length) return data;
    if (marker === 0xe1) removed = true;
    else kept.push(data.subarray(i, end));
    i = end;
  }
  if (!removed) return data;
  kept.push(data.subarray(i));
  const out = new Uint8Array(kept.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of kept) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */
/* Content stream scanning: how big is each image on the page?                                      */
/* ----------------------------------------------------------------------------------------------- */

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` applied first, then `n` (PDF's row-vector convention). */
function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const isSpace = (c: number) => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
const isDelimiter = (c: number) => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;

interface ContentVisitor {
  /** Called for every `Do` operator with the current transformation matrix. */
  onDo(name: string, ctm: Matrix): void;
}

/**
 * Walks a content stream tracking only the graphics state that decides where an image lands:
 * `q`, `Q`, `cm` and `Do`. Everything else is skipped. Returns false when the stream could not be walked to the end.
 */
export function scanContent(text: string, start: Matrix, visitor: ContentVisitor): boolean {
  const stack: Matrix[] = [];
  let ctm = start;
  let operands: (number | string)[] = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (isSpace(c)) {
      i++;
    } else if (c === 37) {
      while (i < n && text.charCodeAt(i) !== 10 && text.charCodeAt(i) !== 13) i++;
    } else if (c === 40) {
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        const d = text.charCodeAt(i);
        if (d === 92) i++;
        else if (d === 40) depth++;
        else if (d === 41) depth--;
        i++;
      }
    } else if (c === 60) {
      if (text.charCodeAt(i + 1) === 60) {
        let depth = 1;
        i += 2;
        while (i < n && depth > 0) {
          if (text.charCodeAt(i) === 60 && text.charCodeAt(i + 1) === 60) {
            depth++;
            i += 2;
          } else if (text.charCodeAt(i) === 62 && text.charCodeAt(i + 1) === 62) {
            depth--;
            i += 2;
          } else i++;
        }
      } else {
        while (i < n && text.charCodeAt(i) !== 62) i++;
        i++;
      }
    } else if (c === 91 || c === 93 || c === 123 || c === 125 || c === 41 || c === 62) {
      i++;
    } else if (c === 47) {
      let j = i + 1;
      while (j < n && !isSpace(text.charCodeAt(j)) && !isDelimiter(text.charCodeAt(j))) j++;
      operands.push(text.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < n && !isSpace(text.charCodeAt(j)) && !isDelimiter(text.charCodeAt(j))) j++;
      const token = text.slice(i, j);
      i = j;
      if (NUMBER.test(token)) {
        operands.push(Number(token));
        continue;
      }
      switch (token) {
        case "q":
          stack.push(ctm);
          break;
        case "Q":
          ctm = stack.pop() ?? ctm;
          break;
        case "cm": {
          const m = operands.slice(-6);
          if (m.length === 6 && m.every((x) => typeof x === "number")) ctm = multiply(m as Matrix, ctm);
          break;
        }
        case "Do": {
          const name = operands[operands.length - 1];
          if (typeof name === "string" && name.startsWith("/")) visitor.onDo(name.slice(1), ctm);
          break;
        }
        case "BI": {
          // Inline image: skip to the end-of-image marker without interpreting the binary data.
          const id = /\sID\s/g;
          id.lastIndex = i;
          const found = id.exec(text);
          if (!found) return false;
          const ei = /\sEI(?=\s|$)/g;
          ei.lastIndex = found.index + found[0].length;
          const end = ei.exec(text);
          if (!end) return false;
          i = end.index + end[0].length;
          break;
        }
        default:
          break;
      }
      operands = [];
    }
  }
  return true;
}

/* ----------------------------------------------------------------------------------------------- */
/* Analysis                                                                                          */
/* ----------------------------------------------------------------------------------------------- */

export type ImageKind = "jpeg" | "lossless" | "bilevel" | "jpx" | "mask" | "other";

export interface PdfImage {
  /** Object number and generation, for example "12 0". */
  key: string;
  width: number;
  height: number;
  /** Stored size of the image stream in bytes. */
  bytes: number;
  kind: ImageKind;
  /** True when Keep text can recompress it. */
  recompress: boolean;
  /** Plain-language reason it cannot be recompressed. */
  skipReason?: string;
  /** Number of colour channels in the JPEG (1 or 3); only for images that can be recompressed. */
  components?: 1 | 3;
  hasSoftMask: boolean;
  /** Largest size the image is drawn at, in PDF points. Missing when it could not be determined. */
  placed?: { widthPt: number; heightPt: number };
}

export interface PdfAnalysis {
  fileSize: number;
  pageCount: number;
  images: PdfImage[];
  /** Bytes taken by all image streams. */
  imageBytes: number;
  /** Bytes taken by images Keep text can recompress. */
  recompressibleBytes: number;
  /** Has a digital signature, which any change would invalidate. */
  signed: boolean;
  /** Has fillable form fields. */
  hasForms: boolean;
}

const SKIP = {
  lossless: "stored without loss (Flate or LZW)",
  bilevel: "black-and-white scan format (JBIG2 or CCITT)",
  jpx: "JPEG 2000",
  mask: "transparency mask",
  colorSpace: "CMYK or a special colour space",
  stencil: "stencil or colour-key mask",
  decode: "custom decode range",
  matte: "mask with a matte",
  layout: "unusual JPEG layout",
  other: "unknown encoding",
} as const;

const NAME = (s: string) => PDFName.of(s);
const keyOf = (ref: PDFRef) => `${ref.objectNumber} ${ref.generationNumber}`;

function filterNames(doc: PDFDocument, dict: PDFDict): string[] {
  const raw = dict.lookup(NAME("Filter"));
  const names: string[] = [];
  if (raw instanceof PDFName) names.push(raw.asString().slice(1));
  else if (raw instanceof PDFArray) {
    for (let i = 0; i < raw.size(); i++) {
      const item = doc.context.lookup(raw.get(i));
      if (item instanceof PDFName) names.push(item.asString().slice(1));
    }
  }
  return names;
}

/** Number of colour channels for a colour space we can safely hand to a canvas, or null. */
function colorComponents(doc: PDFDocument, dict: PDFDict): 1 | 3 | null {
  const cs = dict.lookup(NAME("ColorSpace"));
  if (cs instanceof PDFName) {
    const name = cs.asString().slice(1);
    if (name === "DeviceGray" || name === "CalGray" || name === "G") return 1;
    if (name === "DeviceRGB" || name === "CalRGB" || name === "RGB") return 3;
    return null;
  }
  if (cs instanceof PDFArray && cs.size() > 0) {
    const head = doc.context.lookup(cs.get(0));
    if (!(head instanceof PDFName)) return null;
    const family = head.asString().slice(1);
    if (family === "CalGray") return 1;
    if (family === "CalRGB") return 3;
    if (family === "ICCBased") {
      const profile = doc.context.lookup(cs.get(1));
      const n = profile instanceof PDFStream ? profile.dict.lookup(NAME("N")) : undefined;
      if (n instanceof PDFNumber) return n.asNumber() === 1 ? 1 : n.asNumber() === 3 ? 3 : null;
    }
  }
  return null;
}

function numberOf(dict: PDFDict, key: string): number {
  const v = dict.lookup(NAME(key));
  return v instanceof PDFNumber ? v.asNumber() : 0;
}

interface Collected {
  image: PdfImage;
  stream: PDFRawStream;
  ref: PDFRef;
}

function classify(doc: PDFDocument, ref: PDFRef, stream: PDFRawStream, maskRefs: Set<string>): PdfImage {
  const dict = stream.dict;
  const key = keyOf(ref);
  const bytes = stream.contents.length;
  const width = numberOf(dict, "Width");
  const height = numberOf(dict, "Height");
  const softMaskRef = dict.get(NAME("SMask"));
  const base = { key, width, height, bytes, hasSoftMask: softMaskRef instanceof PDFRef };
  const skip = (kind: ImageKind, skipReason: string): PdfImage => ({ ...base, kind, recompress: false, skipReason });

  if (maskRefs.has(key)) return skip("mask", SKIP.mask);
  const filters = filterNames(doc, dict);
  if (filters.length === 1 && (filters[0] === "JBIG2Decode" || filters[0] === "CCITTFaxDecode" || filters[0] === "CCF")) return skip("bilevel", SKIP.bilevel);
  if (filters.includes("JPXDecode")) return skip("jpx", SKIP.jpx);
  if (filters.length === 1 && ["FlateDecode", "Fl", "LZWDecode", "LZW"].includes(filters[0] as string)) return skip("lossless", SKIP.lossless);
  if (filters.length !== 1 || (filters[0] !== "DCTDecode" && filters[0] !== "DCT")) return skip("other", SKIP.other);

  if (dict.lookup(NAME("ImageMask")) === PDFBool.True) return skip("jpeg", SKIP.stencil);
  if (dict.has(NAME("Mask"))) return skip("jpeg", SKIP.stencil);
  if (softMaskRef instanceof PDFRef) {
    const mask = doc.context.lookup(softMaskRef);
    if (mask instanceof PDFStream && mask.dict.has(NAME("Matte"))) return skip("jpeg", SKIP.matte);
  }
  const components = colorComponents(doc, dict);
  if (components === null) return skip("jpeg", SKIP.colorSpace);
  if (dict.has(NAME("Decode"))) return skip("jpeg", SKIP.decode);
  const info = readJpegInfo(stream.contents);
  if (!info || info.components !== components || info.width < 1 || info.height < 1) return skip("jpeg", SKIP.layout);
  return { ...base, width: info.width, height: info.height, kind: "jpeg", recompress: true, components };
}

/** Collects the images of a loaded document and works out where each one is drawn. */
function analyzeDocument(doc: PDFDocument, fileSize: number): { analysis: PdfAnalysis; collected: Collected[] } {
  const context = doc.context;
  const streams: { ref: PDFRef; stream: PDFRawStream }[] = [];
  const maskRefs = new Set<string>();
  let signed = false;

  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream) {
      if (object.dict.lookup(NAME("Subtype")) === NAME("Image")) {
        streams.push({ ref, stream: object });
        const smask = object.dict.get(NAME("SMask"));
        if (smask instanceof PDFRef) maskRefs.add(keyOf(smask));
        const mask = object.dict.get(NAME("Mask"));
        if (mask instanceof PDFRef) maskRefs.add(keyOf(mask));
      }
    } else if (object instanceof PDFDict && object.lookup(NAME("FT")) === NAME("Sig") && object.has(NAME("V"))) {
      signed = true;
    }
  }

  const collected: Collected[] = streams.map(({ ref, stream }) => ({ ref, stream, image: classify(doc, ref, stream, maskRefs) }));
  const byKey = new Map(collected.map((c) => [c.image.key, c.image]));

  // Where is each image drawn? Take the largest placement over all pages.
  const placed = new Map<string, { widthPt: number; heightPt: number }>();
  let complete = true;
  let budget = 200_000;
  const decoder = new TextDecoder("latin1");

  const contentOf = (stream: PDFStream): string | null => {
    try {
      return decoder.decode(stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents());
    } catch {
      return null;
    }
  };

  const walk = (text: string, start: Matrix, resources: PDFDict | undefined, depth: number, seen: Set<string>): boolean => {
    const xobjects = resources?.lookupMaybe(NAME("XObject"), PDFDict);
    return scanContent(text, start, {
      onDo(name, ctm) {
        if (--budget < 0 || !xobjects) return;
        const entry = xobjects.get(NAME(name));
        if (!(entry instanceof PDFRef)) return;
        const key = keyOf(entry);
        if (byKey.has(key)) {
          const widthPt = Math.hypot(ctm[0], ctm[1]);
          const heightPt = Math.hypot(ctm[2], ctm[3]);
          const previous = placed.get(key);
          if (!previous || widthPt * heightPt > previous.widthPt * previous.heightPt) placed.set(key, { widthPt, heightPt });
          return;
        }
        const form = context.lookup(entry);
        if (!(form instanceof PDFStream) || form.dict.lookup(NAME("Subtype")) !== NAME("Form") || depth >= 4 || seen.has(key)) return;
        const formText = contentOf(form);
        if (formText === null) {
          complete = false;
          return;
        }
        const matrix = form.dict.lookupMaybe(NAME("Matrix"), PDFArray);
        const values = matrix ? Array.from({ length: matrix.size() }, (_, i) => (matrix.lookup(i, PDFNumber) as PDFNumber).asNumber()) : [];
        const own = (values.length === 6 ? multiply(values as Matrix, ctm) : ctm) as Matrix;
        const next = new Set(seen).add(key);
        if (!walk(formText, own, form.dict.lookupMaybe(NAME("Resources"), PDFDict) ?? resources, depth + 1, next)) complete = false;
      },
    });
  };

  const pages = doc.getPages();
  for (const page of pages) {
    try {
      const contents = page.node.Contents();
      const parts: string[] = [];
      if (contents instanceof PDFStream) {
        const text = contentOf(contents);
        if (text === null) complete = false;
        else parts.push(text);
      } else if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
          const part = context.lookup(contents.get(i));
          const text = part instanceof PDFStream ? contentOf(part) : null;
          if (text === null) complete = false;
          else parts.push(text);
        }
      }
      if (!walk(parts.join("\n"), IDENTITY, page.node.Resources(), 0, new Set())) complete = false;
    } catch {
      complete = false;
    }
  }

  if (complete) {
    for (const { image } of collected) {
      const where = placed.get(image.key);
      if (where && where.widthPt > 0 && where.heightPt > 0) image.placed = where;
    }
  }

  const images = collected.map((c) => c.image);
  const catalogForm = doc.catalog.lookupMaybe(NAME("AcroForm"), PDFDict);
  const fields = catalogForm?.lookupMaybe(NAME("Fields"), PDFArray);
  return {
    collected,
    analysis: {
      fileSize,
      pageCount: pages.length,
      images,
      imageBytes: images.reduce((n, i) => n + i.bytes, 0),
      recompressibleBytes: images.reduce((n, i) => n + (i.recompress ? i.bytes : 0), 0),
      signed,
      hasForms: !!fields && fields.size() > 0,
    },
  };
}

/** Reads a PDF and reports what is inside it. Throws a readable `PdfError` for encrypted or damaged files. */
export async function analyzePdf(bytes: Uint8Array): Promise<PdfAnalysis> {
  const doc = await loadPdf(bytes, "PDF", Infinity);
  return analyzeDocument(doc, bytes.length).analysis;
}

/** Images grouped by why they cannot be recompressed, for the summary shown to the user. */
export function summarizeSkips(analysis: PdfAnalysis): { reason: string; count: number; bytes: number }[] {
  const groups = new Map<string, { reason: string; count: number; bytes: number }>();
  for (const image of analysis.images) {
    if (image.recompress || !image.skipReason) continue;
    const group = groups.get(image.skipReason) ?? { reason: image.skipReason, count: 0, bytes: 0 };
    group.count++;
    group.bytes += image.bytes;
    groups.set(image.skipReason, group);
  }
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes);
}

/* ----------------------------------------------------------------------------------------------- */
/* Keep text: recompress the JPEGs                                                                   */
/* ----------------------------------------------------------------------------------------------- */

export interface ImageJob {
  key: string;
  data: Uint8Array;
  width: number;
  height: number;
  components: 1 | 3;
  targetWidth: number;
  targetHeight: number;
  /** 0 to 1, for a canvas encoder. */
  quality: number;
}

export interface RecompressedImage {
  data: Uint8Array;
  width: number;
  height: number;
  components: 1 | 3;
}

/** Decodes the JPEG in a job, resizes it to the target and encodes it again. Return null if it cannot be read. */
export type Recompress = (job: ImageJob) => Promise<RecompressedImage | null>;

/** Target size and quality for an image. Without a known placement the image is not scaled down. */
export function planImage(image: PdfImage, settings: CompressSettings): { targetWidth: number; targetHeight: number; quality: number } {
  let scale = 1;
  if (image.placed) {
    const dpi = Math.max(image.width / (image.placed.widthPt / 72), image.height / (image.placed.heightPt / 72));
    if (dpi > settings.maxDpi) scale = settings.maxDpi / dpi;
  }
  if (scale > 0.97) scale = 1;
  return {
    targetWidth: Math.max(1, Math.round(image.width * scale)),
    targetHeight: Math.max(1, Math.round(image.height * scale)),
    quality: settings.quality / 100,
  };
}

export interface CompressProgress {
  done: number;
  total: number;
}

export interface CompressReport {
  /** Image streams in the file, including masks. */
  images: number;
  recompressed: number;
  /** The new image was not at least 10% smaller, so the original was kept. */
  keptOriginal: number;
  /** The browser could not read or re-encode the image, so the original was kept. */
  unreadable: number;
  /** Not a kind of image this mode can handle. */
  skipped: number;
  imageBytesBefore: number;
  imageBytesAfter: number;
}

export interface CompressResult {
  /** The compressed file, or null when it would not have been smaller. The original is then the answer. */
  data: Uint8Array | null;
  outcome: SizeOutcome;
  report: CompressReport;
}

export class CompressCancelled extends Error {
  constructor() {
    super("Compression was cancelled.");
    this.name = "CompressCancelled";
  }
}

export interface CompressOptions {
  onProgress?: (progress: CompressProgress) => void;
  signal?: AbortSignal;
}

/**
 * Recompresses the JPEG images in a PDF and re-saves it. Text, vectors, links and forms are not touched.
 * The result is `null` unless it is strictly smaller than the input.
 */
export async function compressPdfImages(bytes: Uint8Array, settings: CompressSettings, recompress: Recompress, options: CompressOptions = {}): Promise<CompressResult> {
  const { quality, maxDpi } = validateSettings(settings);
  const doc = await loadPdf(bytes, "PDF", Infinity);
  const { analysis, collected } = analyzeDocument(doc, bytes.length);
  const jobs = collected.filter((c) => c.image.recompress);
  const report: CompressReport = {
    images: collected.length,
    recompressed: 0,
    keptOriginal: 0,
    unreadable: 0,
    skipped: collected.length - jobs.length,
    imageBytesBefore: analysis.imageBytes,
    imageBytesAfter: analysis.imageBytes,
  };

  let done = 0;
  options.onProgress?.({ done, total: jobs.length });
  for (const { image, stream, ref } of jobs) {
    if (options.signal?.aborted) throw new CompressCancelled();
    const plan = planImage(image, { quality, maxDpi });
    let result: RecompressedImage | null = null;
    try {
      result = await recompress({ key: image.key, data: stream.contents, width: image.width, height: image.height, components: image.components ?? 3, ...plan });
    } catch (err) {
      if (err instanceof CompressCancelled) throw err;
    }
    if (options.signal?.aborted) throw new CompressCancelled();
    if (!result) report.unreadable++;
    else if (result.data.length > stream.contents.length * (1 - IMAGE_MIN_GAIN)) report.keptOriginal++;
    else {
      const dict = PDFDict.withContext(doc.context);
      for (const [name, value] of stream.dict.entries()) dict.set(name, value);
      dict.set(NAME("Width"), PDFNumber.of(result.width));
      dict.set(NAME("Height"), PDFNumber.of(result.height));
      dict.set(NAME("ColorSpace"), NAME(result.components === 1 ? "DeviceGray" : "DeviceRGB"));
      dict.set(NAME("BitsPerComponent"), PDFNumber.of(8));
      dict.set(NAME("Filter"), NAME("DCTDecode"));
      dict.delete(NAME("DecodeParms"));
      doc.context.assign(ref, PDFRawStream.of(dict, result.data));
      report.recompressed++;
      report.imageBytesAfter += result.data.length - stream.contents.length;
    }
    options.onProgress?.({ done: ++done, total: jobs.length });
  }

  // `updateFieldAppearances: false` keeps form fields exactly as they were.
  const saved = await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
  const outcome = pickSmaller(bytes.length, saved.length);
  return { data: outcome.smaller ? saved : null, outcome, report };
}

/* ----------------------------------------------------------------------------------------------- */
/* Smallest file: render pages, rebuild from JPEGs                                                   */
/* ----------------------------------------------------------------------------------------------- */

export interface RasterPlan {
  /** Output page size in PDF points, after the page's own rotation. */
  widthPt: number;
  heightPt: number;
  /** Pixels per PDF point for the renderer (PDF.js "scale"). */
  scale: number;
  /** Canvas size in pixels. */
  pixelWidth: number;
  pixelHeight: number;
  /** True when the resolution was lowered to stay under the pixel limit. */
  capped: boolean;
}

/**
 * Decides how large to draw a page. `view` is the page's visible box `[x0, y0, x1, y1]` and `rotate` its
 * own rotation in degrees; a page turned by 90 or 270 degrees swaps width and height, and the output has no rotation of its own.
 */
export function planRaster(view: readonly [number, number, number, number], rotate: number, dpi: number, maxPixels: number = COMPRESS_LIMITS.maxPagePixels): RasterPlan {
  const turned = ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;
  const boxWidth = Math.abs(view[2] - view[0]);
  const boxHeight = Math.abs(view[3] - view[1]);
  if (!(boxWidth > 0 && boxHeight > 0)) throw new PdfError("A page has no size, so it cannot be drawn.");
  const swap = turned === 90 || turned === 270;
  const widthPt = swap ? boxHeight : boxWidth;
  const heightPt = swap ? boxWidth : boxHeight;
  let scale = dpi / 72;
  let capped = false;
  if (widthPt * scale * heightPt * scale > maxPixels) {
    scale = Math.sqrt(maxPixels / (widthPt * heightPt));
    capped = true;
  }
  return { widthPt, heightPt, scale, pixelWidth: Math.max(1, Math.round(widthPt * scale)), pixelHeight: Math.max(1, Math.round(heightPt * scale)), capped };
}

export interface ImagePdfBuilder {
  addPage(jpeg: Uint8Array, widthPt: number, heightPt: number): Promise<void>;
  finish(meta?: { title?: string; author?: string }): Promise<Uint8Array>;
}

/** Builds a PDF whose pages are full-page JPEGs. Pages are added one at a time so the caller can free each image. */
export async function createImagePdfBuilder(): Promise<ImagePdfBuilder> {
  const doc = await PDFDocument.create();
  return {
    async addPage(jpeg, widthPt, heightPt) {
      let image;
      try {
        image = await doc.embedJpg(jpeg);
      } catch {
        throw new PdfError("A rendered page could not be saved as an image.");
      }
      const page = doc.addPage([widthPt, heightPt]);
      page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });
    },
    async finish(meta = {}) {
      if (doc.getPageCount() === 0) throw new PdfError("There are no pages to save.");
      if (meta.title) doc.setTitle(meta.title);
      if (meta.author) doc.setAuthor(meta.author);
      return doc.save({ useObjectStreams: true });
    },
  };
}
