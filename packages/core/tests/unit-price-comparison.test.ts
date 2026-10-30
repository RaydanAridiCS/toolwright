import { describe, expect, it } from "vitest";
import { compareUnitPrices, DISPLAY_UNITS, UNITS, unitById } from "../src/unit-price-comparison";

describe("compareUnitPrices", () => {
  it("ranks products of different sizes by price per 100 g", () => {
    const r = compareUnitPrices([
      { name: "Small", price: 2.5, quantity: 400, unit: "g" },
      { name: "Big", price: 4.2, quantity: 1, unit: "kg" },
      { name: "Medium", price: 3.2, quantity: 750, unit: "g" },
    ]);
    expect(r.dimension).toBe("mass");
    expect(r.display.label).toBe("per 100 g");
    expect(r.ranked.map((x) => x.name)).toEqual(["Big", "Medium", "Small"]);
    expect(r.ranked.map((x) => Number(x.unitPrice.toFixed(3)))).toEqual([0.42, 0.427, 0.625]);
    expect(r.ranked.map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(r.ranked[0]?.moreThanBest).toBe(0);
    expect(r.ranked[2]?.moreThanBest).toBeCloseTo(0.625 / 0.42 - 1, 6);
    expect(r.savingVsDearest).toBeCloseTo(1 - 0.42 / 0.625, 6);
  });

  it("compares metric with US customary units correctly", () => {
    const r = compareUnitPrices([
      { name: "Gallon", price: 3.79, quantity: 1, unit: "gal" },
      { name: "Litre", price: 1.1, quantity: 1, unit: "l" },
    ], "per-l");
    expect(r.ranked[0]?.name).toBe("Gallon");
    expect(r.ranked[0]?.unitPrice).toBeCloseTo(3.79 / 3.785411784, 6);
    expect(r.ranked[1]?.unitPrice).toBeCloseTo(1.1, 9);
  });

  it("multiplies the size by the number of items in the pack, and uses the price on the tag as it is", () => {
    const r = compareUnitPrices([
      { name: "6-pack", price: 5.4, quantity: 330, unit: "ml", packs: 6 }, // 1980 ml for 5.40
      { name: "Bottle", price: 3.5, quantity: 1, unit: "l" },
    ], "per-l");
    const six = r.ranked.find((x) => x.name === "6-pack")!;
    expect(six.totalBase).toBe(1980);
    expect(six.totalPrice).toBe(5.4);
    expect(six.unitPrice).toBeCloseTo(5.4 / 1.98, 6);
    expect(r.ranked[0]?.name).toBe("6-pack");
    expect(r.ranked[1]?.unitPrice).toBeCloseTo(3.5, 9);
  });

  it("handles counts, dozens and lengths", () => {
    expect(compareUnitPrices([{ price: 3.6, quantity: 1, unit: "dozen" }, { price: 0.28, quantity: 1, unit: "each" }]).ranked.map((x) => Number(x.unitPrice.toFixed(2)))).toEqual([0.28, 0.3]);
    const lengths = compareUnitPrices([{ price: 10, quantity: 10, unit: "m" }, { price: 4, quantity: 10, unit: "ft" }], "per-m");
    expect(lengths.ranked.map((x) => x.unitPrice)).toEqual([1, 4 / 3.048]);
  });

  it("gives equal prices the same rank, and names unnamed products", () => {
    const r = compareUnitPrices([{ price: 2, quantity: 200, unit: "g" }, { price: 1, quantity: 100, unit: "g" }, { price: 3, quantity: 100, unit: "g" }]);
    expect(r.ranked.map((x) => x.rank)).toEqual([1, 1, 3]);
    expect(r.ranked.map((x) => x.name)).toEqual(["Product 1", "Product 2", "Product 3"]);
  });

  it("skips incomplete products and lists why", () => {
    const r = compareUnitPrices([
      { price: 2, quantity: 100, unit: "g" },
      { price: Number.NaN, quantity: 100, unit: "g" },
      { price: 3, quantity: 0, unit: "g" },
      { price: 1, quantity: 50, unit: "g" },
      { price: 1, quantity: 50, unit: "furlong" },
    ]);
    expect(r.ranked).toHaveLength(2);
    expect(r.skipped.map((s) => s.index)).toEqual([1, 2, 4]);
    expect(r.skipped[0]?.reason).toMatch(/price/);
  });

  it("refuses to compare things measured in different ways, naming the products", () => {
    expect(() => compareUnitPrices([{ price: 1, quantity: 100, unit: "g" }, { price: 1, quantity: 1, unit: "l" }])).toThrow(/Product 1 is measured by weight but product 2 by volume/);
  });

  it("needs two valid products", () => {
    expect(() => compareUnitPrices([{ price: 1, quantity: 100, unit: "g" }])).toThrow(/at least two/);
    expect(() => compareUnitPrices([])).toThrow(/at least two/);
  });

  it("falls back to a sensible display unit when the chosen one does not fit", () => {
    expect(compareUnitPrices([{ price: 1, quantity: 100, unit: "g" }, { price: 2, quantity: 100, unit: "g" }], "per-l").display.id).toBe("per-100g");
  });

  it("handles free items without dividing by zero", () => {
    const r = compareUnitPrices([{ price: 0, quantity: 100, unit: "g" }, { price: 2, quantity: 100, unit: "g" }]);
    expect(r.ranked[0]?.unitPrice).toBe(0);
    expect(r.ranked[1]?.moreThanBest).toBe(0);
  });
});

describe("unit tables", () => {
  it("every display unit has a unit of its dimension, and every unit id is unique", () => {
    for (const d of DISPLAY_UNITS) expect(UNITS.some((u) => u.dimension === d.dimension)).toBe(true);
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length);
    expect(unitById("lb")?.factor).toBeCloseTo(453.59237, 5);
  });
});
