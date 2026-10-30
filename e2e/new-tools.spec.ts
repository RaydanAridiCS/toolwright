import { expect, test } from "@playwright/test";
import { appAlert } from "./helpers";

test.describe("developer tools", () => {
  test("fetch to cURL reads the code without running it and keeps it out of the URL", async ({ page }) => {
    await page.goto("/tools/fetch-to-curl");
    await page.getByRole("button", { name: "Sample" }).click();
    const output = page.getByRole("textbox", { name: "cURL command", exact: true });
    await expect(output).toHaveValue(/curl 'https:\/\/api\.example\.com\/v1\/users'/);
    await expect(output).toHaveValue(/-H 'Authorization: Bearer YOUR_TOKEN'/);
    await expect(output).toHaveValue(/--data-raw '\{"name":"Ada Lovelace","email":"ada@example\.com"\}'/);
    expect(page.url()).not.toContain("#s=");

    const input = page.getByRole("textbox", { name: "fetch code", exact: true });
    await input.fill("fetch(`https://x.test/${id}`, { headers: { Authorization: 'Bearer ' + token } })");
    await expect(output).toHaveValue(/'Authorization: Bearer \$\{token\}'/);
    await expect(output).toHaveValue(/# Note: Parts that come from variables/);

    await input.fill("const x = 1;");
    await expect(appAlert(page)).toContainText("No fetch");
  });

  test("JSON merge combines two edits, lists the conflict and keeps the data off the URL", async ({ page }) => {
    await page.goto("/tools/json-merge");
    await page.getByRole("button", { name: "Load a sample" }).click();
    await expect(page.getByTestId("merge-summary")).toHaveText("1 conflict");
    const merged = page.getByRole("textbox", { name: "Merged JSON", exact: true });
    await expect(merged).toHaveValue(/"version": "1\.1\.0"/); // only you changed it
    await expect(merged).toHaveValue(/"beta": true/); // you added it
    await expect(merged).toHaveValue(/"billing": true/); // they changed it
    await expect(merged).toHaveValue(/"id": 3/); // they added a person
    await expect(merged).toHaveValue(/"port": 8080/); // the conflict: your version wins by default
    await expect(page.getByRole("row", { name: /\$\.port/ })).toBeVisible();
    await page.getByLabel("When both changed the same value").selectOption("theirs");
    await expect(merged).toHaveValue(/"port": 9000/);
    expect(page.url()).not.toContain("#s=");

    await page.getByRole("textbox", { name: "Base", exact: true }).fill("{");
    await expect(appAlert(page)).toContainText("The base (common ancestor) is not valid JSON");
  });

  test("GraphQL formatter lays out a query, minifies it, and names the bad line", async ({ page }) => {
    await page.goto("/tools/graphql-formatter");
    await page.getByRole("button", { name: "Sample" }).click();
    const output = page.getByRole("textbox", { name: "Formatted GraphQL", exact: true });
    await expect(output).toHaveValue(/query GetUser\(\$id: ID!, \$first: Int = 10\) \{\n {2}user\(id: \$id\) \{/);
    await expect(output).toHaveValue(/fragment Profile on User \{\n {2}avatarUrl\(size: 64\)\n {2}bio\n\}/);
    await page.getByLabel("Action").selectOption("minify");
    await expect(output).toHaveValue(/^query GetUser\(\$id:ID!\$first:Int=10\)\{user\(id:\$id\)/);
    await page.getByRole("textbox", { name: "GraphQL", exact: true }).fill("{\n  a {\n    b\n}");
    await expect(appAlert(page)).toContainText("on line 1 is never closed");
  });

  test("Dockerfile linter explains each finding with a fix", async ({ page }) => {
    await page.goto("/tools/dockerfile-linter");
    await page.getByRole("button", { name: "Sample" }).click();
    await expect(page.getByTestId("lint-summary")).toContainText("finding");
    const findings = page.getByRole("list", { name: "Findings" });
    await expect(findings).toContainText(":latest");
    await expect(findings).toContainText("apt-get install without -y");
    await expect(findings).toContainText("runs whatever the server sends");
    await expect(findings).toContainText("secret");
    await expect(findings).toContainText("Fix:");
    expect(page.url()).not.toContain("#s=");
    await page.getByRole("textbox", { name: "Dockerfile", exact: true }).fill('FROM node:22-slim\nUSER node\nCMD ["node", "app.js"]\n');
    await expect(page.getByTestId("lint-summary")).toHaveText("No problems found");
  });

  test("YAML validator points at the line of an error and flags yes/no traps", async ({ page }) => {
    await page.goto("/tools/yaml-validator");
    await page.getByRole("button", { name: "Sample" }).click();
    await expect(page.getByTestId("yaml-summary")).toHaveText("Valid YAML");
    const notes = page.getByRole("list", { name: "Issues" });
    await expect(notes).toContainText("boolean in YAML 1.1");
    await expect(notes).toContainText("octal");
    await expect(notes).toContainText("trailing zero");
    await expect(page.getByRole("textbox", { name: "YAML as JSON" })).toHaveValue(/"replicas": 3/);

    await page.getByRole("textbox", { name: "YAML", exact: true }).fill("a:\n  b: 1\n c: 2\n");
    await expect(page.getByTestId("yaml-summary")).toHaveText("Not valid YAML");
    await expect(page.getByRole("list", { name: "Issues" })).toContainText("Line 3");
  });
});

test.describe("text and calculator tools", () => {
  test("readability checker scores the sample and lists hard sentences", async ({ page }) => {
    await page.goto("/tools/readability-score");
    await page.getByRole("button", { name: "Sample" }).click();
    const score = Number(await page.getByTestId("flesch-score").innerText());
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThan(90);
    await expect(page.getByText("Grade level (US school years)")).toBeVisible();
    await expect(page.getByRole("list", { name: "Hard sentences" })).toContainText("winding sentence");
    expect(page.url()).not.toContain("#s=");
  });

  test("BMI calculator works in both unit systems, refuses teenagers and keeps health data out of the URL", async ({ page }) => {
    await page.goto("/tools/bmi-calculator");
    await expect(page.getByTestId("bmi-value")).toHaveText("22.9");
    await page.getByRole("radio", { name: /Imperial/ }).check({ force: true });
    await page.getByLabel("Weight", { exact: true }).fill("220");
    await page.getByLabel("Height", { exact: true }).fill("5");
    await page.getByLabel("Inches", { exact: true }).fill("9");
    await expect(page.getByTestId("bmi-value")).toHaveText("32.5");
    await expect(page.getByText("What BMI cannot tell you").first()).toBeVisible();
    await page.getByLabel("Age (optional)").fill("15");
    await expect(appAlert(page)).toContainText("growth charts");
    expect(page.url()).not.toContain("#");
  });

  test("unit price comparison finds the cheapest product and explains mismatched units", async ({ page }) => {
    await page.goto("/tools/unit-price-comparison");
    await expect(page.getByTestId("best-buy")).toContainText("Family pack");
    await expect(page.getByRole("row", { name: /Name brand/ })).toContainText("more");
    await page.getByLabel("Product 1 unit").selectOption("l");
    await expect(page.getByText(/measured by volume/)).toBeVisible();
    await page.getByLabel("Product 1 unit").selectOption("kg");
    await page.getByLabel("Product 1 size of one item").fill("0.8");
    await expect(page.getByTestId("best-buy")).toContainText("Store brand");
  });

  test("meeting planner finds the overlap in real daylight-saving terms, and can be shared", async ({ page }) => {
    await page.goto("/tools/meeting-planner");
    await page.getByLabel(/^Date in/).fill("2026-01-15");
    // New York, London and Mumbai have no common working hours.
    await expect(page.getByText("No time suits everyone")).toBeVisible();
    await page.getByRole("button", { name: "Remove person 3" }).click();
    // New York 09:00-12:00 is London 14:00-17:00 in winter.
    await expect(page.getByTestId("meeting-window")).toHaveText("Thu 09:00 to Thu 12:00");
    await page.getByLabel(/^Date in/).fill("2026-03-16");
    // Between the two clock changes New York is only four hours behind London: 09:00-13:00 in New York.
    await expect(page.getByTestId("meeting-window")).toHaveText("Mon 09:00 to Mon 13:00");
    await page.getByLabel("Person 2 time zone").fill("Mars/Base");
    await expect(appAlert(page)).toContainText("not a time zone name");
    await expect(page).toHaveURL(/#s=/);
  });
});
