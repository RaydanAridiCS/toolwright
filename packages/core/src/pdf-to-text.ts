/**
 * Turns the pieces of text that PDF.js finds on a page into readable lines and paragraphs. A PDF stores text as
 * small positioned runs, not as sentences, so the line breaks, spaces and paragraphs are worked out here from
 * their positions. This is an approximation: it does well on ordinary documents and is honest about its limits
 * (columns, tables, scans). Keep this file free of React, the DOM and the network.
 */

export interface TextPiece {
  str: string;
  /** Left edge, in points. */
  x: number;
  /** Baseline height from the bottom of the page, in points. */
  y: number;
  /** Width of the run in points. */
  width: number;
  /** Font size of the run in points. */
  height: number;
  /** The PDF says a line ends after this run. */
  hasEOL?: boolean;
}

export interface TextOptions {
  /** Join "exam-" + "ple" at a line end into "example". */
  joinHyphens: boolean;
}

export const DEFAULT_TEXT_OPTIONS: TextOptions = { joinHyphens: true };

export const TEXT_LIMITS = {
  maxFileBytes: 200 * 1024 * 1024,
  maxPages: 2000,
  warnPages: 500,
  /** Per page. A page with more runs than this is almost certainly a drawing made of letters; the rest is skipped. */
  maxPiecesPerPage: 200_000,
  /** The finished text stops here so a huge file cannot fill memory. */
  maxCharacters: 20_000_000,
} as const;

const num = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Reads PDF.js text items (`page.getTextContent().items`) into pieces. Anything that is not a text run (marked-content
 * markers) or has no usable position is skipped, so odd files cannot crash the assembly.
 */
export function toPieces(items: readonly unknown[]): TextPiece[] {
  const out: TextPiece[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const { str, transform, width, height, hasEOL } = item as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown; hasEOL?: unknown };
    if (typeof str !== "string" || !Array.isArray(transform) || transform.length < 6) continue;
    const x = transform[4];
    const y = transform[5];
    if (!num(x) || !num(y)) continue;
    out.push({
      str,
      x,
      y,
      width: num(width) && width >= 0 ? width : 0,
      height: num(height) && height > 0 ? height : num(transform[3]) && Math.abs(transform[3]) > 0 ? Math.abs(transform[3]) : 10,
      hasEOL: hasEOL === true,
    });
    if (out.length >= TEXT_LIMITS.maxPiecesPerPage) break;
  }
  return out;
}

export interface TextLine {
  text: string;
  /** Baseline of the first run, used to measure gaps between lines. */
  y: number;
  height: number;
  /** Right edge of the last run, used to spot spacing inside a line. */
  end: number;
}

const LIGATURES: Record<string, string> = { "\uFB00": "ff", "\uFB01": "fi", "\uFB02": "fl", "\uFB03": "ffi", "\uFB04": "ffl", "\uFB05": "st", "\uFB06": "st" };

