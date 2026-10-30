import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

const PAGES = [
  "/",
  "/tools",
  "/category/developer",
  "/requests",
  "/privacy",
  "/about",
  "/contribute",
  "/tools/json-formatter",
  "/tools/text-diff",
  "/tools/regex-tester",
  "/tools/password-generator",
  "/tools/unit-converter",
  "/tools/loan-calculator",
  "/tools/color-converter",
  "/tools/contrast-checker",
  "/tools/qr-code-generator",
  "/tools/merge-pdf",
  "/tools/image-compressor",
  "/tools/hash-generator",
  "/tools/http-status-codes",
  "/tools/chmod-calculator",
  "/tools/date-calculator",
  "/tools/json-diff",
  "/tools/curl-to-fetch",
  "/tools/json-schema-generator",
  "/tools/pdf-organizer",
  "/tools/favicon-generator",
  "/tools/jsonpath-tester",
  "/tools/html-to-markdown",
  "/tools/http-header-explainer",
  "/tools/mortgage-affordability-calculator",
  "/tools/salary-converter",
  "/tools/compress-pdf",
  "/tools/fetch-to-curl",
  "/tools/json-merge",
  "/tools/graphql-formatter",
  "/tools/dockerfile-linter",
  "/tools/yaml-validator",
  "/tools/readability-score",
  "/tools/bmi-calculator",
  "/tools/unit-price-comparison",
  "/tools/meeting-planner",
  "/tools/sign-pdf",
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PAGES) {
      test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.locator("main").first().waitFor();
        expect(await scan(page)).toEqual([]);
      });
    }
  });
}

test("the command palette is accessible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Search/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("focus is visible and moves logically through the header", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard only");
  await page.goto("/");
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab"); // logo
  await expect(page.getByRole("link", { name: "Toolwright home" })).toBeFocused();
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
});

test("the reduced-motion preference is respected", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const behavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  expect(behavior).toBe("auto");
});
