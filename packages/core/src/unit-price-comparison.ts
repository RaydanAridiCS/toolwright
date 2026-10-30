/**
 * Compare the unit price of products sold in different sizes and units: which is the cheaper way to buy the same stuff?
 * Keep this file free of React, the DOM and the network.
 */

export type Dimension = "mass" | "volume" | "count" | "length";

export interface UnitDef {
  id: string;
  label: string;
  dimension: Dimension;
  /** How many base units (g, ml, each, m) one of this unit is. */
  factor: number;
}

/** US customary volume units are used for fl oz, cup, pint, quart and gallon. */
export const UNITS: UnitDef[] = [
  { id: "g", label: "grams (g)", dimension: "mass", factor: 1 },
  { id: "kg", label: "kilograms (kg)", dimension: "mass", factor: 1000 },
  { id: "oz", label: "ounces (oz)", dimension: "mass", factor: 28.349523125 },
  { id: "lb", label: "pounds (lb)", dimension: "mass", factor: 453.59237 },
  { id: "ml", label: "millilitres (ml)", dimension: "volume", factor: 1 },
  { id: "cl", label: "centilitres (cl)", dimension: "volume", factor: 10 },
  { id: "l", label: "litres (l)", dimension: "volume", factor: 1000 },
  { id: "floz", label: "fluid ounces (US fl oz)", dimension: "volume", factor: 29.5735295625 },
  { id: "cup", label: "cups (US)", dimension: "volume", factor: 236.5882365 },
  { id: "pint", label: "pints (US)", dimension: "volume", factor: 473.176473 },
  { id: "quart", label: "quarts (US)", dimension: "volume", factor: 946.352946 },
  { id: "gal", label: "gallons (US)", dimension: "volume", factor: 3785.411784 },
  { id: "each", label: "items, sheets or pieces", dimension: "count", factor: 1 },
  { id: "dozen", label: "dozen", dimension: "count", factor: 12 },
  { id: "m", label: "metres (m)", dimension: "length", factor: 1 },
  { id: "cm", label: "centimetres (cm)", dimension: "length", factor: 0.01 },
  { id: "ft", label: "feet (ft)", dimension: "length", factor: 0.3048 },
  { id: "yd", label: "yards (yd)", dimension: "length", factor: 0.9144 },
];

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));
export const unitById = (id: string) => BY_ID.get(id);

/** How a price is shown: "per 100 g", "per kg"… */
export interface DisplayUnit {
  id: string;
  label: string;
  dimension: Dimension;
  /** Base units in the amount the price is quoted for (100 g is 100). */
  amount: number;
}

export const DISPLAY_UNITS: DisplayUnit[] = [
  { id: "per-100g", label: "per 100 g", dimension: "mass", amount: 100 },
  { id: "per-kg", label: "per kg", dimension: "mass", amount: 1000 },
  { id: "per-oz", label: "per oz", dimension: "mass", amount: 28.349523125 },
  { id: "per-lb", label: "per lb", dimension: "mass", amount: 453.59237 },
  { id: "per-100ml", label: "per 100 ml", dimension: "volume", amount: 100 },
  { id: "per-l", label: "per litre", dimension: "volume", amount: 1000 },
  { id: "per-floz", label: "per fl oz", dimension: "volume", amount: 29.5735295625 },
  { id: "per-gal", label: "per gallon", dimension: "volume", amount: 3785.411784 },
  { id: "per-each", label: "per item", dimension: "count", amount: 1 },
  { id: "per-10", label: "per 10 items", dimension: "count", amount: 10 },
  { id: "per-100", label: "per 100 items", dimension: "count", amount: 100 },
  { id: "per-m", label: "per metre", dimension: "length", amount: 1 },
  { id: "per-ft", label: "per foot", dimension: "length", amount: 0.3048 },
];

export const defaultDisplayUnit = (dimension: Dimension): DisplayUnit => DISPLAY_UNITS.find((d) => d.dimension === dimension) as DisplayUnit;

