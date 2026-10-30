import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, degrees } from "pdf-lib";
import { scanContent } from "../packages/core/src/pdf-compress";
import { displaySize, readPageGeometry, userToDisplay } from "../packages/core/src/pdf-sign";
import { unzipSync } from "fflate";
import { appAlert, makeJpeg, makePng, trackRequests, withExifOrientation } from "./helpers";

async function samplePdf(pages: number, label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${label} title`);
  doc.setAuthor("Test Author");
  for (let i = 0; i < pages; i++) doc.addPage([300 + i * 10, 400]).drawText(`${label} page ${i + 1}`, { x: 30, y: 200 });
  return Buffer.from(await doc.save());
}

async function pageCount(path: string): Promise<number> {
  return (await PDFDocument.load(await readFile(path))).getPageCount();
}

test.describe("PDF tools in a real browser", () => {
  test("merge PDFs: add, reorder, merge, download, nothing uploaded", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    await page.goto("/tools/merge-pdf");
    await page.locator('input[type="file"]').setInputFiles([
      { name: "first.pdf", mimeType: "application/pdf", buffer: await samplePdf(2, "A") },
      { name: "second.pdf", mimeType: "application/pdf", buffer: await samplePdf(3, "B") },
    ]);
    await expect(page.getByText("1. first.pdf")).toBeVisible();
    await expect(page.getByText("2. second.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Move second.pdf up" }).click();
    await expect(page.getByText("1. second.pdf")).toBeVisible();

    await page.getByRole("button", { name: /Merge 2 PDFs \(5 pages\)/ }).click();
    await expect(page.getByText("Done! Your file is ready.")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(download.suggestedFilename()).toBe("merged.pdf");
    expect(await pageCount((await download.path())!)).toBe(5);
    expect(tracker.external(baseURL!)).toEqual([]);
    expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
  });

  test("merge rejects non-PDF files with a clear message", async ({ page }) => {
    await page.goto("/tools/merge-pdf");
    await page.locator('input[type="file"]').setInputFiles([{ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a pdf") }]);
    await expect(page.getByText(/notes\.pdf: not a PDF/)).toBeVisible();
  });

  test("split PDF into single pages and download a ZIP", async ({ page }) => {
    await page.goto("/tools/split-pdf");
    await page.locator('input[type="file"]').setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: await samplePdf(3, "R") });
    await expect(page.getByText("3 pages")).toBeVisible();
    await page.getByRole("button", { name: "Split PDF", exact: true }).click();
    await expect(page.getByText("Created 3 files.")).toBeVisible();
    const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download all/ }).click()]);
    const entries = unzipSync(new Uint8Array(await readFile((await zip.path())!)));
    expect(Object.keys(entries).sort()).toEqual(["report-1.pdf", "report-2.pdf", "report-3.pdf"]);
  });

  test("extract and delete pages", async ({ page }) => {
    await page.goto("/tools/extract-pdf-pages");
    await page.locator('input[type="file"]').setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await samplePdf(6, "D") });
    await page.getByLabel("Pages to keep").fill("2-3, 6");
    await page.getByRole("button", { name: "Extract pages" }).click();
    const [extracted] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(await pageCount((await extracted.path())!)).toBe(3);

    await page.goto("/tools/delete-pdf-pages");
    await page.locator('input[type="file"]').setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await samplePdf(6, "D") });
    await page.getByLabel("Pages to delete").fill("1, 4-5");
    await page.getByRole("button", { name: "Delete pages" }).click();
    const [remaining] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(await pageCount((await remaining.path())!)).toBe(3);
  });

  test("invalid page ranges show a helpful error", async ({ page }) => {
    await page.goto("/tools/extract-pdf-pages");
    await page.locator('input[type="file"]').setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await samplePdf(2, "D") });
    await page.getByLabel("Pages to keep").fill("9");
    await page.getByRole("button", { name: "Extract pages" }).click();
    await expect(appAlert(page)).toContainText("out of range");
  });

  test("rotate, number and watermark PDFs", async ({ page }) => {
    await page.goto("/tools/rotate-pdf");
    await page.locator('input[type="file"]').setInputFiles({ name: "r.pdf", mimeType: "application/pdf", buffer: await samplePdf(2, "R") });
    await page.getByRole("button", { name: "Rotate PDF", exact: true }).click();
    const [rotated] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    const doc = await PDFDocument.load(await readFile((await rotated.path())!));
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 90]);

    await page.goto("/tools/pdf-page-numbers");
    await page.locator('input[type="file"]').setInputFiles({ name: "n.pdf", mimeType: "application/pdf", buffer: await samplePdf(2, "N") });
    await page.getByRole("button", { name: "Add page numbers" }).click();
    await expect(page.getByText("Done! Your file is ready.")).toBeVisible();

    await page.goto("/tools/pdf-watermark");
    await page.locator('input[type="file"]').setInputFiles({ name: "w.pdf", mimeType: "application/pdf", buffer: await samplePdf(1, "W") });
    await page.getByRole("button", { name: "Add watermark" }).click();
    await expect(page.getByText("Done! Your file is ready.")).toBeVisible();
  });

  test("metadata editor shows, edits and strips properties", async ({ page }) => {
    await page.goto("/tools/pdf-metadata-editor");
    await page.locator('input[type="file"]').setInputFiles({ name: "m.pdf", mimeType: "application/pdf", buffer: await samplePdf(1, "Secret") });
    await expect(page.getByLabel("Title")).toHaveValue("Secret title");
    await expect(page.getByLabel("Author")).toHaveValue("Test Author");
    await page.getByRole("button", { name: "Remove all metadata" }).click();
    const [clean] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    const doc = await PDFDocument.load(await readFile((await clean.path())!), { updateMetadata: false });
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
  });

  test("images to PDF", async ({ page }) => {
    await page.goto("/tools/images-to-pdf");
    const png = await makePng(page, 200, 100);
    await page.locator('input[type="file"]').setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: png },
      { name: "two.png", mimeType: "image/png", buffer: png },
    ]);
    await page.getByRole("button", { name: /Create PDF from 2 images/ }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(await pageCount((await download.path())!)).toBe(2);
  });

  test("organizer: move, remove and turn pages, then download", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    await page.goto("/tools/pdf-organizer");
    await page.locator('input[type="file"]').setInputFiles({ name: "deck.pdf", mimeType: "application/pdf", buffer: await samplePdf(4, "O") });
    await expect(page.getByText("4 pages in the new file")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create PDF" })).toBeDisabled();

    await page.getByRole("button", { name: "Move page 4, now at position 4 up" }).click(); // 1, 2, 4, 3
    await page.getByRole("button", { name: "Remove page 1, now at position 1" }).click(); // 2, 4, 3
    await page.getByRole("button", { name: "Turn page 2, now at position 1 clockwise" }).click();
    await expect(page.getByText("3 pages in the new file · 1 of the original left out")).toBeVisible();
    await expect(page.getByText("Turned 90°")).toBeVisible();

    await page.getByRole("button", { name: "Create PDF" }).click();
    await expect(page.getByText("Done! Your file is ready.")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(download.suggestedFilename()).toBe("deck-organized.pdf");
    const doc = await PDFDocument.load(await readFile((await download.path())!));
    // Page i is 300 + 10 * (i - 1) points wide, so widths identify the pages.
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([310, 330, 320]);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 0, 0]);
    expect(tracker.external(baseURL!)).toEqual([]);
  });

  test("organizer: collates a double-sided scan and explains an odd page count", async ({ page }) => {
    await page.goto("/tools/pdf-organizer");
    await page.locator('input[type="file"]').setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: await samplePdf(4, "S") });
    await page.getByRole("button", { name: "Collate double-sided scan" }).click(); // 1, 4, 2, 3
    await page.getByRole("button", { name: "Create PDF" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect((await PDFDocument.load(await readFile((await download.path())!))).getPages().map((p) => p.getWidth())).toEqual([300, 330, 310, 320]);

    await page.goto("/tools/pdf-organizer");
    await page.locator('input[type="file"]').setInputFiles({ name: "odd.pdf", mimeType: "application/pdf", buffer: await samplePdf(3, "S") });
    await page.getByRole("button", { name: "Collate double-sided scan" }).click();
    await expect(appAlert(page)).toContainText("even number of pages");
  });
});

const PDF_FIXTURES = join(__dirname, "..", "packages", "core", "tests", "fixtures", "pdf");

/** A PDF whose pages each hold the same large photo, drawn 6 inches wide, with a line of real text. */
async function photoPdf(jpeg: Buffer, pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont("Helvetica");
  const image = await doc.embedJpg(jpeg);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Photo page ${i + 1}`, { x: 54, y: 740, size: 18, font });
    page.drawImage(image, { x: 90, y: 250, width: 432, height: (432 * image.height) / image.width });
  }
  return Buffer.from(await doc.save());
}

