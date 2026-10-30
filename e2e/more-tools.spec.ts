import { readFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";
import { appAlert, makeJpeg, trackRequests, withExifOrientation } from "./helpers";

// Playwright loads specs as CommonJS, so paths come from process.cwd(), not import.meta.
const PDFS = join(process.cwd(), "packages", "core", "tests", "fixtures", "pdf");

/** The page must make no request that leaves the site, and send nothing with a body. */
function expectLocal(baseURL: string, tracker: ReturnType<typeof trackRequests>) {
  expect(tracker.external(baseURL)).toEqual([]);
  expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

async function drawn(page: Page, name: string | RegExp) {
  const img = page.getByRole("img", { name }).first();
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
}

/** Width and height of a JPEG, read from its first start-of-frame marker. */
function jpegSize(bytes: Buffer): [number, number] {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error("not a JPEG marker");
    const marker = bytes[i + 1] as number;
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
    i += 2 + length;
  }
  throw new Error("no frame header");
}

/** Width and height of a PNG, from its header. */
const pngSize = (bytes: Uint8Array): [number, number] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
};

test.describe("Crop, Rotate & Flip Image", () => {
  test("turns, crops and saves a photo, honours its EXIF turn, and uploads nothing", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/image-crop");
    // 1200 × 900 on disk, but marked "turn 90° to view", so it should open as 900 × 1200.
    const photo = withExifOrientation(await makeJpeg(page, 1200, 900, 0.9), 6);
    await page.locator('input[type="file"]').setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByText("900 × 1200 px")).toBeVisible();
    await expect(page.getByTestId("crop-result-size")).toHaveText("900 × 1200");

    await page.getByRole("button", { name: "Turn right" }).click();
    await expect(page.getByTestId("crop-result-size")).toHaveText("1200 × 900");
    await page.getByRole("radiogroup", { name: "Shape of the box" }).getByText("1:1", { exact: true }).click();
    await expect(page.getByTestId("crop-result-size")).toHaveText("900 × 900");
    await expect(page.getByLabel("Crop width", { exact: true })).toHaveValue("900");
    await expect(page.getByLabel("Crop left", { exact: true })).toHaveValue("150");

    // The box moves with the keyboard.
    await page.getByRole("group", { name: "Crop box" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByLabel("Crop left", { exact: true })).toHaveValue("160");
    // A typed width keeps the square shape.
    await page.getByLabel("Crop width", { exact: true }).fill("600");
    await expect(page.getByLabel("Crop height", { exact: true })).toHaveValue("600");
    await expect(page.getByTestId("crop-result-size")).toHaveText("600 × 600");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("photo-cropped.jpg");
    const bytes = await readFile((await file.path())!);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(jpegSize(bytes)).toEqual([600, 600]);
    // The camera and location data does not come along.
    expect(bytes.includes(Buffer.from("Exif"))).toBe(false);
    expectLocal(baseURL!, tracker);
    expect(problems).toEqual([]);
  });

  test("saves a PNG of exactly the cropped size, straightens, and removes the empty corners", async ({ page }) => {
    await page.goto("/tools/image-crop");
    await page.locator('input[type="file"]').setInputFiles({ name: "wide.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, 800, 400, 0.9) });
    await expect(page.getByText("800 × 400 px")).toBeVisible();
    await page.getByLabel("Format", { exact: true }).selectOption("image/png");
    await page.getByLabel("Crop width", { exact: true }).fill("300");
    await page.getByLabel("Crop height", { exact: true }).fill("120");
    await expect(page.getByTestId("crop-result-size")).toHaveText("300 × 120");
    const png = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const first = await png;
    expect(first.suggestedFilename()).toBe("wide-cropped.png");
    const pngBytes = await readFile((await first.path())!);
    expect(pngBytes.subarray(1, 4).toString()).toBe("PNG");
    expect(pngSize(pngBytes)).toEqual([300, 120]);

    // Straighten: the picture grows to hold the tilted original, and the corners button shrinks the box inside it.
    const slider = page.getByLabel(/^Straighten/);
    await slider.focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight"); // 20 steps of half a degree
    await expect(page.getByLabel(/^Straighten \(\+10°\)/)).toBeVisible();
    // The saved size follows after a short pause, so wait for it to move off the old 300 × 120 before reading it.
    const size = page.getByTestId("crop-result-size");
    await expect(size).not.toHaveText("300 × 120");
    const tilted = Number((await size.textContent())!.split("×")[0]!.trim());
    expect(tilted).toBeGreaterThan(800);
    const tiltedText = (await size.textContent())!;
    await page.getByRole("button", { name: "Remove empty corners" }).click();
    await expect(size).not.toHaveText(tiltedText);
    const [w, h] = (await size.textContent())!.split("×").map((s) => Number(s.trim())) as [number, number];
    expect(w).toBeLessThan(800);
    expect(h).toBeLessThan(400);
  });

  test("moves and resizes the box with the mouse and keeps it inside the picture", async ({ page }) => {
    await page.goto("/tools/image-crop");
    await page.locator('input[type="file"]').setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, 800, 600, 0.9) });
    await expect(page.getByText("800 × 600 px")).toBeVisible();
    // Start from a smaller box so there is room to move it.
    await page.getByLabel("Crop width", { exact: true }).fill("400");
    await page.getByLabel("Crop height", { exact: true }).fill("300");
    const box = page.getByRole("group", { name: "Crop box" });
    const canvas = page.getByRole("img", { name: "The picture as it will be cut" });
    // The mouse can only reach what is on screen.
    await canvas.scrollIntoViewIfNeeded();
    const picture = (await canvas.boundingBox())!;
    const scale = 800 / picture.width; // picture pixels per screen pixel
    const before = (await box.boundingBox())!;

    // Drag the middle of the box 60 screen pixels right and 30 down.
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 30, before.y + before.height / 2 + 15, { steps: 4 });
    await page.mouse.move(before.x + before.width / 2 + 60, before.y + before.height / 2 + 30, { steps: 4 });
    await page.mouse.up();
    const left = Number(await page.getByLabel("Crop left", { exact: true }).inputValue());
    const top = Number(await page.getByLabel("Crop top", { exact: true }).inputValue());
    expect(left).toBeGreaterThan(0);
    expect(left).toBeCloseTo(60 * scale, -1);
    expect(top).toBeCloseTo(30 * scale, -1);
    expect(await page.getByLabel("Crop width", { exact: true }).inputValue()).toBe("400");

    // Drag it far past the corner of the picture: it stops at the edge and keeps its size.
    const moved = (await box.boundingBox())!;
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
    await page.mouse.down();
    await page.mouse.move(picture.x + picture.width + 300, picture.y + picture.height + 300, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByLabel("Crop left", { exact: true })).toHaveValue("400");
    await expect(page.getByLabel("Crop top", { exact: true })).toHaveValue("300");
    await expect(page.getByLabel("Crop width", { exact: true })).toHaveValue("400");

    // Drag the top-left corner square toward the middle: the box shrinks and its bottom-right corner stays put.
    const edge = (await box.boundingBox())!;
    await page.mouse.move(edge.x + 2, edge.y + 2);
    await page.mouse.down();
    await page.mouse.move(edge.x + 2 + 40, edge.y + 2 + 40, { steps: 5 });
    await page.mouse.up();
    const width = Number(await page.getByLabel("Crop width", { exact: true }).inputValue());
    const height = Number(await page.getByLabel("Crop height", { exact: true }).inputValue());
    expect(width).toBeLessThan(400);
    expect(height).toBeLessThan(300);
    expect(Number(await page.getByLabel("Crop left", { exact: true }).inputValue()) + width).toBe(800);
    expect(Number(await page.getByLabel("Crop top", { exact: true }).inputValue()) + height).toBe(600);
  });

  test("explains a file that is not a picture", async ({ page }) => {
    await page.goto("/tools/image-crop");
    await page.locator('input[type="file"]').setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("this is not a picture") });
    await expect(appAlert(page)).toContainText(/could not be (read|opened)|corrupted/i);
  });

  test("has no accessibility violations with a picture open", async ({ page }) => {
    await page.goto("/tools/image-crop");
    await page.locator('input[type="file"]').setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: await makeJpeg(page, 600, 400, 0.9) });
    await expect(page.getByTestId("crop-result-size")).toHaveText("600 × 400");
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("PDF to Images", () => {
  test("draws every page, saves them as a ZIP or one by one, and uploads nothing", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/pdf-to-images");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "text-only.pdf"));
    await expect(page.getByText(/· 2 pages$/)).toBeVisible();
    await page.getByRole("button", { name: "Make pictures" }).click();
    await expect(page.getByTestId("pictures-count")).toHaveText("2", { timeout: 60_000 });
    await expect(page.getByRole("list", { name: "Pictures" }).getByRole("listitem")).toHaveCount(2);

    const zipDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download all as ZIP" }).click();
    const zip = await zipDownload;
    expect(zip.suggestedFilename()).toBe("text-only-pages.zip");
    const entries = unzipSync(new Uint8Array(await readFile((await zip.path())!)));
    expect(Object.keys(entries)).toEqual(["text-only-page-001.png", "text-only-page-002.png"]);
    for (const data of Object.values(entries)) expect(Buffer.from(data.subarray(1, 4)).toString()).toBe("PNG");
    // The fixture is US Letter (612 × 792 points); at 150 DPI that is 1275 × 1650 pixels.
    expect(pngSize(entries["text-only-page-001.png"]!)).toEqual([1275, 1650]);

    const single = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download page 2" }).click();
    expect((await single).suggestedFilename()).toBe("text-only-page-002.png");
    expectLocal(baseURL!, tracker);
    expect(problems).toEqual([]);
  });

  test("saves a chosen page as JPG at a different resolution", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/tools/pdf-to-images");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "text-only.pdf"));
    await expect(page.getByText(/· 2 pages$/)).toBeVisible();
    await page.getByRole("textbox", { name: "Pages", exact: true }).fill("2");
    await page.getByLabel("Resolution").selectOption("72");
    await page.getByLabel("Picture format").selectOption("jpeg");
    await page.getByRole("button", { name: "Make pictures" }).click();
    await expect(page.getByTestId("pictures-count")).toHaveText("1", { timeout: 60_000 });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download page 2" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("text-only-page-002.jpg");
    const bytes = await readFile((await file.path())!);
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
    expect(jpegSize(bytes)).toEqual([612, 792]);
  });

  test("says which page does not exist, and refuses encrypted and broken files in words", async ({ page }) => {
    await page.goto("/tools/pdf-to-images");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "text-only.pdf"));
    await page.getByRole("textbox", { name: "Pages", exact: true }).fill("9");
    await expect(appAlert(page)).toContainText("out of range");
    await expect(page.getByRole("button", { name: "Make pictures" })).toBeDisabled();

    await page.goto("/tools/pdf-to-images");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "encrypted.pdf"));
    await expect(appAlert(page)).toContainText("password");
    await page.goto("/tools/pdf-to-images");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "corrupt.pdf"));
    await expect(appAlert(page)).toContainText(/could not be read|does not look like/);
  });

  test("has no accessibility violations with a result on screen", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/tools/pdf-to-images");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "text-only.pdf"));
    await page.getByRole("button", { name: "Make pictures" }).click();
    await expect(page.getByTestId("pictures-count")).toHaveText("2", { timeout: 60_000 });
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("PDF to Text", () => {
  test("reads the text page by page, can drop the page marks, and saves a .txt file", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/pdf-to-text");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "text-only.pdf"));
    const text = page.getByRole("textbox", { name: "Text from the PDF", exact: true });
    await expect(text).toHaveValue(/--- Page 1 ---\n\nText only, page 1\n/, { timeout: 60_000 });
    await expect(text).toHaveValue(/Line 1: the quick brown fox jumps over the lazy dog\./);
    await expect(text).toHaveValue(/--- Page 2 ---/);
    await expect(page.getByTestId("pdf-text-words")).not.toHaveText("0");

    await page.getByLabel("Mark each page").uncheck();
    await expect(text).not.toHaveValue(/--- Page/);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .txt" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("text-only.txt");
    expect((await readFile((await file.path())!, "utf8")).includes("Line 1: the quick brown fox")).toBe(true);
    expectLocal(baseURL!, tracker);
    expect(problems).toEqual([]);
  });

  test("tells you plainly when a PDF is only a picture", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/tools/pdf-to-text");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "rotated-photo.pdf"));
    await expect(page.getByRole("status").filter({ hasText: /no text that can be copied[\s\S]*OCR/ })).toBeVisible({ timeout: 60_000 });
  });

  test("has no accessibility violations with text on screen", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/tools/pdf-to-text");
    await page.locator('input[type="file"]').setInputFiles(join(PDFS, "text-only.pdf"));
    await expect(page.getByRole("textbox", { name: "Text from the PDF", exact: true })).toHaveValue(/Text only/, { timeout: 60_000 });
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("XML Formatter & Converter", () => {
  test("formats, shrinks, checks and converts the sample", async ({ page }) => {
    await page.goto("/tools/xml-formatter");
    await page.getByRole("button", { name: "Sample" }).click();
    const output = page.getByRole("textbox", { name: "Result", exact: true });
    await expect(output).toHaveValue(/<catalog xmlns:dc="http:\/\/purl\.org\/dc\/elements\/1\.1\/">\n {2}<book id="bk101" lang="en">\n {4}<dc:title>/);
    await expect(output).toHaveValue(/<!\[CDATA\[An in-depth look at creating <applications> with XML\.\]\]>/);

    await page.getByLabel("Do this").selectOption("minify");
    await expect(output).toHaveValue(/^<\?xml version="1\.0" encoding="UTF-8"\?><catalog/);

    await page.getByLabel("Do this").selectOption("check");
    await expect(output).toHaveValue(/well-formed XML[\s\S]*Root element: <catalog>[\s\S]*Elements: 11/);

    await page.getByLabel("Do this").selectOption("to-json");
    await expect(output).toHaveValue(/"catalog": \{[\s\S]*"book": \[[\s\S]*"@id": "bk101"/);
    await page.getByRole("button", { name: "Use as input" }).click();
    await page.getByLabel("Do this").selectOption("from-json");
    await expect(output).toHaveValue(/<\?xml version="1\.0" encoding="UTF-8"\?>\n<catalog xmlns:dc=/);
  });

  test("points at the line and column of a mistake", async ({ page }) => {
    await page.goto("/tools/xml-formatter");
    await page.getByRole("textbox", { name: "XML or JSON", exact: true }).fill("<a>\n  <b>\n  </c>\n</a>");
    await expect(appAlert(page)).toContainText("Line 3, column 3");
    await expect(appAlert(page)).toContainText("Expected </b>");
  });

  test("shows a billion-laughs file as plain text, instantly", async ({ page }) => {
    await page.goto("/tools/xml-formatter");
    const bomb = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol9 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">]><lolz>&lol9;</lolz>`;
    await page.getByRole("textbox", { name: "XML or JSON", exact: true }).fill(bomb);
    await expect(page.getByRole("textbox", { name: "Result", exact: true })).toHaveValue(/<lolz>&lol9;<\/lolz>/);
  });

  test("has no accessibility violations", async ({ page }) => {
    await page.goto("/tools/xml-formatter");
    await page.getByRole("button", { name: "Sample" }).click();
    await expect(page.getByRole("textbox", { name: "Result", exact: true })).toHaveValue(/<catalog/);
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("IP & Subnet Calculator", () => {
  test("works out a network, IPv6 and bad input", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    await page.goto("/tools/subnet-calculator");
    await expect(page.getByTestId("subnet-hosts")).toHaveText("254");
    await expect(page.getByText("255.255.255.0", { exact: true }).first()).toBeVisible();
    const input = page.getByRole("textbox", { name: "Network or address" });
    await input.fill("10.0.0.0/8");
    await expect(page.getByTestId("subnet-hosts")).toHaveText("16,777,214");
    await input.fill("10.0.0.0/31");
    await expect(page.getByTestId("subnet-hosts")).toHaveText("2");
    await input.fill("2001:db8::/32");
    await expect(page.getByTestId("subnet-hosts")).toHaveText("79,228,162,514,264,337,593,543,950,336");
    await input.fill("300.1.1.1/8");
    await expect(appAlert(page)).toContainText("too large");
    await input.fill("010.0.0.1/8");
    await expect(appAlert(page)).toContainText("leading zero");
    // Nothing typed here goes into the address bar.
    expect(page.url()).not.toContain("#");
    expectLocal(baseURL!, tracker);
  });

  test("splits, converts a range, checks membership and merges a list", async ({ page }) => {
    await page.goto("/tools/subnet-calculator");
    const modes = page.getByRole("radiogroup", { name: "What do you want to do" });

    await modes.getByText("Split", { exact: true }).click();
    await expect(page.getByTestId("subnet-split-count")).toHaveText("256");
    await page.getByLabel("Split by").selectOption("hosts");
    await page.getByLabel("Hosts needed in each").fill("500");
    await expect(page.getByTestId("subnet-split-count")).toHaveText("128"); // /23 holds 510 hosts: 2^7 of them in a /16
    await expect(page.locator("table").first()).toBeVisible();

    await modes.getByText("Range to CIDR", { exact: true }).click();
    await expect(page.getByTestId("range-count")).toHaveText("4");
    await expect(page.getByRole("list", { name: "CIDR blocks" })).toContainText("10.0.0.2/31");
    await page.getByLabel("Last address").fill("10.0.0.0");
    await expect(appAlert(page)).toContainText("after the end");

    await modes.getByText("Contains", { exact: true }).click();
    await expect(page.getByTestId("contains-answer")).toHaveText("Yes, it is inside");
    await page.getByRole("textbox", { name: "Address to check" }).fill("11.0.0.1");
    await expect(page.getByTestId("contains-answer")).toHaveText("No, it is outside");

    await modes.getByText("Merge list", { exact: true }).click();
    await expect(page.getByTestId("merge-count")).toHaveText("7");
    await expect(page.getByRole("list", { name: "Merged blocks" })).toContainText("192.168.0.0/23");
    await expect(page.getByRole("list", { name: "Merged blocks" })).toContainText("2001:db8::/32");
  });

  test("has no accessibility violations in any mode", async ({ page }) => {
    await page.goto("/tools/subnet-calculator");
    const modes = page.getByRole("radiogroup", { name: "What do you want to do" });
    expect(await violations(page)).toEqual([]);
    for (const mode of ["Split", "Range to CIDR", "Contains", "Merge list"]) {
      await modes.getByText(mode, { exact: true }).click();
      expect(await violations(page), mode).toEqual([]);
    }
  });
});

test.describe("Barcode Generator", () => {
  test("draws a Code 128, saves SVG and PNG, and keeps the text off the address bar", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/barcode-generator");
    await expect(page.getByTestId("barcode-data")).toHaveText("Toolwright-2024");
    await drawn(page, "Barcode for Toolwright-2024");

    const svgDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download SVG" }).click();
    const svgFile = await svgDownload;
    expect(svgFile.suggestedFilename()).toBe("barcode-code128-Toolwright-2024.svg");
    const svg = await readFile((await svgFile.path())!, "utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).not.toMatch(/<script|onload|javascript:/i);

    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    const pngFile = await pngDownload;
    expect(pngFile.suggestedFilename()).toBe("barcode-code128-Toolwright-2024.png");
    const png = await readFile((await pngFile.path())!);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    // The PNG is the SVG's size times the chosen 2×.
    const [w] = pngSize(new Uint8Array(png));
    const drawnWidth = Number(/width="([0-9.]+)"/.exec(svg)![1]);
    expect(w).toBe(Math.round(drawnWidth * 2));
    expect(page.url()).not.toContain("#");
    expectLocal(baseURL!, tracker);
    expect(problems).toEqual([]);
  });

  test("adds the EAN-13 check digit, checks one you typed, and explains bad input", async ({ page }) => {
    await page.goto("/tools/barcode-generator");
    await page.getByLabel("Type", { exact: true }).selectOption("ean13");
    await expect(page.getByRole("textbox", { name: "Text or number" })).toHaveValue("400638133393");
    await expect(page.getByTestId("barcode-data")).toHaveText("4006381333931");
    await expect(page.getByText("The check digit 1 was added.")).toBeVisible();
    const input = page.getByRole("textbox", { name: "Text or number" });
    await input.fill("4006381333932");
    await expect(appAlert(page)).toContainText("should be 1, but the last digit is 2");
    await input.fill("12345");
    await expect(appAlert(page)).toContainText("needs 12 digits");
    await page.getByLabel("Type", { exact: true }).selectOption("code39");
    await input.fill("hello_world");
    await expect(appAlert(page)).toContainText('"_" cannot be written in Code 39');
    await input.fill("hello");
    await expect(page.getByTestId("barcode-data")).toHaveText("HELLO");
  });

  test("warns when the colours would not scan", async ({ page }) => {
    await page.goto("/tools/barcode-generator");
    await page.getByLabel("Bar colour").fill("#bbbbbb");
    await expect(page.getByText(/too close in brightness/)).toBeVisible();
  });

  test("has no accessibility violations", async ({ page }) => {
    await page.goto("/tools/barcode-generator");
    await drawn(page, /Barcode for/);
    expect(await violations(page)).toEqual([]);
    await page.getByRole("textbox", { name: "Text or number" }).fill("é");
    await expect(appAlert(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
