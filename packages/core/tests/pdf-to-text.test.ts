import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEXT_OPTIONS,
  TEXT_LIMITS,
  assembleDocument,
  assemblePage,
  checkTextRun,
  cleanText,
  countCharacters,
  describeCoverage,
  piecesToLines,
  textStats,
  toPieces,
  type TextPiece,
} from "../src/pdf-to-text";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdf");

/** A run at the left margin on a baseline, 11 points tall unless said otherwise. */
const run = (str: string, x: number, y: number, extra: Partial<TextPiece> = {}): TextPiece => ({ str, x, y, width: str.length * 5.5, height: 11, ...extra });

describe("toPieces", () => {
  it("reads PDF.js text items", () => {
    const pieces = toPieces([{ str: "Hello", dir: "ltr", width: 27.5, height: 11, transform: [11, 0, 0, 11, 54, 700], fontName: "f", hasEOL: true }]);
    expect(pieces).toEqual([{ str: "Hello", x: 54, y: 700, width: 27.5, height: 11, hasEOL: true }]);
  });
  it("skips markers and broken items instead of failing", () => {
    const items: unknown[] = [null, 7, "x", { type: "beginMarkedContent" }, { str: 5, transform: [1, 0, 0, 1, 0, 0] }, { str: "a", transform: [1, 2] }, { str: "b", transform: [1, 0, 0, 1, NaN, 0] }, { str: "ok", transform: [1, 0, 0, 1, 1, 2] }];
    expect(toPieces(items).map((p) => p.str)).toEqual(["ok"]);
  });
  it("falls back to the font size from the matrix and ignores impossible widths", () => {
    const [p] = toPieces([{ str: "a", transform: [0, 12, -12, -12, 5, 6], width: -3, height: NaN }]);
    expect(p?.width).toBe(0);
    expect(p?.height).toBe(12);
    const [q] = toPieces([{ str: "a", transform: [1, 0, 0, 0, 5, 6] }]);
    expect(q?.height).toBe(10);
  });
  it("stops at the per-page limit", () => {
    const many = Array.from({ length: TEXT_LIMITS.maxPiecesPerPage + 50 }, () => ({ str: "a", transform: [1, 0, 0, 1, 0, 0] }));
    expect(toPieces(many)).toHaveLength(TEXT_LIMITS.maxPiecesPerPage);
  });
  it("accepts an empty list", () => {
    expect(toPieces([])).toEqual([]);
  });
});

describe("cleanText", () => {
  it("expands ligatures and normalises odd spaces", () => {
    expect(cleanText("o\uFB03ce \uFB01le\u00A0name")).toBe("office file name");
  });
  it("removes control, zero-width and soft hyphen characters but keeps ordinary text", () => {
    expect(cleanText("a\u0000b\u200Bc\u00ADd\uFEFFe")).toBe("abcde");
    expect(cleanText("naïve — 日本語 😀")).toBe("naïve — 日本語 😀");
  });
});

describe("piecesToLines", () => {
  it("puts runs on the same baseline on one line and adds a space for a gap", () => {
    const lines = piecesToLines([run("Hello", 54, 700), run("world", 54 + 5 * 5.5 + 4, 700)]);
    expect(lines.map((l) => l.text)).toEqual(["Hello world"]);
  });
  it("does not add a space when runs touch (a word split into styled pieces)", () => {
    const lines = piecesToLines([run("Hel", 54, 700), run("lo", 54 + 3 * 5.5, 700)]);
    expect(lines[0]?.text).toBe("Hello");
  });
  it("does not double an existing space", () => {
    const lines = piecesToLines([run("Hello ", 54, 700), run("world", 54 + 6 * 5.5 + 10, 700)]);
    expect(lines[0]?.text).toBe("Hello world");
  });
  it("starts a new line when the baseline moves or the PDF ends the line", () => {
    expect(piecesToLines([run("one", 54, 700), run("two", 54, 686)]).map((l) => l.text)).toEqual(["one", "two"]);
    expect(piecesToLines([run("one", 54, 700, { hasEOL: true }), run("two", 100, 700)]).map((l) => l.text)).toEqual(["one", "two"]);
  });
  it("starts a new line when a run jumps back to the left (a second column)", () => {
    const lines = piecesToLines([run("left column text", 54, 700), run("right", 300, 700), run("back", 54, 700)]);
    expect(lines.map((l) => l.text)).toEqual(["left column text right", "back"]);
  });
  it("ignores empty runs but honours their line end", () => {
    const lines = piecesToLines([run("one", 54, 700), run("", 54, 700, { hasEOL: true }), run("two", 54, 700)]);
    expect(lines.map((l) => l.text)).toEqual(["one", "two"]);
  });
  it("returns nothing for nothing", () => {
    expect(piecesToLines([])).toEqual([]);
    expect(piecesToLines([run("", 0, 0), run("", 0, 0)])).toEqual([]);
  });
});

