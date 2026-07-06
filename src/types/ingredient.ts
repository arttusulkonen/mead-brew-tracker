// src/types/ingredient.ts
export type UUID = string;

export const INGREDIENT_CATEGORIES = ['Fermentable', 'Honey', 'Yeast', 'Hops', 'Water Profile', 'Additive'] as const;
export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

export const UNIT_TYPES = ['g', 'kg', 'L', 'ml', 'oz', 'lb', 'gal', 'ppm', 'unit'] as const;
export type UnitType = typeof UNIT_TYPES[number];

export const ADDITIVE_TYPES = ['Nutrient', 'Spice', 'Fruit', 'Clarifier', 'Stabilizer', 'Acid'] as const;
export type AdditiveType = typeof ADDITIVE_TYPES[number];

export interface BaseIngredient {
  id: UUID;
  name: string;
  category: IngredientCategory;
  notes?: string;
  description?: string;
  origin?: string;
  producer?: string;
  updatedAt: string;
  createdBy?: UUID;
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

export interface HoneyIngredient extends BaseIngredient {
  category: 'Honey';
  sugarContentBrix: number;
  moistureContentPct: number;
}

export interface YeastIngredient extends BaseIngredient {
  category: 'Yeast';
  form: 'Liquid' | 'Dry';
  tempMinC: number;
  tempMaxC: number;
  attenuationPctMin?: number; 
  alcoholTolerancePct: number;
  alcoholTolerancePctMin?: number; 
  attenuationPct: number;
  nitrogenDemand: 'Low' | 'Medium' | 'High' | 'Very High';
}

export interface HopsIngredient extends BaseIngredient {
  category: 'Hops';
  alphaAcidPct: number;
  alphaAcidPctMin?: number;
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
  nutrientRole?: 'Rehydration' | 'Fermentation' | 'Other';
  additionStage?: string;
  yanValuePerGramPerLiter?: number;
  dosagePer10Liters?: number;
  dosagePerGramYeast?: number;
}

export type IngredientUnion =
  | FermentableIngredient
  | HoneyIngredient
  | YeastIngredient
  | HopsIngredient
  | WaterProfileIngredient
  | AdditiveIngredient;

export interface WorkspaceInventoryItem {
  id: UUID;
  breweryId: UUID;
  ingredientId: UUID;
  quantityOnHand: number;
  unit: UnitType;
  batchLotNumber?: string;
  expirationDate?: string;
}

export interface PopulatedInventoryItem extends WorkspaceInventoryItem {
  ingredient: IngredientUnion;
}