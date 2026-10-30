import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PdfError } from "../src/pdf";
import {
  DPI_CHOICES,
  PAGE_IMAGE_FORMATS,
  PAGE_IMAGE_LIMITS,
  PdfCancelled,
  checkRun,
  formatInfo,
  normalizeQuality,
  overBudget,
  pageImageName,
  planPageImage,
  safeBaseName,
  selectPages,
  zipFileName,
} from "../src/pdf-to-images";

const FIXTURES = join(import.meta.dirname, "fixtures", "pdf");
const A4: [number, number, number, number] = [0, 0, 595.28, 841.89];

describe("selectPages", () => {
  it("means every page when empty or blank", () => {
    expect(selectPages("", 3)).toEqual([0, 1, 2]);
    expect(selectPages("   ", 3)).toEqual([0, 1, 2]);
  });
  it("reads ranges, single pages, open ends and last", () => {
    expect(selectPages("1-3, 5", 10)).toEqual([0, 1, 2, 4]);
    expect(selectPages("8-", 10)).toEqual([7, 8, 9]);
    expect(selectPages("-2", 10)).toEqual([0, 1]);
    expect(selectPages("last", 10)).toEqual([9]);
  });
  it("sorts, removes repeats and tidies backwards ranges", () => {
    expect(selectPages("5, 2, 2, 4-3", 6)).toEqual([1, 2, 3, 4]);
  });
  it("explains a page that does not exist or is not a number", () => {
    expect(() => selectPages("11", 10)).toThrow(/out of range/);
    expect(() => selectPages("0", 10)).toThrow(PdfError);
    expect(() => selectPages("two", 10)).toThrow(/not a valid page number/);
    expect(() => selectPages(",,,", 10)).toThrow(/at least one page/);
  });
  it("refuses a PDF with no pages", () => {
    expect(() => selectPages("", 0)).toThrow(/no pages/);
    expect(() => selectPages("", NaN)).toThrow(PdfError);
  });
  it("handles a very large page count", () => {
    expect(selectPages("", 20_000)).toHaveLength(20_000);
    expect(selectPages("19999-20000", 20_000)).toEqual([19998, 19999]);
  });
});

describe("checkRun", () => {
  it("accepts an ordinary run", () => {
    expect(checkRun(2_000_000, 10)).toEqual({});
  });
  it("warns for many pages and refuses for far too many", () => {
    expect(checkRun(1000, 150).warn).toMatch(/150 pages/);
    expect(checkRun(1000, PAGE_IMAGE_LIMITS.maxPages + 1).refuse).toMatch(/At most 500/);
  });
  it("refuses huge files and empty selections", () => {
    expect(checkRun(300 * 1024 * 1024, 1).refuse).toMatch(/300 MB/);
    expect(checkRun(10, 0).refuse).toMatch(/No pages/);
  });
});