describe("assemblePage", () => {
  it("makes a paragraph break where the gap is clearly bigger", () => {
    const text = assemblePage([run("First line", 54, 700), run("second line", 54, 686), run("New paragraph", 54, 650)]);
    expect(text).toBe("First line\nsecond line\n\nNew paragraph");
  });
  it("joins a word split by a hyphen at the line end, but not before a capital or a number", () => {
    expect(assemblePage([run("an exam-", 54, 700), run("ple of it", 54, 686)])).toBe("an example of it");
    expect(assemblePage([run("Smith-", 54, 700), run("Jones", 54, 686)])).toBe("Smith-\nJones");
    expect(assemblePage([run("page 3-", 54, 700), run("4 of it", 54, 686)])).toBe("page 3-\n4 of it");
    expect(assemblePage([run("an exam-", 54, 700), run("ple", 54, 686)], { joinHyphens: false })).toBe("an exam-\nple");
  });
  it("keeps a hyphen that is a dash", () => {
    expect(assemblePage([run("wait -", 54, 700), run("then go", 54, 686)])).toBe("wait -\nthen go");
  });
  it("copes with text that is not in top-to-bottom order", () => {
    const text = assemblePage([run("footer", 54, 40), run("title", 54, 740)]);
    expect(text.split("\n").filter(Boolean)).toEqual(["footer", "title"]);
  });
  it("handles unicode, emoji and right-to-left text without damaging it", () => {
    expect(assemblePage([run("héllo 😀 日本語", 54, 700), run("שלום עולם", 54, 686)])).toBe("héllo 😀 日本語\nשלום עולם");
  });
  it("returns an empty string for an empty page", () => {
    expect(assemblePage([])).toBe("");
    expect(assemblePage([run("   ", 54, 700)])).toBe("");
  });
  it("copes with a very large page quickly", () => {
    const pieces: TextPiece[] = [];
    for (let line = 0; line < 5000; line++) for (let w = 0; w < 20; w++) pieces.push(run("word", 54 + w * 30, 800 - line * 12));
    const started = Date.now();
    const text = assemblePage(pieces);
    expect(text.split("\n")).toHaveLength(5000);
    expect(Date.now() - started).toBeLessThan(3000);
  });
  it("survives hostile numbers", () => {
    const text = assemblePage([run("a", 0, 0, { width: Infinity, height: -5 }), run("b", Number.MAX_VALUE, 1e300), run("c", -1e300, -1e300)]);
    expect(typeof text).toBe("string");
  });
  it("default options join hyphens", () => {
    expect(DEFAULT_TEXT_OPTIONS.joinHyphens).toBe(true);
  });
});

describe("assembleDocument", () => {
  it("separates pages with markers and notes empty pages", () => {
    expect(assembleDocument(["one", "", "three"], { ...DEFAULT_TEXT_OPTIONS, pageMarkers: true })).toBe("--- Page 1 ---\n\none\n\n--- Page 2 ---\n\n(no text on this page)\n\n--- Page 3 ---\n\nthree");
  });
  it("leaves out markers and empty pages when asked", () => {
    expect(assembleDocument(["one", "", "three"], { ...DEFAULT_TEXT_OPTIONS, pageMarkers: false })).toBe("one\n\nthree");
  });
  it("returns an empty string for no pages", () => {
    expect(assembleDocument([], { ...DEFAULT_TEXT_OPTIONS, pageMarkers: false })).toBe("");
  });
});