const hex = (text: string) => Buffer.from(text).toString("hex").toUpperCase();

/** The drawing instructions of a page, decoded, so tests can look for text. */
function pageContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const streams = contents && "size" in contents ? Array.from({ length: contents.size() }, (_, i) => doc.context.lookup(contents.get(i))) : [contents];
  return streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString("latin1")).join("\n");
}

function imageSizes(doc: PDFDocument): [number, number][] {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, o]) => o)
    .filter((o): o is PDFRawStream => o instanceof PDFRawStream && o.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"))
    .map((o) => [Number(o.dict.get(PDFName.of("Width"))), Number(o.dict.get(PDFName.of("Height")))]);
}

test.describe("Compress PDF in a real browser", () => {
  test("Keep text shrinks the photos, keeps the text and uploads nothing", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    const violations: string[] = [];
    page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    await page.goto("/tools/compress-pdf");
    const original = await photoPdf(await makeJpeg(page), 3);
    await page.locator('input[type="file"]').setInputFiles({ name: "album.pdf", mimeType: "application/pdf", buffer: original });
    await expect(page.getByText("Images take")).toBeVisible();

    await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
    await expect(page.getByText("Your smaller file is ready.")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("compress-sizes")).toContainText("→");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    expect(download.suggestedFilename()).toBe("album-compressed.pdf");
    const bytes = await readFile((await download.path())!);
    expect(bytes.length).toBeLessThan(original.length);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    // The photo is 1200 px over 6 inches (200 dpi); Balanced allows 150 dpi, so it is scaled to 900 px.
    expect(imageSizes(doc)).toEqual([[900, 675]]);
    // Text is still real text.
    expect(pageContent(doc, 0)).toContain(hex("Photo page 1"));

    expect(tracker.external(baseURL!)).toEqual([]);
    expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
    expect(violations).toEqual([]);
  });

  test("a photo with an EXIF rotation is not turned or squashed", async ({ page }) => {
    await page.goto("/tools/compress-pdf");
    const rotated = withExifOrientation(await makeJpeg(page, 1200, 900), 6);
    await page.locator('input[type="file"]').setInputFiles({ name: "exif.pdf", mimeType: "application/pdf", buffer: await photoPdf(rotated, 1) });
    await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
    await expect(page.getByText("Your smaller file is ready.")).toBeVisible({ timeout: 60_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    // Still landscape (wider than tall), as stored. A browser that applied the EXIF turn would have given 675 x 900.
    expect(imageSizes(await PDFDocument.load(await readFile((await download.path())!)))).toEqual([[900, 675]]);
  });

  test("Smallest file warns first, then replaces the text with pictures", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const tracker = trackRequests(page);
    const violations: string[] = [];
    page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    await page.goto("/tools/compress-pdf");
    const original = await photoPdf(await makeJpeg(page), 2);
    await page.locator('input[type="file"]').setInputFiles({ name: "album.pdf", mimeType: "application/pdf", buffer: original });
    await expect(page.getByText("Images take")).toBeVisible();

    await page.getByRole("radio", { name: "Smallest file" }).check({ force: true });
    await expect(page.getByText("This removes selectable text")).toBeVisible();
    await expect(page.getByText(/lose selectable and searchable text, copy and paste, links, fillable fields, bookmarks/)).toBeVisible();
    await page.getByRole("radio", { name: "Strong" }).check({ force: true });

    await page.getByRole("button", { name: "Flatten pages and compress" }).click();
    await expect(page.getByText("Your smaller file is ready.")).toBeVisible({ timeout: 90_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    const bytes = await readFile((await download.path())!);
    expect(bytes.length).toBeLessThan(original.length);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([
      [612, 792],
      [612, 792],
    ]);
    for (const index of [0, 1]) {
      const content = pageContent(doc, index);
      expect(content).not.toContain(hex(`Photo page ${index + 1}`));
      expect(content).not.toContain("Tj");
    }
    expect(imageSizes(doc)).toHaveLength(2);

    expect(tracker.external(baseURL!)).toEqual([]);
    expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
    expect(violations).toEqual([]);
  });

  test("Smallest file keeps a turned page the right way up", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/tools/compress-pdf");
    await page.locator('input[type="file"]').setInputFiles(join(PDF_FIXTURES, "rotated-photo.pdf"));
    await page.getByRole("radio", { name: "Smallest file" }).check({ force: true });
    await page.getByRole("radio", { name: "Strong" }).check({ force: true });
    await page.getByRole("button", { name: "Flatten pages and compress" }).click();
    await expect(page.getByText("Your smaller file is ready.")).toBeVisible({ timeout: 90_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download", exact: true }).click()]);
    const doc = await PDFDocument.load(await readFile((await download.path())!));
    // The source page is 612 x 792 turned 90 degrees, so it is shown landscape. The new page is landscape with no turn of its own.
    expect([doc.getPage(0).getWidth(), doc.getPage(0).getHeight(), doc.getPage(0).getRotation().angle]).toEqual([792, 612, 0]);
  });

  test("a PDF with no images explains itself and offers the original", async ({ page }) => {
    await page.goto("/tools/compress-pdf");
    await page.locator('input[type="file"]').setInputFiles(join(PDF_FIXTURES, "text-only.pdf"));
    await expect(page.getByText("This PDF has no images")).toBeVisible();
    await expect(page.getByRole("button", { name: "Compress PDF", exact: true })).toBeDisabled();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download original" }).click()]);
    expect(download.suggestedFilename()).toBe("text-only.pdf");
  });

  test("images that are already small give no smaller file, and the original is offered", async ({ page }) => {
    await page.goto("/tools/compress-pdf");
    const doc = await PDFDocument.create();
    const image = await doc.embedJpg(await readFile(join(PDF_FIXTURES, "recompressed-rgb.jpg")));
    doc.addPage([300, 300]).drawImage(image, { x: 20, y: 20, width: 250, height: 188 });
    await page.locator('input[type="file"]').setInputFiles({ name: "tiny.pdf", mimeType: "application/pdf", buffer: Buffer.from(await doc.save()) });
    await page.getByRole("button", { name: "Compress PDF", exact: true }).click();
    await expect(page.getByText("This could not be made smaller")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Your smaller file is ready.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Download original" })).toBeVisible();
  });

  test("encrypted, damaged and non-PDF files get a readable error", async ({ page }) => {
    await page.goto("/tools/compress-pdf");
    await page.locator('input[type="file"]').setInputFiles(join(PDF_FIXTURES, "encrypted.pdf"));
    await expect(appAlert(page)).toContainText("password-protected");
    await page.locator('input[type="file"]').setInputFiles(join(PDF_FIXTURES, "corrupt.pdf"));
    await expect(appAlert(page)).toContainText("could not be read");
    await page.locator('input[type="file"]').setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a pdf at all") });
    await expect(appAlert(page)).toContainText("does not look like a PDF");
  });

  test("a file over the size limit is refused before it is read", async ({ page }) => {
    const huge = join(tmpdir(), `toolwright-huge-${process.pid}.pdf`);
    await writeFile(huge, Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(201 * 1024 * 1024)]));
    try {
      await page.goto("/tools/compress-pdf");
      await page.locator('input[type="file"]').setInputFiles(huge);
      await expect(appAlert(page)).toContainText("up to 200 MB");
      await expect(appAlert(page)).toContainText("Split PDF");
      await expect(page.getByRole("button", { name: "Compress PDF", exact: true })).toHaveCount(0);
    } finally {
      await rm(huge, { force: true });
    }
  });

  test("Cancel stops a long job and leaves the original alone", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/tools/compress-pdf");
    await page.locator('input[type="file"]').setInputFiles({ name: "long.pdf", mimeType: "application/pdf", buffer: await photoPdf(await makeJpeg(page), 80) });
    await page.getByRole("radio", { name: "Smallest file" }).check({ force: true });
    await page.getByRole("button", { name: "Flatten pages and compress" }).click();
    await expect(page.getByRole("progressbar")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Cancelled. Your original file is untouched.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Flatten pages and compress" })).toBeEnabled();
    await expect(page.getByText("Your smaller file is ready.")).toHaveCount(0);
  });
});

/** Where the signature picture ended up on a page, as a reader sees it (fractions of the shown page), found by replaying the page's drawing instructions. */
async function signaturePlacement(bytes: Buffer, pageIndex: number) {
  const g = (await readPageGeometry(new Uint8Array(bytes)))[pageIndex]!;
  const shown = displaySize(g);
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(pageIndex).node.Contents();
  const streams = contents && "size" in contents ? Array.from({ length: contents.size() }, (_, i) => doc.context.lookup(contents.get(i))) : [contents];
  const text = streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString("latin1")).join("\n");
  let matrix: number[] | null = null;
  scanContent(text, [1, 0, 0, 1, 0, 0], { onDo: (_n, ctm) => (matrix = [...ctm]) });
  if (!matrix) return null;
  const [a, b, c, d, e, f] = matrix as number[];
  const at = (px: number, py: number) => userToDisplay(g, a! * px + c! * py + e!, b! * px + d! * py + f!);
  const topLeft = at(0, 1);
  const bottomLeft = at(0, 0);
  const bottomRight = at(1, 0);
  return { left: topLeft.u / shown.width, top: topLeft.v / shown.height, width: (bottomRight.u - bottomLeft.u) / shown.width, upright: topLeft.v < bottomLeft.v && bottomRight.u > bottomLeft.u };
}

test.describe("Sign PDF", () => {
  async function turnedPdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont("Helvetica");
    const first = doc.addPage([612, 792]);
    first.setRotation(degrees(90));
    first.drawText("Contract, page 1 (stored turned)", { x: 60, y: 700, size: 18, font });
    doc.addPage([612, 792]).drawText("Contract, page 2", { x: 60, y: 700, size: 18, font });
    return Buffer.from(await doc.save());
  }

  async function draw(page: import("@playwright/test").Page) {
    const pad = page.getByLabel(/^Signature pad/);
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.6);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) await page.mouse.move(box.x + box.width * (0.1 + i * 0.03), box.y + box.height * (0.5 + 0.25 * Math.sin(i / 2)));
    await page.mouse.up();
  }

  test("draw it, nudge it with the keyboard, and it lands upright on a page that is stored turned", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const tracker = trackRequests(page);
    const violations: string[] = [];
    page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    await page.goto("/tools/sign-pdf");
    await page.locator('input[type="file"]').setInputFiles({ name: "contract.pdf", mimeType: "application/pdf", buffer: await turnedPdf() });
    await expect(page.getByText("Make a signature above")).toBeVisible();
    await draw(page);
    const box = page.getByTestId("signature-box");
    await expect(box).toBeVisible();
    await expect(page.getByAltText("Page 1 of the PDF")).toBeVisible({ timeout: 30_000 });

    await box.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft"); // 0.55 -> 0.45
    await page.getByRole("button", { name: "Sign PDF", exact: true }).click();
    await expect(page.getByText("Done! Your file is ready.")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(download.suggestedFilename()).toBe("contract-signed.pdf");
    const signed = await readFile((await download.path())!);

    const placed = (await signaturePlacement(signed, 0))!;
    expect(placed.upright).toBe(true);
    expect(placed.left).toBeCloseTo(0.45, 2);
    expect(placed.top).toBeCloseTo(0.8, 2);
    expect(placed.width).toBeCloseTo(0.3, 2);
    // Only the page that was shown was signed.
    expect(await signaturePlacement(signed, 1)).toBeNull();
    expect((await PDFDocument.load(signed)).getPageCount()).toBe(2);

    expect(tracker.external(baseURL!)).toEqual([]);
    expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
    expect(violations).toEqual([]);
  });

  test("type it, sign every page and print a date line", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/tools/sign-pdf");
    await page.locator('input[type="file"]').setInputFiles({ name: "contract.pdf", mimeType: "application/pdf", buffer: await turnedPdf() });
    await page.getByRole("radio", { name: "Type" }).check({ force: true });
    await page.getByLabel("Your name").fill("Ada Lovelace");
    await expect(page.getByTestId("signature-box")).toBeVisible();
    await page.getByRole("radio", { name: "Every page" }).check({ force: true });
    await page.getByRole("switch", { name: /Print a line of text/ }).check({ force: true });
    await page.getByLabel("Text under the signature", { exact: true }).fill("Signed 2026-03-15");
    await page.getByRole("button", { name: "Sign 2 pages" }).click();
    await expect(page.getByText("2 pages signed")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    const signed = await readFile((await download.path())!);
    for (const index of [0, 1]) {
      const placed = (await signaturePlacement(signed, index))!;
      expect(placed.upright).toBe(true);
      expect(placed.left).toBeCloseTo(0.55, 2);
    }
    expect(pageContent(await PDFDocument.load(signed), 1)).toContain(hex("Signed 2026-03-15"));
  });

  test("warns when the file already carries a digital signature, and refuses signing without a signature", async ({ page }) => {
    await page.goto("/tools/sign-pdf");
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    doc.context.register(doc.context.obj({ Type: "Sig", ByteRange: [0, 10, 20, 30] }));
    await page.locator('input[type="file"]').setInputFiles({ name: "signed.pdf", mimeType: "application/pdf", buffer: Buffer.from(await doc.save({ useObjectStreams: false })) });
    await expect(page.getByRole("status").filter({ hasText: "looks digitally signed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign PDF", exact: true })).toBeDisabled();
    await expect(page.getByText("A picture of a signature, not a digital signature")).toBeVisible();
  });

  test("a non-PDF is refused with a clear message", async ({ page }) => {
    await page.goto("/tools/sign-pdf");
    await page.locator('input[type="file"]').setInputFiles({ name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("nope, not a pdf") });
    await expect(appAlert(page)).toContainText("does not look like a PDF");
  });
});

