import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import { appAlert, makePng, trackRequests } from "./helpers";

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
