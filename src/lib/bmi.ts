/**
 * BMI calculation utility
 * BMI = weight(kg) / [height(m)]²
 */

export type BMICategory =
  | "underweight"
  | "normal"
  | "overweight"
  | "obese";

export interface BMIResult {
  value: number;
  category: BMICategory;
  label: string;
}

/**
 * Calculate BMI from height (cm) and weight (kg).
 * Returns null if inputs are invalid.
 */
export function calculateBMI(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined
): BMIResult | null {
  if (
    heightCm == null ||
    weightKg == null ||
    isNaN(heightCm) ||
    isNaN(weightKg) ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return null;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const value = Math.round(bmi * 10) / 10;

  let category: BMICategory;
  let label: string;

  if (value < 18.5) {
    category = "underweight";
    label = "Underweight";
  } else if (value < 25) {
    category = "normal";
    label = "Normal";
  } else if (value < 30) {
    category = "overweight";
    label = "Overweight";
  } else {
    category = "obese";
    label = "Obese";
  }

  return { value, category, label };
}

/**
 * Get the color class for a BMI category badge.
 */
export function getBMIColor(category: BMICategory): string {
  switch (category) {
    case "underweight":
      return "text-blue-500 bg-blue-500/10";
    case "normal":
      return "text-emerald-500 bg-emerald-500/10";
    case "overweight":
      return "text-amber-500 bg-amber-500/10";
    case "obese":
      return "text-red-500 bg-red-500/10";
  }
}