test.describe("PDF Page Organizer previews", () => {
  const previews = (page: import("@playwright/test").Page) => page.locator('ol[aria-label="Pages of the new file"] img');

  test("each page gets a real preview that turns with the page and stays on the device", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    const violations: string[] = [];
    page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    await page.goto("/tools/pdf-organizer");
    await page.locator('input[type="file"]').setInputFiles({ name: "deck.pdf", mimeType: "application/pdf", buffer: await samplePdf(4, "T") });
    await expect(previews(page)).toHaveCount(4, { timeout: 30_000 });

    // Pages are 300, 310, 320 and 330 points wide and 400 tall, so the previews grow wider in that order.
    const sizes = await previews(page).evaluateAll((images) => (images as HTMLImageElement[]).map((i) => [i.naturalWidth, i.naturalHeight]));
    expect(sizes.map(([w]) => w as number)).toEqual([...sizes.map(([w]) => w as number)].sort((a, b) => a - b));
    expect(new Set(sizes.map(([w]) => w)).size).toBe(4);
    for (const [, h] of sizes) expect(h).toBeGreaterThanOrEqual(160);

    // The preview shows the page, not a blank sheet: the line of text leaves dark pixels.
    const darkPixels = await previews(page).first().evaluate((img) => {
      const image = img as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if ((data[i] as number) < 110) dark++;
      return dark;
    });
    expect(darkPixels).toBeGreaterThan(20);

    await page.getByRole("button", { name: "Turn page 1, now at position 1 clockwise" }).click();
    await expect(previews(page).first()).toHaveAttribute("style", /rotate\(90deg\)/);
    await expect(previews(page)).toHaveCount(4);

    expect(tracker.external(baseURL!)).toEqual([]);
    expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
    expect(violations).toEqual([]);
  });

  test("a long document only draws the rows that are on screen", async ({ page }) => {
    await page.goto("/tools/pdf-organizer");
    await page.locator('input[type="file"]').setInputFiles({ name: "long.pdf", mimeType: "application/pdf", buffer: await samplePdf(300, "L") });
    await expect(previews(page).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const drawn = await previews(page).count();
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(60);
    // Scrolling to the end draws the last page.
    await page.getByRole("button", { name: "Remove page 300, now at position 300" }).scrollIntoViewIfNeeded();
    await expect.poll(() => previews(page).count(), { timeout: 20_000 }).toBeGreaterThan(drawn);
  });

  test("a text-only PDF gets previews too", async ({ page }) => {
    await page.goto("/tools/pdf-organizer");
    await page.locator('input[type="file"]').setInputFiles(join(PDF_FIXTURES, "text-only.pdf"));
    await expect(page.getByText("2 pages in the new file")).toBeVisible();
    await expect(previews(page)).toHaveCount(2, { timeout: 30_000 });
  });
});

