import { expect, test } from "@playwright/test";
import { appAlert } from "./helpers";

test.describe("catalogue", () => {
  test("search and category filters are reflected in the URL", async ({ page }) => {
    await page.goto("/tools");
    const total = await page.getByRole("status").first().textContent();
    expect(total).toMatch(/\d+ tools/);

    await page.getByRole("searchbox", { name: "Search tools" }).fill("pdf");
    await expect(page).toHaveURL(/q=pdf/);
    await expect(page.getByRole("link", { name: "Merge PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Case Converter" })).toHaveCount(0);

    await page.getByRole("button", { name: /^PDF/ }).click();
    await expect(page).toHaveURL(/category=pdf/);
    await expect(page.getByRole("link", { name: "Merge PDF" })).toBeVisible();
    // Categories with no matches for the search are disabled rather than leading to an empty page.
    await expect(page.getByRole("button", { name: /^Developer/ })).toBeDisabled();
  });

  test("deep links restore filters", async ({ page }) => {
    await page.goto("/tools?category=image&q=compress");
    await expect(page.getByRole("searchbox", { name: "Search tools" })).toHaveValue("compress");
    await expect(page.getByRole("link", { name: "Image Compressor" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Image/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("category pages list their tools", async ({ page }) => {
    await page.goto("/category/pdf");
    await expect(page.getByRole("heading", { level: 1, name: "PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Split PDF" })).toBeVisible();
  });
});

test.describe("tool pages", () => {
  test("sit on a plate with a catalogue number and a live status line instead of chips", async ({ page }) => {
    await page.goto("/tools/json-formatter");
    const plate = page.getByRole("region", { name: "JSON Formatter & Validator" });
    await expect(plate.getByText(/^Tool \d{3} · Developer$/)).toBeVisible();
    await expect(plate.getByTestId("outside-requests")).toHaveText("0");
    await expect(plate.getByText("Runs on this device")).toBeVisible();
    await expect(plate.getByText("Works offline once opened")).toBeVisible();
    // The old status pills are gone from the page header.
    await expect(page.getByText("Runs in your browser", { exact: true })).toHaveCount(0);
  });

  test("have SEO metadata, JSON-LD and related tools", async ({ page }) => {
    await page.goto("/tools/json-formatter");
    await expect(page).toHaveTitle(/JSON Formatter/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Pretty-print/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    // A script block can hold one object or an array of them.
    const types = blocks.flatMap((b) => [JSON.parse(b) as { "@type": string } | { "@type": string }[]].flat()).map((x) => x["@type"]);
    expect(types).toEqual(expect.arrayContaining(["WebApplication", "BreadcrumbList", "FAQPage", "HowTo"]));
    await expect(page.getByRole("heading", { name: "Related tools" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
    const og = await page.request.get("/tools/json-formatter/opengraph-image");
    expect(og.headers()["content-type"]).toContain("image/png");
  });

  test("JSON formatter formats, validates and reports errors", async ({ page }) => {
    await page.goto("/tools/json-formatter");
    const input = page.getByLabel("JSON", { exact: true });
    await input.fill('{"b":1,"a":[1,2]}');
    await expect(page.getByLabel("Result")).toHaveValue('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}');
    await expect(page.getByText(/Valid JSON/)).toBeVisible();

    await input.fill('{\n  "a": 1,\n  "b": }');
    await expect(appAlert(page)).toContainText("line 3");
  });

  test("input and options live in the URL hash and are restored", async ({ page, context }) => {
    await page.goto("/tools/case-converter");
    await page.getByLabel("Text", { exact: true }).fill("hello big world");
    await page.getByLabel("Convert to").selectOption("snake");
    await expect(page.getByLabel("Converted")).toHaveValue("hello_big_world");
    await expect.poll(() => page.url()).toContain("#s=");

    const shared = page.url();
    const second = await context.newPage();
    await second.goto(shared);
    await expect(second.getByLabel("Text", { exact: true })).toHaveValue("hello big world");
    await expect(second.getByLabel("Converted")).toHaveValue("hello_big_world");
  });

  test("copy button copies the result", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions differ");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/tools/base64-encoder");
    await page.getByLabel("Input", { exact: true }).fill("hello");
    await expect(page.getByLabel("Output")).toHaveValue("aGVsbG8=");
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("aGVsbG8=");
  });

  test("generators work on load", async ({ page }) => {
    await page.goto("/tools/password-generator");
    const pw = page.getByTestId("generated");
    await expect(pw).toHaveText(/.{20}/);
    const first = await pw.textContent();
    await page.getByRole("button", { name: "Regenerate" }).click();
    await expect(pw).not.toHaveText(first ?? "");
    await expect(page.getByText(/bits of entropy/)).toBeVisible();
  });

  test("calculators compute", async ({ page }) => {
    await page.goto("/tools/loan-calculator");
    await expect(page.getByTestId("payment")).toHaveText("$1,580.17");
    await page.getByLabel("Annual interest rate").fill("0");
    await expect(page.getByTestId("payment")).toHaveText("$694.44");
  });

  test("JSON diff lists differences by path and can ignore array order", async ({ page }) => {
    await page.goto("/tools/json-diff");
    await page.getByRole("button", { name: "Sample" }).click();
    await expect(page.getByRole("cell", { name: "$.age", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$.roles[0]", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$.address.zip", exact: true })).toBeVisible();

    await page.getByText("Ignore array order", { exact: true }).click();
    await expect(page.getByRole("cell", { name: "$.roles[2]", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$.roles[0]", exact: true })).toHaveCount(0);

    await page.getByLabel("Changed JSON").fill("{oops}");
    await expect(appAlert(page)).toContainText("changed side is not valid JSON");
  });

  test("cURL converter writes fetch code and keeps the command out of the URL", async ({ page }) => {
    await page.goto("/tools/curl-to-fetch");
    await page.getByLabel("cURL command").fill(`curl -X POST https://api.example.com/v1/items -H 'Authorization: Bearer SECRET-TOKEN' -d '{"a":1}' -H 'Content-Type: application/json'`);
    const output = page.getByLabel("fetch code");
    await expect(output).toHaveValue(/await fetch\("https:\/\/api\.example\.com\/v1\/items"/);
    await expect(output).toHaveValue(/"Authorization": "Bearer SECRET-TOKEN"/);
    await expect(output).toHaveValue(/body: JSON\.stringify\(/);
    expect(page.url()).not.toContain("#s=");

    await page.getByLabel("cURL command").fill("wget https://example.com");
    await expect(appAlert(page)).toContainText("start with");
  });

  test("JSON Schema generator infers types and optional keys", async ({ page }) => {
    await page.goto("/tools/json-schema-generator");
    await page.getByRole("button", { name: "Sample" }).click();
    const output = page.getByLabel("JSON Schema", { exact: true });
    await expect(output).toHaveValue(/"\$schema": "https:\/\/json-schema\.org\/draft\/2020-12\/schema"/);
    await expect(output).toHaveValue(/"format": "email"/);
    await expect(output).toHaveValue(/"nickname"/);
    const schema = JSON.parse(await output.inputValue()) as { items: { required: string[] } };
    expect(schema.items.required).toContain("email");
    expect(schema.items.required).not.toContain("nickname");
  });

  test("JSONPath tester lists matches with their paths and explains bad queries", async ({ page }) => {
    await page.goto("/tools/jsonpath-tester");
    await page.getByRole("button", { name: "Sample" }).click();
    await expect(page.getByRole("cell", { name: '"Moby Dick"', exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$['store']['book'][2]['title']", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: '"The Lord of the Rings"' })).toHaveCount(0);

    await page.getByRole("button", { name: "Every price" }).click();
    await expect(page.getByRole("cell", { name: "399", exact: true })).toBeVisible();

    await page.getByRole("textbox", { name: "JSONPath", exact: true }).fill("$.store.nothing");
    await expect(page.getByText("No matches.")).toBeVisible();

    await page.getByRole("textbox", { name: "JSONPath", exact: true }).fill("store.book");
    await expect(appAlert(page)).toContainText("must start with $");
  });

  test("HTML to Markdown converts the sample", async ({ page }) => {
    await page.goto("/tools/html-to-markdown");
    await page.getByRole("button", { name: "Sample" }).click();
    const output = page.getByLabel("Markdown", { exact: true });
    await expect(output).toHaveValue(/^# Release notes/);
    await expect(output).toHaveValue(/\[full changelog\]\(https:\/\/example\.com\/changelog\)/);
    await expect(output).toHaveValue(/\| Plan \| Price \|\n\| --- \| ---: \|/);
    await expect(output).toHaveValue(/```bash\nnpm install toolwright\n```/);

    await page.getByText("Keep links", { exact: true }).click();
    await expect(output).not.toHaveValue(/\]\(https/);
  });

  test("HTTP header explainer explains headers, grades them and keeps them out of the URL", async ({ page }) => {
    await page.goto("/tools/http-header-explainer");
    await page.getByRole("button", { name: "Sample response" }).click();
    await expect(page.getByText(/max-age=31536000: fresh for 1 year/)).toBeVisible();
    const checks = page.getByRole("list", { name: "Security checks" });
    await expect(checks).toContainText("Content-Security-Policy");
    await expect(checks).toContainText("Weak");
    await expect(checks).toContainText("Missing");
    expect(page.url()).not.toContain("#s=");

    await page.getByRole("button", { name: "Sample request" }).click();
    await expect(page.getByText("2 cookies: session, theme.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Security checks" })).toHaveCount(0);
  });

  test("mortgage affordability finds a price and checks the inputs", async ({ page }) => {
    await page.goto("/tools/mortgage-affordability-calculator");
    const price = page.getByTestId("max-price");
    await expect(price).toHaveText(/^\$[\d,]+$/);
    const before = Number((await price.textContent())?.replace(/[^\d]/g, ""));
    expect(before).toBeGreaterThan(100000);

    await page.getByLabel("Gross income per year").fill("180000");
    await expect(price).not.toHaveText(String(before));
    await expect.poll(async () => Number((await price.textContent())?.replace(/[^\d]/g, ""))).toBeGreaterThan(before);

    await page.getByLabel("Gross income per year").fill("0");
    await expect(page.getByText("Enter a yearly income above zero.")).toBeVisible();
  });

  test("salary converter converts between hourly and yearly pay", async ({ page }) => {
    await page.goto("/tools/salary-converter");
    await expect(page.getByTestId("pay-yearly")).toHaveText("$52,000.00");
    await expect(page.getByTestId("pay-monthly")).toHaveText("$4,333.33");
    await expect(page.getByTestId("headline-pay")).toHaveText("$52,000.00");

    await page.getByLabel("Paid", { exact: true }).selectOption("yearly");
    await page.getByLabel("Pay before tax").fill("104000");
    await expect(page.getByTestId("headline-pay")).toHaveText("$50.00");
    await page.getByLabel("Paid weeks per year").fill("50");
    await expect(page.getByTestId("pay-hourly")).toHaveText("$52.00");
  });

  test("QR generator renders a code and downloads SVG and PNG", async ({ page }) => {
    await page.goto("/tools/qr-code-generator");
    await expect(page.getByRole("img", { name: "Generated QR code" })).toBeVisible();
    const [svg] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "SVG" }).click()]);
    expect(svg.suggestedFilename()).toBe("qr-code.svg");
    const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PNG" }).click()]);
    expect(png.suggestedFilename()).toBe("qr-code.png");
  });
});

test.describe("favorites and recents", () => {
  test("starring a tool persists and shows on the home page", async ({ page }) => {
    await page.goto("/tools/unique-id-generator");
    const favorite = page.getByRole("button", { name: "Favorite", exact: true });
    await expect(favorite).toHaveAttribute("aria-pressed", "false");
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your bench" })).toBeVisible();
    await expect(page.getByRole("link", { name: "UUID, ULID & NanoID Generator" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your bench" })).toBeVisible();
  });

  test("recently used tools appear after visiting them", async ({ page }) => {
    await page.goto("/tools/word-counter");
    await expect(page.getByLabel("Your text")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("Recently used")).toBeVisible();
    await expect(page.getByRole("link", { name: "Word & Character Counter" }).first()).toBeVisible();
  });
});
