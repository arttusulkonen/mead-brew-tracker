/*
 * File: src/types/ingredient.ts
 * Description: Type definitions for global and workspace ingredients.
 * Supports multi-beverage types including Beer, Mead, and Cider.
 */

export const INGREDIENT_CATEGORIES = ['Fermentable', 'Yeast', 'Hops', 'Water Profile', 'Additive'] as const;
export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

export const UNIT_TYPES = ['g', 'kg', 'L', 'ml', 'oz', 'lb', 'gal', 'ppm', 'unit'] as const;
export type UnitType = typeof UNIT_TYPES[number];

export const ADDITIVE_TYPES = ['Nutrient', 'Spice', 'Fruit', 'Clarifier', 'Stabilizer', 'Acid'] as const;
export type AdditiveType = typeof ADDITIVE_TYPES[number];

export interface BaseIngredient {
  id: string;
  name: string;
  category: IngredientCategory;
  notes?: string;
  origin?: string;
  updatedAt: string;
  createdBy?: string;
}

export interface FermentableIngredient extends BaseIngredient {
  category: 'Fermentable';
  type: 'Grain' | 'Extract' | 'Sugar' | 'Honey' | 'Fruit';
  yieldPpg: number;
  colorEbc: number;
  moistureContentPct?: number;
  diastaticPowerLintner?: number;
  isMashed: boolean;
}

export interface YeastIngredient extends BaseIngredient {
  category: 'Yeast';
  form: 'Liquid' | 'Dry';
  tempMinC: number;
  tempMaxC: number;
  alcoholTolerancePct: number;
  attenuationPct: number;
  nitrogenDemand: 'Low' | 'Medium' | 'High' | 'Very High';
}

export interface HopsIngredient extends BaseIngredient {
  category: 'Hops';
  alphaAcidPct: number;
  form: 'Pellet' | 'Whole' | 'Extract';
}

export interface WaterProfileIngredient extends BaseIngredient {
  category: 'Water Profile';
  calciumPpm: number;
  magnesiumPpm: number;
  sodiumPpm: number;
  sulfatePpm: number;
  chloridePpm: number;
  bicarbonatePpm: number;
}

export interface AdditiveIngredient extends BaseIngredient {
  category: 'Additive';
  additiveType: AdditiveType;
  yanValuePerGramPerLiter?: number;
  dosagePer10Liters?: number;
  dosagePerGramYeast?: number;
}

export type IngredientUnion =
  | FermentableIngredient
  | YeastIngredient
  | HopsIngredient
  | WaterProfileIngredient
  | AdditiveIngredient;

export interface WorkspaceInventoryItem {
  id: string;
  breweryId: string;
  ingredientId: string;
  quantityOnHand: number;
  unit: UnitType;
  batchLotNumber?: string;
  expirationDate?: string;
}

export interface PopulatedInventoryItem extends WorkspaceInventoryItem {
  ingredient: IngredientUnion;
}