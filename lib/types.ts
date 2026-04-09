export type Category =
  | "meat_fish"
  | "dairy_eggs"
  | "legumes_grains"
  | "vegetables"
  | "other";

export type Tier = "good" | "mid" | "low";

export type MacroPriority = "default" | "protein_first" | "carb_first";

export interface Food {
  id: string;
  name: string;
  category: Category;
  protein: number;
  calories: number;
  fat: number;
  saturated_fat: number;
  fiber: number;
  carbs: number;
  net_carbs: number;
  sodium: number;
  is_processed: boolean;
  who_compliant: boolean;
  usda_fdc_id: string | null;
  created_at: string;
}

export interface Price {
  id: string;
  food_id: string;
  price_per_kg: number;
  updated_at: string;
}

export interface Score {
  id: string;
  food_id: string;
  pyf_raw: number;
  pyf_normalized: number;
  category_rank: number;
  global_rank: number;
  tier: Tier;
  calculated_at: string;
}

export interface ConfigLog {
  id: string;
  changed_at: string;
  changed_by: string;
  snapshot: Record<string, unknown>;
}

export interface FoodWithDetails extends Food {
  price: Price | null;
  average_price_per_kg: number | null;
  score: Score | null;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  meat_fish: "Meat & Fish",
  dairy_eggs: "Dairy & Eggs",
  legumes_grains: "Legumes & Grains",
  vegetables: "Vegetables",
  other: "Other",
};
