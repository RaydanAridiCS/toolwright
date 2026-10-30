#!/usr/bin/env node
/**
 * Generates the PDFs in packages/core/tests/fixtures/pdf/. The output is committed; run this only to change a fixture.
 *
 *   node scripts/make-pdf-fixtures.mjs [path-to-python-with-pypdf]
 *
 * Needs `sharp` (present in node_modules through Next.js) for the JPEGs and PNGs. The encrypted fixture needs a real
 * encryption dictionary, which pdf-lib cannot write, so it is made with pypdf (`pip install pypdf`). Without a Python
 * path that one fixture is skipped.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import sharp from "sharp";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "core", "tests", "fixtures", "pdf");
mkdirSync(out, { recursive: true });
const write = (name, bytes) => {
  writeFileSync(join(out, name), bytes);
  console.log(`${name}: ${bytes.length} bytes`);
};

/** Deterministic pseudo-random numbers, so the fixtures are reproducible. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A photo-like picture: smooth colour fields plus fine grain, so JPEG has real work to do. */
async function picture(width, height, seed) {
  const random = rng(seed);
  const cell = 8;
  const gw = Math.ceil(width / cell) + 1;
  const gh = Math.ceil(height / cell) + 1;
  const coarse = Buffer.alloc(gw * gh * 3);
  for (let i = 0; i < coarse.length; i++) coarse[i] = Math.floor(random() * 256);
  const smooth = await sharp(coarse, { raw: { width: gw, height: gh, channels: 3 } }).resize(width, height, { kernel: "cubic" }).raw().toBuffer();
  const grain = Buffer.alloc(smooth.length);
  for (let i = 0; i < grain.length; i++) grain[i] = Math.max(0, Math.min(255, smooth[i] + Math.floor((random() - 0.5) * 40)));
  return sharp(grain, { raw: { width, height, channels: 3 } });
}

const jpeg = async (width, height, seed, quality = 92) => (await (await picture(width, height, seed)).jpeg({ quality }).toBuffer());

async function textPage(doc, text) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(text, { x: 54, y: 740, size: 18, font });
  return { page, font };
}

// 1. photo-heavy.pdf: three pages, two photos, one of them used twice at different sizes.
{
  const doc = await PDFDocument.create();
  doc.setTitle("Photo heavy fixture");
  doc.setAuthor("Toolwright tests");
  const a = await doc.embedJpg(await jpeg(1000, 750, 1));
  const b = await doc.embedJpg(await jpeg(1000, 750, 2));
  const one = await textPage(doc, "Photo page 1");
  one.page.drawImage(a, { x: 90, y: 250, width: 432, height: 324 }); // 6 x 4.5 in: 167 dpi
  const two = await textPage(doc, "Photo page 2");
  two.page.drawImage(a, { x: 90, y: 400, width: 216, height: 162 }); // same picture, 3 x 2.25 in: 333 dpi
  two.page.drawImage(b, { x: 90, y: 150, width: 432, height: 243 });
  const three = await textPage(doc, "Photo page 3");
  three.page.drawImage(b, { x: 36, y: 200, width: 540, height: 405 }); // 7.5 in wide: 133 dpi
  write("photo-heavy.pdf", await doc.save());
}

// 2. text-only.pdf
{
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 2; i++) {
    const { page, font } = await textPage(doc, `Text only, page ${i}`);
    for (let l = 0; l < 30; l++) page.drawText(`Line ${l + 1}: the quick brown fox jumps over the lazy dog.`, { x: 54, y: 700 - l * 18, size: 11, font });
    page.drawRectangle({ x: 54, y: 120, width: 200, height: 40, borderWidth: 1 });
  }
  write("text-only.pdf", await doc.save());
}

// 3. photo-heavy fixture, cut off in the middle
{
  const whole = readFileSync(join(out, "photo-heavy.pdf"));
  write("corrupt.pdf", whole.subarray(0, Math.floor(whole.length * 0.6)));
}

// 4. mixed.pdf: RGB, gray and CMYK JPEGs, and a PNG with transparency (Flate image plus soft mask)
{
  const doc = await PDFDocument.create();
  const { page } = await textPage(doc, "Mixed image kinds");
  const rgb = await doc.embedJpg(await jpeg(600, 400, 3));
  const gray = await doc.embedJpg(await (await picture(600, 400, 4)).greyscale().toColourspace("b-w").jpeg({ quality: 90 }).toBuffer());
  const cmyk = await doc.embedJpg(await (await picture(600, 400, 5)).toColourspace("cmyk").jpeg({ quality: 90 }).toBuffer());
  const rgba = Buffer.alloc(120 * 80 * 4);
  const random = rng(6);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([random() * 255, random() * 255, random() * 255, 40 + random() * 200], i);
  const png = await doc.embedPng(await sharp(rgba, { raw: { width: 120, height: 80, channels: 4 } }).png().toBuffer());
  page.drawImage(rgb, { x: 40, y: 500, width: 300, height: 200 });
  page.drawImage(gray, { x: 360, y: 500, width: 200, height: 133 });
  page.drawImage(cmyk, { x: 40, y: 260, width: 300, height: 200 });
  page.drawImage(png, { x: 360, y: 260, width: 180, height: 120 });
  write("mixed.pdf", await doc.save());
}

// 5. flate-images.pdf: only lossless images
{
  const doc = await PDFDocument.create();
  const { page } = await textPage(doc, "Lossless images only");
  const random = rng(7);
  const raw = Buffer.alloc(200 * 150 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = random() * 255;
  const png = await doc.embedPng(await sharp(raw, { raw: { width: 200, height: 150, channels: 3 } }).png().toBuffer());
  page.drawImage(png, { x: 54, y: 400, width: 300, height: 225 });
  write("flate-images.pdf", await doc.save());
}

// 6. rotated-photo.pdf: a page with /Rotate 90 and a picture drawn at an angle
{
  const doc = await PDFDocument.create();
  const image = await doc.embedJpg(await jpeg(900, 600, 8));
  const page = doc.addPage([612, 792]);
  page.setRotation(degrees(90));
  page.drawImage(image, { x: 200, y: 300, width: 360, height: 240, rotate: degrees(30) }); // 5 x 3.33 in: 180 dpi
  write("rotated-photo.pdf", await doc.save());
}

// 7. Small JPEGs that stand in for "the browser re-encoded this image" in unit tests (no canvas needed).
write("recompressed-rgb.jpg", await jpeg(250, 188, 1, 40));
write("recompressed-gray.jpg", await (await picture(250, 188, 4)).greyscale().toColourspace("b-w").jpeg({ quality: 40 }).toBuffer());

// 8. encrypted.pdf (user password "secret"), made with pypdf
const python = process.argv[2];
if (python) {
  const script = `
import sys
from pypdf import PdfReader, PdfWriter
writer = PdfWriter(clone_from=PdfReader(sys.argv[1]))
writer.encrypt("secret", algorithm="AES-128")
with open(sys.argv[2], "wb") as f:
    writer.write(f)
`;
  execFileSync(python, ["-c", script, join(out, "text-only.pdf"), join(out, "encrypted.pdf")], { stdio: "inherit" });
  console.log(`encrypted.pdf: ${readFileSync(join(out, "encrypted.pdf")).length} bytes`);
} else {
  console.log("encrypted.pdf skipped (pass the path of a Python with pypdf installed)");
}
