import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { DIAGRAM_SAMPLES } from "../packages/core/src/mermaid-tools";
import { appAlert, trackRequests } from "./helpers";

const text = (page: Page) => page.getByRole("textbox", { name: "Mermaid diagram text", exact: true });
const preview = (page: Page) => page.getByTestId("diagram-preview");

/** Wait for the picture to be drawn, and make sure it really has content. */
async function drawn(page: Page, label: string) {
  await expect(preview(page)).toHaveAttribute("alt", new RegExp(label, "i"), { timeout: 30_000 });
  await expect.poll(() => preview(page).evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 20), { timeout: 15_000 }).toBe(true);
}

/** Console problems that mean a diagram type did something the security policy refuses. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test.describe("Mermaid editor", () => {
  test("draws the starting diagram on the page, with nothing sent anywhere", async ({ page, baseURL }) => {
    const tracker = trackRequests(page);
    const problems = watch(page);
    await page.goto("/tools/mermaid-editor");
    await drawn(page, "flowchart");
    expect(tracker.external(baseURL!)).toEqual([]);
    expect(tracker.all.filter((r) => r.method() !== "GET" && !r.url().includes("/_next/"))).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("every example draws under the production security policy", async ({ page }) => {
    test.setTimeout(180_000);
    const problems = watch(page);
    await page.goto("/tools/mermaid-editor");
    for (const sample of DIAGRAM_SAMPLES) {
      await page.getByLabel("Example").selectOption(sample.id);
      const kind = sample.label.split(":")[0]!.toLowerCase().replace(/ diagram| chart/, "");
      await expect(text(page)).toHaveValue(sample.code);
      await expect.poll(async () => (await preview(page).getAttribute("alt")) ?? "", { timeout: 30_000, message: `${sample.id} should draw` }).toMatch(/^Preview of the /);
      await expect.poll(() => preview(page).evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 20), { timeout: 15_000, message: `${sample.id} has content` }).toBe(true);
      await expect(appAlert(page)).toHaveCount(0);
      void kind;
    }
    expect(problems).toEqual([]);
  });

  test("the newer and rarer diagram types draw too", async ({ page }) => {
    test.setTimeout(180_000);
    const problems = watch(page);
    const more: [string, string][] = [
      ["xychart", 'xychart-beta\n  title "Sales"\n  x-axis [jan, feb, mar]\n  y-axis "Units" 0 --> 100\n  bar [20, 50, 80]\n  line [20, 50, 80]'],
      ["sankey", "sankey-beta\n\nA,B,10\nB,C,6\nB,D,4"],
      ["block", "block-beta\n  columns 2\n  a[\"A\"] b[\"B\"]\n  c[\"C\"]:2"],
      ["architecture", "architecture-beta\n  group api(cloud)[API]\n  service db(database)[Database] in api\n  service srv(server)[Server] in api\n  db:L -- R:srv"],
      ["packet", 'packet-beta\n  0-15: "Source Port"\n  16-31: "Destination Port"'],
      ["kanban", "kanban\n  todo[To do]\n    t1[Write tests]\n  done[Done]\n    t2[Ship it]"],
      ["requirement", 'requirementDiagram\n  requirement r1 {\n    id: 1\n    text: it works\n    risk: low\n    verifymethod: test\n  }\n  element e1 {\n    type: simulation\n  }\n  e1 - satisfies -> r1'],
      ["c4", 'C4Context\n  title System context\n  Person(user, "User")\n  System(app, "App")\n  Rel(user, app, "Uses")'],
    ];
    await page.goto("/tools/mermaid-editor");
    for (const [name, code] of more) {
      await text(page).fill(code);
      await expect.poll(() => preview(page).evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 20), { timeout: 30_000, message: `${name} draws` }).toBe(true);
      await expect(appAlert(page), `${name} should not report an error`).toHaveCount(0);
      expect(await preview(page).getAttribute("alt"), name).toMatch(/^Preview of the /);
    }
    expect(problems).toEqual([]);
  });

  test("a mistake names the line, and the last good diagram stays on screen", async ({ page }) => {
    await page.goto("/tools/mermaid-editor");
    await drawn(page, "flowchart");
    await text(page).fill("flowchart TD\n  A --> B\n  B -->");
    await expect(appAlert(page)).toContainText(/Parse error|Expecting/i, { timeout: 15_000 });
    await expect(appAlert(page)).toContainText("Showing the last version that worked");
    await expect(preview(page)).toBeVisible();
  });

  test("explains text that is empty, not a diagram, or too long", async ({ page }) => {
    await page.goto("/tools/mermaid-editor");
    await text(page).fill("hello there");
    await expect(page.getByText(/“hello” is not a Mermaid diagram type/)).toBeVisible();
    await text(page).fill("");
    await expect(page.getByText("Your diagram appears here.")).toBeVisible();
    // Like a paste. (Playwright's fill() is very slow for text this large, which says nothing about the tool.)
    await page.evaluate((value) => {
      const box = document.querySelector("textarea[aria-label='Mermaid diagram text']") as HTMLTextAreaElement;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, value);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    }, `flowchart TD\n${"A-->B\n".repeat(9000)}`);
    await expect(page.getByText(/The limit is 50,000/)).toBeVisible();
  });

  test("scripts in labels and links never run", async ({ page }) => {
    const dialogs: string[] = [];
    page.on("dialog", async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });
    await page.goto("/tools/mermaid-editor");
    await text(page).fill(
      [
        "flowchart TD",
        '  A["<img src=x onerror=window.__pwned=1>"] --> B["<script>window.__pwned=1</script>"]',
        '  click A href "javascript:window.__pwned=1" _blank',
        '  click B call window.__pwned()',
      ].join("\n"),
    );
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(dialogs).toEqual([]);
    // Whatever was drawn, it is shown as a picture: no element from the diagram is in the page itself.
    expect(await page.locator('[data-testid="diagram-preview"]').evaluate((el) => el.tagName)).toBe("IMG");
    expect(await page.locator("svg [onerror], svg script, main script[src=x]").count()).toBe(0);
  });

  test("theme and background change the picture, and downloads are real files", async ({ page }) => {
    await page.goto("/tools/mermaid-editor");
    await drawn(page, "flowchart");
    const light = await preview(page).getAttribute("src");
    await page.getByLabel("Theme", { exact: true }).selectOption("dark");
    await expect.poll(() => preview(page).getAttribute("src")).not.toBe(light);

    await page.getByLabel("Theme", { exact: true }).selectOption("default");
    await page.getByLabel("Background").selectOption("transparent");
    await drawn(page, "flowchart");
    const [svgDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download SVG" }).click()]);
    expect(svgDownload.suggestedFilename()).toBe("sign-in-flow.svg");
    const svg = (await readFile((await svgDownload.path())!)).toString("utf8");
    expect(svg.startsWith('<?xml version="1.0"')).toBe(true);
    expect(svg).toMatch(/<svg width="\d+" height="\d+"/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toMatch(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="#ffffff"\/>/);

    await page.getByLabel("Background").selectOption("white");
    await page.getByLabel("PNG size").selectOption("2");
    const [pngDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PNG" }).click()]);
    expect(pngDownload.suggestedFilename()).toBe("sign-in-flow.png");
    const png = await readFile((await pngDownload.path())!);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const width = png.readUInt32BE(16);
    const svgWidth = Number(/<svg width="(\d+)"/.exec(svg)![1]);
    expect(width).toBe(svgWidth * 2);
    expect(png.length).toBeGreaterThan(2000);
  });

  test("the diagram is in the link, and survives a reload", async ({ page }) => {
    await page.goto("/tools/mermaid-editor");
    await text(page).fill("flowchart LR\n  Start --> Finish");
    await drawn(page, "flowchart");
    await expect(page).toHaveURL(/#s=/);
    await page.reload();
    await expect(text(page)).toHaveValue("flowchart LR\n  Start --> Finish");
    await drawn(page, "flowchart");
  });
});
