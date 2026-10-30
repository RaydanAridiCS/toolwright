import { describe, expect, it } from "vitest";
import { BMI_CAVEATS, calculateBmi, categoryFor, cmToFeetInches, feetInchesToCm, inToCm, kgToLb, lbToKg } from "../src/bmi-calculator";

describe("calculateBmi", () => {
  it("matches the formula kg / m^2", () => {
    expect(calculateBmi({ weightKg: 70, heightCm: 175 }).bmi).toBe(22.9);
    expect(calculateBmi({ weightKg: 100, heightCm: 180 }).bmi).toBe(30.9);
    expect(calculateBmi({ weightKg: 50, heightCm: 170 }).bmi).toBe(17.3);
  });

  it("puts values on the WHO band edges in the higher band", () => {
    expect(categoryFor(18.4).id).toBe("mild-thinness");
    expect(categoryFor(18.5).id).toBe("normal");
    expect(categoryFor(24.9).id).toBe("normal");
    expect(categoryFor(25).id).toBe("overweight");
    expect(categoryFor(29.9).id).toBe("overweight");
    expect(categoryFor(30).id).toBe("obese-1");
    expect(categoryFor(35).id).toBe("obese-2");
    expect(categoryFor(40).id).toBe("obese-3");
    expect(categoryFor(15.9).id).toBe("severe-thinness");
    expect(categoryFor(16).id).toBe("moderate-thinness");
    expect(categoryFor(17).id).toBe("mild-thinness");
  });

  it("gives the healthy weight range for the height, and the distance from it", () => {
    const inside = calculateBmi({ weightKg: 70, heightCm: 175 });
    expect(inside.healthyWeightKg).toEqual({ min: 56.7, max: 76.3 });
    expect(inside.kgFromHealthyRange).toBe(0);
    expect(calculateBmi({ weightKg: 90, heightCm: 175 }).kgFromHealthyRange).toBe(13.7);
    expect(calculateBmi({ weightKg: 50, heightCm: 175 }).kgFromHealthyRange).toBe(-6.7);
  });

  it("refuses children and teenagers, and says why", () => {
    expect(() => calculateBmi({ weightKg: 50, heightCm: 160, ageYears: 15 })).toThrow(/growth charts/);
    expect(calculateBmi({ weightKg: 70, heightCm: 175, ageYears: 18 }).bmi).toBe(22.9);
    expect(calculateBmi({ weightKg: 70, heightCm: 175, ageYears: Number.NaN }).bmi).toBe(22.9);
  });

  it("refuses impossible heights and weights, and missing input", () => {
    expect(() => calculateBmi({ weightKg: 70, heightCm: 50 })).toThrow(/Height should be between/);
    expect(() => calculateBmi({ weightKg: 70, heightCm: 300 })).toThrow(/Height/);
    expect(() => calculateBmi({ weightKg: 5, heightCm: 170 })).toThrow(/Weight should be between/);
    expect(() => calculateBmi({ weightKg: Number.NaN, heightCm: 170 })).toThrow(/Enter a height and a weight/);
    expect(() => calculateBmi({ weightKg: 70, heightCm: Infinity })).toThrow(/Enter a height/);
  });
});

describe("unit conversions", () => {
  it("converts pounds, inches and feet exactly", () => {
    expect(lbToKg(154.3236)).toBeCloseTo(70, 3);
    expect(kgToLb(lbToKg(180))).toBeCloseTo(180, 9);
    expect(inToCm(10)).toBe(25.4);
    expect(feetInchesToCm(5, 9)).toBeCloseTo(175.26, 2);
  });

  it("splits centimetres into feet and inches", () => {
    expect(cmToFeetInches(175.26)).toEqual({ feet: 5, inches: 9 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });
});

describe("caveats", () => {
  it("covers muscle, body shape, ethnicity and age, and says it is not a diagnosis", () => {
    const text = BMI_CAVEATS.join(" ");
    for (const word of ["muscle", "Waist", "Asian", "children", "not a diagnosis"]) expect(text).toContain(word);
  });
});
