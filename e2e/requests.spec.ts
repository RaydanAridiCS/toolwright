import { expect, test } from "@playwright/test";

// Runs against the in-memory repository (no DATABASE_URL), which is seeded with a few ideas.
test.describe("tool request board", () => {
  test("lists seeded ideas and explains demo mode", async ({ page }) => {
    await page.goto("/requests");
    await expect(page.getByRole("heading", { name: /^Ideas/ })).toBeVisible();
    await expect(page.getByText("Image background remover")).toBeVisible();
    await expect(page.getByText("Demo mode")).toBeVisible();
  });

  test("submit an idea, see it with your vote, and reject duplicates", async ({ page }) => {
    const title = `Regex railroad diagrams ${Date.now()}`;
    await page.goto("/requests");
    await page.getByLabel("What should we build?").fill(title);
    await page.getByLabel(/Why would it help/).fill("Visualize patterns as diagrams.");
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByText(/Your idea is on the board/)).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: /Remove your vote/ })).toBeVisible();

    // Same title again → friendly duplicate message.
    await page.getByLabel("What should we build?").fill(title.toUpperCase());
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already suggested" })).toBeVisible();
  });

  test("the status filter narrows the list", async ({ page }) => {
    await page.goto("/requests");
    await expect(page.getByText("Image background remover")).toBeVisible();
    await page.getByText("Shipped", { exact: true }).click();
    await expect(page.getByText(/Nothing is marked/)).toBeVisible();
    await page.getByText("All", { exact: true }).click();
    await expect(page.getByText("Image background remover")).toBeVisible();
  });

  test("the health endpoint answers without secrets", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toBe("no-store");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Object.keys(body.database).sort()).toEqual(["mode", "persistent", "state"]);
  });

  test("voting toggles and updates the count", async ({ page }) => {
    await page.goto("/requests");
    const card = page.getByRole("listitem").filter({ hasText: "JSON diff and merge" });
    const vote = card.getByRole("button", { name: /^Vote for JSON diff and merge/ });
    await expect(vote).toBeVisible();
    await vote.click();
    const remove = card.getByRole("button", { name: /^Remove your vote from JSON diff and merge. 1 vote$/ });
    await expect(remove).toBeVisible();
    await remove.click();
    await expect(card.getByRole("button", { name: /^Vote for JSON diff and merge. 0 votes$/ })).toBeVisible();
  });

  test("voting survives a reload (same browser token)", async ({ page }) => {
    await page.goto("/requests");
    const card = page.getByRole("listitem").filter({ hasText: "Audio trimmer and converter" });
    await card.getByRole("button", { name: /^Vote for/ }).click();
    await expect(card.getByRole("button", { name: /^Remove your vote/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: "Audio trimmer and converter" }).getByRole("button", { name: /^Remove your vote/ })).toBeVisible();
  });

  test("validation errors are friendly", async ({ page }) => {
    await page.goto("/requests");
    await expect(page.getByRole("button", { name: "Submit idea" })).toBeDisabled();
    await page.getByLabel("What should we build?").fill("abcd");
    await expect(page.getByRole("button", { name: "Submit idea" })).toBeEnabled();
  });

  test("the API validates input and never stores the raw token", async ({ request }) => {
    const bad = await request.post("/api/requests", { data: { title: "x" }, headers: { "x-tw-token": "t".repeat(20) } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error.code).toBe("invalid");

    const noToken = await request.post("/api/requests", { data: { title: "A perfectly fine title" } });
    expect(noToken.status()).toBe(400);

    const huge = await request.post("/api/requests", { data: { title: "a".repeat(20000) }, headers: { "x-tw-token": "t".repeat(20) } });
    expect(huge.status()).toBe(413);

    const list = await request.get("/api/requests?sort=new&limit=3");
    expect(list.ok()).toBe(true);
    const body = await list.json();
    expect(body.requests.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(body)).not.toContain("creatorHash");

    const missing = await request.post("/api/requests/00000000-0000-4000-8000-000000000000/vote", { headers: { "x-tw-token": "t".repeat(20) } });
    expect(missing.status()).toBe(404);
  });

  test("the honeypot field silently blocks bots", async ({ request }) => {
    const res = await request.post("/api/requests", { data: { title: "Totally legit idea", website: "http://spam.example" }, headers: { "x-tw-token": "h".repeat(20) } });
    expect(res.status()).toBe(400);
  });
});