describe("describeCoverage", () => {
  it("is fine for ordinary documents", () => {
    expect(describeCoverage([500, 400, 600]).kind).toBe("ok");
  });
  it("says a scan has nothing to copy and that OCR is not available", () => {
    const none = describeCoverage([0, 0, 3]);
    expect(none.kind).toBe("none");
    expect(none.message).toMatch(/OCR/);
    expect(describeCoverage([]).kind).toBe("none");
  });
  it("warns when most pages are pictures", () => {
    const partial = describeCoverage([500, 0, 0, 0]);
    expect(partial.kind).toBe("partial");
    expect(partial.message).toMatch(/1 of 4/);
  });
  it("is fine when half the pages have text", () => {
    expect(describeCoverage([500, 0]).kind).toBe("ok");
  });
});

describe("countCharacters and textStats", () => {
  it("counts letters and digits only, in any script", () => {
    expect(countCharacters("a b, 1! 日本")).toBe(5);
    expect(countCharacters("   \n\n")).toBe(0);
  });
  it("counts words, characters and lines", () => {
    expect(textStats("one two\nthree")).toEqual({ characters: 13, words: 3, lines: 2 });
    expect(textStats("")).toEqual({ characters: 0, words: 0, lines: 0 });
    expect(textStats(" \n ")).toEqual({ characters: 0, words: 0, lines: 0 });
  });
});

describe("checkTextRun", () => {
  it("accepts, warns and refuses", () => {
    expect(checkTextRun(1000, 10)).toEqual({});
    expect(checkTextRun(1000, 600).warn).toMatch(/600 pages/);
    expect(checkTextRun(1000, 5000).refuse).toMatch(/5000 pages/);
    expect(checkTextRun(500 * 1024 * 1024, 1).refuse).toMatch(/500 MB/);
  });
});

/**
 * PDF.js is a reader that was not written for these fixtures. This reads real PDFs with it, in Node, and checks the
 * whole chain from file to text. (The browser build is used in the tool; the "legacy" build is the Node one.)
 */
describe("real PDF files read by PDF.js", () => {
  async function pagesOf(name: string, options: { joinHyphens: boolean } = DEFAULT_TEXT_OPTIONS) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(join(FIXTURES, name)));
    const task = pdfjs.getDocument({ data, useWasm: false, isEvalSupported: false, useSystemFonts: false, verbosity: 0 } as never);
    const doc = await task.promise;
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out.push(assemblePage(toPieces(content.items as unknown[]), options));
    }
    await task.destroy();
    return out;
  }

  it("reads the text-only file page by page, with lines in order", async () => {
    const pages = await pagesOf("text-only.pdf");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatch(/^Text only, page 1\n/);
    expect(pages[1]).toMatch(/^Text only, page 2\n/);
    const lines = (pages[0] as string).split("\n").filter(Boolean);
    expect(lines[1]).toBe("Line 1: the quick brown fox jumps over the lazy dog.");
    expect(lines.length).toBeGreaterThan(20);
    const numbered = lines.filter((l) => /^Line \d+:/.test(l)).map((l) => Number(/^Line (\d+):/.exec(l)?.[1]));
    expect(numbered).toEqual([...numbered].sort((a, b) => a - b));
  });

  it("reads titles from picture-heavy files and reports the coverage honestly", async () => {
    const pages = await pagesOf("photo-heavy.pdf");
    expect(pages).toEqual(["Photo page 1", "Photo page 2", "Photo page 3"]);
    expect(describeCoverage(pages.map(countCharacters)).kind).toBe("ok");
  });

  it("finds no text in a page that is only a picture", async () => {
    const pages = await pagesOf("rotated-photo.pdf");
    expect(pages).toEqual([""]);
    expect(describeCoverage(pages.map(countCharacters)).kind).toBe("none");
  });

  it("builds the whole document text", async () => {
    const pages = await pagesOf("text-only.pdf");
    const text = assembleDocument(pages, { ...DEFAULT_TEXT_OPTIONS, pageMarkers: true });
    expect(text.startsWith("--- Page 1 ---\n\nText only, page 1")).toBe(true);
    expect(text).toContain("--- Page 2 ---");
  });
});
