import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { getPdfInfo, organizePages, rotatePdf } from "../src/pdf";
import { collateDuplexScan, duplicatePage, initialPlan, isUntouched, movePage, planToOps, removePage, reversePlan, turnPage } from "../src/pdf-organizer";

/** Page `i` is `200 + i` points wide, so widths tell us which source page ended up where. */
async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 300]);
  return doc.save();
}

const sources = (plan: { source: number }[]) => plan.map((p) => p.source);

describe("organizePages", () => {
  it("reorders, removes and duplicates in one pass", async () => {
    const out = await organizePages(await makePdf(5), [{ source: 4 }, { source: 0 }, { source: 0 }, { source: 2 }]);
    const info = await getPdfInfo(out);
    expect(info.pages.map((p) => p.width)).toEqual([204, 200, 200, 202]);
  });

  it("adds rotation on top of the page's own rotation", async () => {
    const pdf = await rotatePdf(await makePdf(3), 90, [1]);
    const out = await organizePages(pdf, [
      { source: 0, rotate: 0 },
      { source: 1, rotate: 90 },
      { source: 2, rotate: 270 },
      { source: 1 },
    ]);
    expect((await getPdfInfo(out)).pages.map((p) => p.rotation)).toEqual([0, 180, 270, 90]);
  });

  it("wraps rotation past 360", async () => {
    const pdf = await rotatePdf(await makePdf(1), 270);
    const out = await organizePages(pdf, [{ source: 0, rotate: 180 }]);
    expect((await getPdfInfo(out)).pages[0]?.rotation).toBe(90);
  });

  it("keeps the same page count when nothing changes", async () => {
    const out = await organizePages(await makePdf(4), initialPlan(4).map((p) => ({ source: p.source })));
    expect((await getPdfInfo(out)).pageCount).toBe(4);
  });

  it("explains an empty page list", async () => {
    await expect(organizePages(await makePdf(2), [])).rejects.toThrow(/Keep at least one page/);
  });

  it("rejects pages that do not exist", async () => {
    await expect(organizePages(await makePdf(2), [{ source: 2 }])).rejects.toThrow(/Page 3 does not exist/);
    await expect(organizePages(await makePdf(2), [{ source: -1 }])).rejects.toThrow(/does not exist/);
    await expect(organizePages(await makePdf(2), [{ source: 0.5 }])).rejects.toThrow(/does not exist/);
  });

  it("explains a file that is not a PDF", async () => {
    await expect(organizePages(new Uint8Array([1, 2, 3]), [{ source: 0 }])).rejects.toThrow(/could not be read/);
  });
});

describe("plan editing", () => {
  it("starts with every page in order", () => {
    expect(sources(initialPlan(3))).toEqual([0, 1, 2]);
    expect(initialPlan(0)).toEqual([]);
  });

  it("moves a page and ignores impossible moves", () => {
    const plan = initialPlan(4);
    expect(sources(movePage(plan, 0, 2))).toEqual([1, 2, 0, 3]);
    expect(sources(movePage(plan, 3, 0))).toEqual([3, 0, 1, 2]);
    expect(movePage(plan, 0, 4)).toBe(plan);
    expect(movePage(plan, -1, 1)).toBe(plan);
    expect(movePage(plan, 2, 2)).toBe(plan);
  });

  it("turns a page by quarter turns, in both directions", () => {
    let plan = turnPage(initialPlan(2), 1, 1);
    expect(plan.map((p) => p.turn)).toEqual([0, 90]);
    plan = turnPage(plan, 1, 3);
    expect(plan[1]?.turn).toBe(0);
    expect(turnPage(initialPlan(1), 0, -1)[0]?.turn).toBe(270);
  });

  it("does not mutate the plan it is given", () => {
    const plan = initialPlan(3);
    turnPage(plan, 0, 1);
    movePage(plan, 0, 2);
    removePage(plan, 1);
    duplicatePage(plan, 1);
    expect(plan).toEqual(initialPlan(3));
  });

  it("removes a page", () => {
    expect(sources(removePage(initialPlan(3), 1))).toEqual([0, 2]);
  });

  it("duplicates a page with a fresh id and keeps its turn", () => {
    const plan = duplicatePage(turnPage(initialPlan(2), 0, 1), 0);
    expect(sources(plan)).toEqual([0, 0, 1]);
    expect(plan.map((p) => p.turn)).toEqual([90, 90, 0]);
    expect(new Set(plan.map((p) => p.id)).size).toBe(3);
    const again = duplicatePage(plan, 0);
    expect(new Set(again.map((p) => p.id)).size).toBe(4);
  });

  it("reverses the order", () => {
    expect(sources(reversePlan(initialPlan(3)))).toEqual([2, 1, 0]);
  });

  it("collates a duplex scan: fronts first, then backs in reverse", () => {
    // Fronts are pages 1-3, backs were scanned last-to-first as pages 4-6.
    expect(sources(collateDuplexScan(initialPlan(6)))).toEqual([0, 5, 1, 4, 2, 3]);
    expect(sources(collateDuplexScan(initialPlan(2)))).toEqual([0, 1]);
  });

  it("only collates an even number of pages", () => {
    expect(() => collateDuplexScan(initialPlan(5))).toThrow(/even number/);
    expect(() => collateDuplexScan(initialPlan(1))).toThrow(/even number/);
    expect(() => collateDuplexScan([])).toThrow(/even number/);
  });

  it("detects an untouched plan", () => {
    expect(isUntouched(initialPlan(3), 3)).toBe(true);
    expect(isUntouched(removePage(initialPlan(3), 2), 3)).toBe(false);
    expect(isUntouched(turnPage(initialPlan(3), 0, 1), 3)).toBe(false);
    expect(isUntouched(movePage(initialPlan(3), 0, 1), 3)).toBe(false);
  });

  it("converts a plan to operations", () => {
    expect(planToOps(turnPage(initialPlan(2), 1, 2))).toEqual([
      { source: 0, rotate: 0 },
      { source: 1, rotate: 180 },
    ]);
  });

  it("handles a plan for a very large document", () => {
    let plan = initialPlan(5000);
    plan = reversePlan(plan);
    plan = movePage(plan, 0, 4999);
    expect(plan).toHaveLength(5000);
    expect(plan[4999]?.source).toBe(4999);
  });
});