describe("planPageImage", () => {
  it("draws A4 at 150 DPI at about 1240 × 1754 pixels", () => {
    const plan = planPageImage(A4, 0, 150);
    expect(plan.pixelWidth).toBe(1240);
    expect(plan.pixelHeight).toBe(1754);
    expect(plan.capped).toBe(false);
  });
  it("swaps width and height for a page turned a quarter", () => {
    const plan = planPageImage(A4, 90, 72);
    expect(plan.pixelWidth).toBe(842);
    expect(plan.pixelHeight).toBe(595);
  });
  it("lowers the resolution of a poster-sized page instead of failing", () => {
    const plan = planPageImage([0, 0, 5000, 7000], 0, 300);
    expect(plan.capped).toBe(true);
    expect(plan.pixelWidth * plan.pixelHeight).toBeLessThanOrEqual(PAGE_IMAGE_LIMITS.maxPagePixels * 1.01);
  });
  it("rejects a page with no size and a silly resolution", () => {
    expect(() => planPageImage([0, 0, 0, 0], 0, 150)).toThrow(/no size/);
    expect(() => planPageImage(A4, 0, 5)).toThrow(/between 36 and 1200/);
    expect(() => planPageImage(A4, 0, NaN)).toThrow(PdfError);
    expect(() => planPageImage(A4, 0, 5000)).toThrow(PdfError);
  });
  it("copes with a flipped box (corners in the other order) and with odd rotation values", () => {
    expect(planPageImage([595, 842, 0, 0], 0, 72).pixelWidth).toBe(595);
    expect(planPageImage(A4, -90, 72).pixelWidth).toBe(842);
    expect(planPageImage(A4, 450, 72).pixelWidth).toBe(842);
  });
  it("accepts every offered resolution", () => {
    for (const dpi of DPI_CHOICES) expect(planPageImage(A4, 0, dpi).pixelWidth).toBeGreaterThan(0);
  });

  it("plans every page of the real PDF fixtures", async () => {
    const names = readdirSync(FIXTURES).filter((n) => n.endsWith(".pdf") && n !== "corrupt.pdf" && n !== "encrypted.pdf");
    expect(names.length).toBeGreaterThan(3);
    for (const name of names) {
      const doc = await PDFDocument.load(readFileSync(join(FIXTURES, name)));
      for (const page of doc.getPages()) {
        const box = page.getMediaBox();
        const plan = planPageImage([box.x, box.y, box.x + box.width, box.y + box.height], page.getRotation().angle, 150);
        expect(plan.pixelWidth, name).toBeGreaterThan(0);
        expect(plan.pixelHeight, name).toBeGreaterThan(0);
      }
    }
  });
});

describe("pageImageName and friends", () => {
  it("pads page numbers so files sort in page order", () => {
    expect(pageImageName("report", 0, 9, "png")).toBe("report-page-001.png");
    expect(pageImageName("report", 6, 9, "jpg")).toBe("report-page-007.jpg");
    expect(pageImageName("report", 1233, 12345, "png")).toBe("report-page-01234.png");
  });
  it("cleans awkward names", () => {
    expect(safeBaseName("My: file?.pdf")).toBe("My- file");
    expect(safeBaseName("../../etc/passwd.pdf")).toBe("etc-passwd");
    expect(safeBaseName("")).toBe("document");
    expect(safeBaseName(".pdf")).toBe("pdf");
    expect(safeBaseName("   ")).toBe("document");
    expect(safeBaseName("a".repeat(300))).toHaveLength(80);
    expect(safeBaseName("scan\u0000.pdf")).toBe("scan");
  });
  it("never contains a path separator", () => {
    for (const hostile of ["a/b.pdf", "a\\b.pdf", "..\\..\\x.pdf", "C:\\x\\y.pdf"]) {
      expect(safeBaseName(hostile)).not.toMatch(/[\\/:]/);
      expect(pageImageName(hostile, 0, 1, "png")).not.toMatch(/[\\/:]/);
    }
  });
  it("names the zip", () => {
    expect(zipFileName("report.pdf")).toBe("report-pages.zip");
  });
});

describe("PdfCancelled", () => {
  it("is an Error with a name the tools can recognise", () => {
    const err = new PdfCancelled();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PdfCancelled");
    expect(err.message).toBe("Stopped.");
  });
});

describe("formats, quality and budget", () => {
  it("knows each format", () => {
    for (const f of PAGE_IMAGE_FORMATS) expect(formatInfo(f.id).mime).toBe(f.mime);
    expect(formatInfo("jpeg").extension).toBe("jpg");
    expect(formatInfo("png").lossy).toBe(false);
    expect(() => formatInfo("gif" as never)).toThrow(/Unknown/);
  });
  it("keeps quality in range", () => {
    expect(normalizeQuality(90)).toBe(0.9);
    expect(normalizeQuality(5)).toBe(0.4);
    expect(normalizeQuality(500)).toBe(1);
    expect(normalizeQuality(NaN)).toBe(0.9);
  });
  it("stops when pictures pass the memory budget", () => {
    expect(overBudget(1)).toBe(false);
    expect(overBudget(PAGE_IMAGE_LIMITS.maxTotalBytes + 1)).toBe(true);
  });
});