/** Ligature glyphs, non-breaking and zero-width spaces, and control characters, replaced by what a reader expects. */
export function cleanText(text: string): string {
  return (
    text
      .replace(/[\uFB00-\uFB06]/g, (c) => LIGATURES[c] ?? c)
      .replace(/[\u00A0\u2007\u202F]/g, " ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u2060\uFEFF\u00AD]/g, "")
  );
}

/** Groups runs into lines using their positions. Runs are read in the order the PDF stores them. */
export function piecesToLines(pieces: readonly TextPiece[]): TextLine[] {
  const lines: TextLine[] = [];
  let current: TextLine | null = null;
  let pendingBreak = false;

  for (const piece of pieces) {
    const str = cleanText(piece.str);
    if (str === "") {
      if (piece.hasEOL) pendingBreak = true;
      continue;
    }
    const size = Math.max(1, piece.height);
    if (current) {
      const sameBaseline = Math.abs(piece.y - current.y) <= Math.max(1, size * 0.4);
      // A run that starts well to the left of where the line ended has jumped back (a new column or a table cell).
      const jumpedBack = piece.x < current.end - size * 2;
      if (pendingBreak || !sameBaseline || jumpedBack) {
        lines.push(current);
        current = null;
      }
    }
    pendingBreak = piece.hasEOL === true;
    if (!current) {
      current = { text: str, y: piece.y, height: size, end: piece.x + piece.width };
      continue;
    }
    // A gap wider than about a third of the font size is a space. PDFs often omit the space character itself.
    const gap = piece.x - current.end;
    const needsSpace = gap > size * 0.3 && !/\s$/.test(current.text) && !/^\s/.test(str);
    current.text += (needsSpace ? " " : "") + str;
    current.end = Math.max(current.end, piece.x + piece.width);
    current.height = Math.max(current.height, size);
  }
  if (current) lines.push(current);
  return lines;
}

/** One page of pieces to text. Blank lines separate paragraphs when the gap between lines is clearly larger than normal. */
export function assemblePage(pieces: readonly TextPiece[], options: TextOptions = DEFAULT_TEXT_OPTIONS): string {
  const lines = piecesToLines(pieces);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as TextLine;
    const text = line.text.replace(/\s+$/, "");
    const previous = lines[i - 1];
    if (previous) {
      const gap = previous.y - line.y; // positive when this line is lower on the page
      const normal = Math.max(previous.height, line.height) * 1.5;
      if (gap > normal * 1.35 || gap < -normal * 4) out.push("");
    }
    if (options.joinHyphens && out.length > 0) {
      const last = out[out.length - 1] as string;
      // "exam-" at the end of a line and "ple" at the start of the next is one word. A hyphen before a capital or a digit stays.
      if (/[a-zà-ÿ]-$/.test(last) && /^[a-zà-ÿ]/.test(text)) {
        out[out.length - 1] = last.slice(0, -1) + text;
        continue;
      }
    }
    out.push(text);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface DocumentTextOptions extends TextOptions {
  /** Put "--- Page 2 ---" between pages. */
  pageMarkers: boolean;
}

/** Joins the text of every page. Pages without text are kept as markers when markers are on, and left out otherwise. */
export function assembleDocument(pages: readonly string[], options: DocumentTextOptions = { ...DEFAULT_TEXT_OPTIONS, pageMarkers: true }): string {
  const parts: string[] = [];
  pages.forEach((page, index) => {
    const body = page.trim();
    if (options.pageMarkers) parts.push(`--- Page ${index + 1} ---${body ? `\n\n${body}` : "\n\n(no text on this page)"}`);
    else if (body) parts.push(body);
  });
  return parts.join("\n\n");
}

export interface TextCoverage {
  kind: "ok" | "partial" | "none";
  pagesWithText: number;
  message: string;
}

const MIN_CHARS_PER_PAGE = 10;

/** Counts letters and digits, which is a fairer measure of "has text" than whitespace and stray marks. */
export function countCharacters(text: string): number {
  let n = 0;
  for (const ch of text) if (/[\p{L}\p{N}]/u.test(ch)) n++;
  return n;
}

/** Says whether the PDF has real text or is a set of pictures (a scan), judging by how many pages have any. */
export function describeCoverage(pageCharacters: readonly number[]): TextCoverage {
  const total = pageCharacters.length;
  const withText = pageCharacters.filter((n) => n >= MIN_CHARS_PER_PAGE).length;
  if (total === 0 || withText === 0) {
    return {
      kind: "none",
      pagesWithText: 0,
      message: "This PDF has no text that can be copied. It is probably a scan or a set of pictures. Reading text from pictures needs OCR, which this tool does not do.",
    };
  }
  if (withText < total * 0.5) {
    return {
      kind: "partial",
      pagesWithText: withText,
      message: `Only ${withText} of ${total} pages have text. The others are probably scans or pictures, and OCR is not available here.`,
    };
  }
  return { kind: "ok", pagesWithText: withText, message: "" };
}

export interface TextStats {
  characters: number;
  words: number;
  lines: number;
}

export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  return {
    characters: trimmed.length,
    words: trimmed === "" ? 0 : trimmed.split(/\s+/).length,
    lines: trimmed === "" ? 0 : trimmed.split("\n").length,
  };
}

export interface RunCheck {
  refuse?: string;
  warn?: string;
}

export function checkTextRun(fileBytes: number, pageCount: number): RunCheck {
  if (fileBytes > TEXT_LIMITS.maxFileBytes) return { refuse: `This file is ${Math.round(fileBytes / 1024 / 1024)} MB. The limit here is ${TEXT_LIMITS.maxFileBytes / 1024 / 1024} MB.` };
  if (pageCount > TEXT_LIMITS.maxPages) return { refuse: `This PDF has ${pageCount} pages. At most ${TEXT_LIMITS.maxPages} can be read at once; split it first.` };
  if (pageCount > TEXT_LIMITS.warnPages) return { warn: `${pageCount} pages will take a while to read.` };
  return {};
}
