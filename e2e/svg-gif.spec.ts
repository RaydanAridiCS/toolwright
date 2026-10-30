import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { appAlert, makePng, trackRequests } from "./helpers";

const FIXTURES = join(process.cwd(), "packages", "core", "tests", "fixtures", "gif");

const MESSY_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Created with an editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="48mm" height="48mm" viewBox="0 0 48.000000 48.000000" inkscape:version="1.0">
  <metadata id="m"><work>made by hand</work></metadata>
  <g inkscape:label="Layer 1">
    <circle style="fill:#ff0000;fill-opacity:1;stroke:none" cx="24.000000" cy="24.000000" r="20.123456789"/>
    <circle style="fill:#ffffff;fill-opacity:1;stroke:none" cx="24.000000" cy="24.000000" r="13.000000"/>
  </g>
</svg>
`;

/** The page must make no request that leaves the site, and send nothing with a body. */
function expectLocal(page: Page, baseURL: string, tracker: ReturnType<typeof trackRequests>) {
  expect(tracker.external(baseURL)).toEqual([]);
  expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
  void page;
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function drawn(page: Page, name: string | RegExp) {
  const img = page.getByRole("img", { name }).first();
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
}

test.describe("SVG tools", () => {
  test("SVG Optimizer shrinks a messy file in a worker and uploads nothing", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/svg-optimizer");
    await page.locator('input[type="file"]').setInputFiles({ name: "target.svg", mimeType: "image/svg+xml", buffer: Buffer.from(MESSY_SVG) });
    await expect(page.getByTestId("optimize-total")).toContainText("→", { timeout: 30_000 });
    const optimized = page.getByRole("textbox", { name: "Optimized SVG", exact: true });
    await expect(optimized).not.toHaveValue(/inkscape|metadata|<!--/);
    await expect(optimized).toHaveValue(/viewBox/);
    await drawn(page, "The optimized SVG");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).first().click();
    expect((await download).suggestedFilename()).toBe("target.min.svg");
    expectLocal(page, baseURL!, tracker);
    expect(problems).toEqual([]);
  });

  test("SVG Optimizer says what is wrong with a file that is not an SVG", async ({ page }) => {
    await page.goto("/tools/svg-optimizer");
    await page.locator('input[type="file"]').setInputFiles({ name: "broken.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg><g></svg>") });
    await expect(appAlert(page)).toContainText("Line 1", { timeout: 30_000 });
  });

  test("SVG Sanitizer removes script, handlers and outside links, and says so", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    await page.goto("/tools/svg-sanitizer");
    await page.getByRole("button", { name: "Sample" }).click();
    const output = page.getByRole("textbox", { name: "Cleaned SVG", exact: true });
    await expect(output).toHaveValue(/<circle/);
    await expect(output).not.toHaveValue(/script|onload|onclick|javascript:|evil\.example|tracker\.example|foreignObject/i);
    await expect(page.getByTestId("sanitize-count")).not.toHaveText("Nothing");
    await expect(page.getByRole("list", { name: "What was removed" })).toContainText("script");
    await drawn(page, "The cleaned SVG");
    expect(page.url()).not.toContain("#s=");
    expectLocal(page, baseURL!, tracker);
  });

  test("SVG Editor previews, fixes a missing namespace and exports a PNG", async ({ page }) => {
    await page.goto("/tools/svg-editor");
    await page.getByRole("button", { name: "Sample" }).click();
    await drawn(page, "The SVG as drawn");
    await expect(page.getByRole("list", { name: "Checks" })).toContainText("xmlns");
    await page.getByRole("button", { name: "Fix" }).first().click();
    await expect(page.getByRole("textbox", { name: "SVG code", exact: true })).toHaveValue(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    await page.getByLabel("Width in pixels").fill("240");
    await page.getByRole("button", { name: "Set size" }).click();
    await expect(page.getByRole("textbox", { name: "SVG code", exact: true })).toHaveValue(/width="240"[\s\S]*height="160"|height="160"[\s\S]*width="240"/);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download PNG/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("picture.png");
    const bytes = await readFile((await file.path())!);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  });

  test("SVG to Data URI and SVG to React convert the sample", async ({ page }) => {
    await page.goto("/tools/svg-data-uri");
    await page.getByRole("button", { name: "Sample" }).click();
    await expect(page.getByRole("textbox", { name: "Data URI", exact: true })).toHaveValue(/url\("data:image\/svg\+xml,%3Csvg/);
    await page.getByLabel("Encoding").selectOption("base64");
    await expect(page.getByRole("textbox", { name: "Data URI", exact: true })).toHaveValue(/data:image\/svg\+xml;base64,/);

    await page.goto("/tools/svg-to-react");
    await page.getByRole("button", { name: "Sample" }).click();
    const code = page.getByRole("textbox", { name: "React component", exact: true });
    await expect(code).toHaveValue(/export default/);
    await expect(code).toHaveValue(/strokeWidth="2"/);
    await expect(code).toHaveValue(/className="icon"/);
    await page.getByLabel("TypeScript (TSX)").check();
    await expect(code).toHaveValue(/SVGProps<SVGSVGElement>/);
  });

  test("SVG Path Tools converts and measures a path", async ({ page }) => {
    await page.goto("/tools/svg-path-tools");
    await page.getByRole("button", { name: "Sample" }).click();
    const result = page.getByRole("textbox", { name: "Result path data", exact: true });
    await expect(result).toHaveValue(/^M 10 80 C/);
    await drawn(page, "The path");
    await page.getByRole("textbox", { name: "Path data", exact: true }).fill("m 10 10 l 5 5 h 10 z");
    await page.getByLabel("What to do").selectOption("absolute");
    await expect(result).toHaveValue("M 10 10 L 15 15 H 25 Z");
    await page.getByLabel("What to do").selectOption("curves");
    await expect(result).toHaveValue("M 10 10 L 15 15 L 25 15 Z"); // H becomes L
    await expect(result).not.toHaveValue(/[HVSQTA]/);
    await page.getByRole("textbox", { name: "Path data", exact: true }).fill("M 0 0 L nope");
    await expect(appAlert(page)).toBeVisible();
  });

  test("SVG Recolor lists the colours and changes them", async ({ page }) => {
    await page.goto("/tools/svg-recolor");
    await page.getByRole("button", { name: "Sample" }).click();
    await expect(page.getByRole("list", { name: "Colours" })).toContainText("#1d6b57");
    await page.getByRole("button", { name: "Invert" }).click();
    await expect(page.getByRole("textbox", { name: "SVG code", exact: true })).not.toHaveValue(/#1d6b57/);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("textbox", { name: "SVG code", exact: true })).toHaveValue(/#1d6b57/);
    await page.getByRole("button", { name: "Use currentColor" }).click();
    await expect(page.getByRole("textbox", { name: "SVG code", exact: true })).toHaveValue(/currentColor/);
  });

  test("SVG Shape Generator makes the same shape for the same seed", async ({ page }) => {
    await page.goto("/tools/svg-shape-generator");
    const code = page.getByRole("textbox", { name: "SVG code", exact: true });
    await expect(code).toHaveValue(/<path d="M/);
    await drawn(page, /A generated blob/);
    const first = await code.inputValue();
    await page.getByLabel("Seed").fill("99");
    await expect(code).not.toHaveValue(first);
    await page.getByLabel("Seed").fill("7");
    await expect(code).toHaveValue(first);
    await page.getByRole("radiogroup", { name: "Shape" }).getByText("Wave").click();
    await expect(code).toHaveValue(/viewBox="0 0 800 240"/);
    await page.getByRole("radiogroup", { name: "Shape" }).getByText("Star").click();
    await expect(code).toHaveValue(/<path d="M/);
  });

  test("Image to SVG traces a picture in a worker", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/image-to-svg");
    await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await makePng(page, 160, 120) });
    await drawn(page, "The traced SVG");
    await expect(page.getByTestId("trace-size")).toContainText(/KB|B/);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).first().click();
    expect((await download).suggestedFilename()).toBe("logo.svg");
    expectLocal(page, baseURL!, tracker);
    expect(problems).toEqual([]);
  });
});

test.describe("GIF tools", () => {
  test("GIF Editor reverses a GIF, shows the new size and saves a real GIF", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/gif-editor");
    await page.locator('input[type="file"]').setInputFiles(join(FIXTURES, "moving-square.gif"));
    await expect(page.getByText("Frames", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Order").selectOption("reverse");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("gif-size")).toContainText("→", { timeout: 60_000 });
    await drawn(page, "The edited GIF");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download GIF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("moving-square-edited.gif");
    const bytes = await readFile((await file.path())!);
    expect(bytes.subarray(0, 6).toString()).toMatch(/^GIF8[79]a$/);
    expectLocal(page, baseURL!, tracker);
    expect(problems).toEqual([]);
  });

  test("GIF Editor saves every frame as PNG in a ZIP", async ({ page }) => {
    await page.goto("/tools/gif-editor");
    await page.locator('input[type="file"]').setInputFiles(join(FIXTURES, "moving-square.gif"));
    await expect(page.getByText("Frames", { exact: true })).toBeVisible({ timeout: 30_000 });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Save every frame as PNG/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("moving-square-frames.zip");
    expect((await readFile((await file.path())!)).subarray(0, 2).toString()).toBe("PK");
  });

  test("GIF Editor refuses a file that is not a GIF, in words", async ({ page }) => {
    await page.goto("/tools/gif-editor");
    await page.locator('input[type="file"]').setInputFiles({ name: "fake.gif", mimeType: "image/gif", buffer: Buffer.from("this is not a gif at all") });
    await expect(appAlert(page)).toContainText("not a GIF", { timeout: 30_000 });
  });

  test("GIF Maker joins pictures into a GIF", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/gif-maker");
    const pictures = await Promise.all([makePng(page, 200, 150), makePng(page, 150, 200), makePng(page, 200, 150)]);
    await page.locator('input[type="file"]').setInputFiles(pictures.map((buffer, i) => ({ name: `frame-${i + 1}.png`, mimeType: "image/png", buffer })));
    await expect(page.getByRole("list", { name: "Frames" }).getByRole("listitem")).toHaveCount(3);
    await page.getByRole("button", { name: "Move frame-3.png up" }).click();
    await expect(page.getByRole("list", { name: "Frames" }).getByRole("listitem").nth(1)).toContainText("frame-3.png");
    await page.getByRole("button", { name: "Make GIF" }).click();
    await drawn(page, "The new GIF");
    await expect(page.getByTestId("gif-size")).toContainText(/KB|B/);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download GIF" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("animation.gif");
    const bytes = await readFile((await file.path())!);
    expect(bytes.subarray(0, 6).toString()).toMatch(/^GIF8[79]a$/);
    expectLocal(page, baseURL!, tracker);
    expect(problems).toEqual([]);
  });
});