export interface ItemInput {
  name?: string;
  /** What you pay for the whole package, as on the price tag. */
  price: number;
  /** Amount in one item, in `unit`. */
  quantity: number;
  unit: string;
  /** Number of items in the package (a 6-pack of 330 ml cans is quantity 330, packs 6). Default 1. */
  packs?: number;
}

export interface RankedItem {
  /** Position in the input. */
  index: number;
  name: string;
  /** Price for the display amount. */
  unitPrice: number;
  /** 1 is the cheapest. Items with the same unit price share a rank. */
  rank: number;
  /** How much more than the cheapest it costs per unit, as a fraction (0.25 is 25% more). 0 for the cheapest. */
  moreThanBest: number;
  /** Total amount you get, in base units. */
  totalBase: number;
  totalPrice: number;
}

export interface Comparison {
  dimension: Dimension;
  display: DisplayUnit;
  /** Cheapest first. */
  ranked: RankedItem[];
  /** How much of the dearest item's unit price you save by buying the cheapest, as a fraction. */
  savingVsDearest: number;
  /** Indexes of items that were skipped because a field was empty or invalid, with the reason. */
  skipped: { index: number; reason: string }[];
}

const DIMENSION_NAME: Record<Dimension, string> = { mass: "weight", volume: "volume", count: "count", length: "length" };

/**
 * Rank products by price per unit. Items with a blank price or quantity are skipped (and listed).
 * Throws when items measure different kinds of thing (grams and litres), since they cannot be compared.
 */
export function compareUnitPrices(items: ItemInput[], displayUnitId?: string): Comparison {
  const skipped: { index: number; reason: string }[] = [];
  const valid: { index: number; item: ItemInput; unit: UnitDef }[] = [];
  items.forEach((item, index) => {
    const unit = unitById(item.unit);
    if (!unit) return skipped.push({ index, reason: "unknown unit" });
    const packs = item.packs ?? 1;
    if (!Number.isFinite(item.price) || item.price < 0) return skipped.push({ index, reason: "price is missing or negative" });
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) return skipped.push({ index, reason: "quantity must be more than 0" });
    if (!Number.isFinite(packs) || packs < 1) return skipped.push({ index, reason: "the number of items in the pack must be at least 1" });
    valid.push({ index, item, unit });
  });
  if (valid.length < 2) throw new Error("Fill in the price and size of at least two products to compare them.");

  const dimension = (valid[0] as (typeof valid)[number]).unit.dimension;
  const clash = valid.find((v) => v.unit.dimension !== dimension);
  if (clash) {
    throw new Error(`Product ${(valid[0] as (typeof valid)[number]).index + 1} is measured by ${DIMENSION_NAME[dimension]} but product ${clash.index + 1} by ${DIMENSION_NAME[clash.unit.dimension]}. They cannot be compared.`);
  }
  const display = DISPLAY_UNITS.find((d) => d.id === displayUnitId && d.dimension === dimension) ?? defaultDisplayUnit(dimension);

  const rows = valid.map(({ index, item, unit }) => {
    const packs = item.packs ?? 1;
    const totalBase = item.quantity * unit.factor * packs;
    const totalPrice = item.price;
    return { index, name: item.name?.trim() || `Product ${index + 1}`, unitPrice: (totalPrice / totalBase) * display.amount, totalBase, totalPrice };
  });
  const best = Math.min(...rows.map((r) => r.unitPrice));
  const worst = Math.max(...rows.map((r) => r.unitPrice));
  const sorted = [...rows].sort((a, b) => a.unitPrice - b.unitPrice || a.index - b.index);
  let rank = 0;
  let previous = Number.NaN;
  const ranked: RankedItem[] = sorted.map((r, i) => {
    if (!sameMoney(r.unitPrice, previous)) rank = i + 1;
    previous = r.unitPrice;
    return { ...r, rank, moreThanBest: best > 0 ? r.unitPrice / best - 1 : 0 };
  });
  return { dimension, display, ranked, savingVsDearest: worst > 0 ? 1 - best / worst : 0, skipped };
}

/** Prices that agree to a tenth of a cent are a tie. */
const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.0005 * Math.max(1, Math.abs(a));
