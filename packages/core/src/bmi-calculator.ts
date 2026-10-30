/**
 * Body mass index for adults, with the WHO categories. BMI is a rough screening number, not a diagnosis:
 * it ignores muscle, bone, body shape, age and ethnicity. Keep this file free of React, the DOM and the network.
 */

export type BmiCategoryId = "severe-thinness" | "moderate-thinness" | "mild-thinness" | "normal" | "overweight" | "obese-1" | "obese-2" | "obese-3";

export interface BmiCategory {
  id: BmiCategoryId;
  label: string;
  /** Lower bound of the band, inclusive. */
  from: number;
}

/** WHO adult classification. */
export const BMI_CATEGORIES: BmiCategory[] = [
  { id: "severe-thinness", label: "Severe thinness", from: 0 },
  { id: "moderate-thinness", label: "Moderate thinness", from: 16 },
  { id: "mild-thinness", label: "Mild thinness", from: 17 },
  { id: "normal", label: "Healthy range", from: 18.5 },
  { id: "overweight", label: "Overweight", from: 25 },
  { id: "obese-1", label: "Obesity, class I", from: 30 },
  { id: "obese-2", label: "Obesity, class II", from: 35 },
  { id: "obese-3", label: "Obesity, class III", from: 40 },
];

export const HEALTHY_BMI = { min: 18.5, max: 24.9 } as const;
export const LIMITS = { heightCm: { min: 100, max: 250 }, weightKg: { min: 20, max: 500 }, minAge: 18 } as const;

export interface BmiInput {
  weightKg: number;
  heightCm: number;
  /** Optional. BMI categories are for adults, so under 18 is refused. */
  ageYears?: number;
}

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  /** Weights (kg) that fall in the healthy BMI range at this height. */
  healthyWeightKg: { min: number; max: number };
  /** Kilograms above the top of the healthy range (positive), below its bottom (negative) or 0 inside it. */
  kgFromHealthyRange: number;
}

export const lbToKg = (lb: number) => lb * 0.45359237;
export const kgToLb = (kg: number) => kg / 0.45359237;
export const inToCm = (inches: number) => inches * 2.54;
export const feetInchesToCm = (feet: number, inches: number) => inToCm(feet * 12 + inches);
export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const total = cm / 2.54;
  const feet = Math.floor(total / 12);
  return { feet, inches: Math.round((total - feet * 12) * 10) / 10 };
};

export function categoryFor(bmi: number): BmiCategory {
  let found = BMI_CATEGORIES[0] as BmiCategory;
  for (const c of BMI_CATEGORIES) if (bmi >= c.from) found = c;
  return found;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Calculate BMI. Throws readable errors for impossible or out-of-scope input. */
export function calculateBmi({ weightKg, heightCm, ageYears }: BmiInput): BmiResult {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) throw new Error("Enter a height and a weight.");
  if (ageYears !== undefined && Number.isFinite(ageYears) && ageYears < LIMITS.minAge) {
    throw new Error("BMI categories are for adults. For children and teenagers, doctors compare BMI with growth charts for their age and sex, which this tool does not have.");
  }
  if (heightCm < LIMITS.heightCm.min || heightCm > LIMITS.heightCm.max) throw new Error(`Height should be between ${LIMITS.heightCm.min} and ${LIMITS.heightCm.max} cm (3 ft 3 in to 8 ft 2 in).`);
  if (weightKg < LIMITS.weightKg.min || weightKg > LIMITS.weightKg.max) throw new Error(`Weight should be between ${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg (44 to 1,100 lb).`);

  const m = heightCm / 100;
  const bmi = round1(weightKg / (m * m));
  const min = round1(HEALTHY_BMI.min * m * m);
  const max = round1(HEALTHY_BMI.max * m * m);
  const diff = weightKg > max ? weightKg - max : weightKg < min ? weightKg - min : 0;
  return { bmi, category: categoryFor(bmi), healthyWeightKg: { min, max }, kgFromHealthyRange: round1(diff) };
}

/** What BMI cannot tell you. Shown with every result. */
export const BMI_CAVEATS = [
  "BMI only compares weight with height. It cannot tell muscle from fat, so athletes and very muscular people can read as overweight.",
  "It does not account for age, sex, body shape or where fat is carried. Waist size and other measurements say more about health risk.",
  "The cut-offs come from studies of mostly white populations. Some health bodies use lower cut-offs for people of South and East Asian descent (about 23 for overweight).",
  "It is not for children, teenagers, or during pregnancy. It is a screening number, not a diagnosis. For advice about your health, ask a doctor.",
] as const;
