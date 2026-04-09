export const FORMULA_CONFIG = {
  weights: {
    protein: 0.32, // a — main driver
    calories: -0.18, // b — negative
    fat: -0.18, // c — negative
    price: -0.12, // d — negative
    fiber: 0.08, // e — support
    proteinPerCalorie: 0.05, // f
    fiberPerCalorie: 0.03, // g
    proteinPerPrice: 0.04, // h
  },
  references: {
    protein: 20, // g per 100g
    calories: 300, // kcal per 100g
    fat: 15, // g per 100g
    fiber: 5, // g per 100g
    carbs: 30, // g per 100g
  },
  thresholds: {
    goodTierPercentile: 0.3, // top 30% = good
  },
  who: {
    maxSaturatedFatPct: 10, // % of total calories
    minFiberPer100g: 3,
    maxSodiumPer100g: 400,
  },
} as const;

export type FormulaConfig = typeof FORMULA_CONFIG;