test.describe("image tools in a real browser", () => {
  test("compressor shrinks an image and keeps it on-device", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    await page.goto("/tools/image-compressor");
    const png = await makePng(page, 800, 600);
    await page.locator('input[type="file"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
    await page.getByLabel("Output format").selectOption("image/webp");
    await expect(page.getByText("photo-compressed.webp")).toBeVisible();
    await expect(page.getByText(/−\d+%/)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(download.suggestedFilename()).toBe("photo-compressed.webp");
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
    expect(bytes.length).toBeLessThan(png.length);
    expect(tracker.external(baseURL!)).toEqual([]);
  });

  test("resizer fits within a maximum width", async ({ page }) => {
    await page.goto("/tools/image-resizer");
    const png = await makePng(page, 800, 400);
    await page.locator('input[type="file"]').setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: png });
    await page.getByLabel("Max width").fill("200");
    await expect(page.getByText("800×400 → 200×100")).toBeVisible();
  });

  test("favicon generator packs icons into a ZIP without uploading", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    await page.goto("/tools/favicon-generator");
    await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await makePng(page, 600, 600) });
    await page.getByRole("button", { name: "Create favicon pack" }).click();
    await expect(page.getByText("Done! Your file is ready.")).toBeVisible();
    await expect(page.getByLabel("HTML to paste into the head of your pages")).toHaveValue(/rel="apple-touch-icon" href="\/apple-touch-icon.png"/);

    const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(zip.suggestedFilename()).toBe("favicons.zip");
    const files = unzipSync(new Uint8Array(await readFile((await zip.path())!)));
    expect(Object.keys(files).sort()).toEqual([
      "android-chrome-192x192.png",
      "android-chrome-512x512.png",
      "apple-touch-icon.png",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "favicon.ico",
      "head-snippet.html",
      "site.webmanifest",
    ]);

    // The PNG header stores width and height; check the sizes are what the names promise.
    const size = (name: string) => {
      const view = new DataView(files[name]!.buffer, files[name]!.byteOffset);
      return [view.getUint32(16), view.getUint32(20)];
    };
    expect(size("favicon-16x16.png")).toEqual([16, 16]);
    expect(size("apple-touch-icon.png")).toEqual([180, 180]);
    expect(size("android-chrome-512x512.png")).toEqual([512, 512]);

    // An .ico file: reserved 0, type 1, three images (16, 32, 48).
    const ico = files["favicon.ico"]!;
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
    expect([ico[6], ico[22], ico[38]]).toEqual([16, 32, 48]);
    expect(JSON.parse(new TextDecoder().decode(files["site.webmanifest"]!)).icons).toHaveLength(2);
    expect(tracker.external(baseURL!)).toEqual([]);
  });

  test("favicon generator rejects a file that is not an image", async ({ page }) => {
    await page.goto("/tools/favicon-generator");
    await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
    await expect(appAlert(page)).toContainText("could not be read");
  });

  test("converter handles several files and offers a ZIP", async ({ page }) => {
    await page.goto("/tools/image-converter");
    const png = await makePng(page, 120, 80);
    await page.locator('input[type="file"]').setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: png },
      { name: "b.png", mimeType: "image/png", buffer: png },
    ]);
    await page.getByLabel("Output format").selectOption("image/jpeg");
    await expect(page.getByText("a.jpg")).toBeVisible();
    const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download all/ }).click()]);
    expect(Object.keys(unzipSync(new Uint8Array(await readFile((await zip.path())!)))).sort()).toEqual(["a.jpg", "b.jpg"]);
  });

  test("EXIF remover strips metadata losslessly", async ({ page }) => {
    // A minimal JPEG with an EXIF segment containing a recognisable marker.
    const exif = Buffer.from("Exif\0\0SECRET-GPS-DATA");
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]),
      exif,
      Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x00, 0x12, 0x34, 0xff, 0xd9]),
    ]);
    await page.goto("/tools/exif-remover");
    await page.locator('input[type="file"]').setInputFiles({ name: "holiday.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await expect(page.getByText(/Removed EXIF/)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download" }).click()]);
    expect(download.suggestedFilename()).toBe("holiday-clean.jpg");
    const cleaned = await readFile((await download.path())!);
    expect(cleaned.includes(Buffer.from("SECRET-GPS-DATA"))).toBe(false);
    // Start-of-image and the scan data + end-of-image marker are untouched.
    expect([...cleaned.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect([...cleaned.subarray(-4)]).toEqual([0x12, 0x34, 0xff, 0xd9]);
  });

  test("image → Base64 → image round trip", async ({ page }) => {
    await page.goto("/tools/image-to-base64");
    const png = await makePng(page, 40, 40);
    await page.locator('input[type="file"]').setInputFiles({ name: "tiny.png", mimeType: "image/png", buffer: png });
    await expect(page.getByText("Ready-to-use snippets")).toBeVisible();
    await expect(page.getByText(/data:image\/png;base64,/).first()).toBeVisible();
  });

  test("color picker extracts a palette", async ({ page }) => {
    await page.goto("/tools/image-color-picker");
    await page.locator('input[type="file"]').setInputFiles({ name: "c.png", mimeType: "image/png", buffer: await makePng(page, 200, 200) });
    await expect(page.getByRole("heading", { name: "Dominant colors" })).toBeVisible();
    await expect(page.locator("button[title^='Copy #']").first()).toBeVisible();
    await page.getByLabel("Image. Click to pick a color.").click({ position: { x: 20, y: 20 } });
    await expect(page.getByRole("heading", { name: /Picked colors \(1\)/ })).toBeVisible();
  });
});
