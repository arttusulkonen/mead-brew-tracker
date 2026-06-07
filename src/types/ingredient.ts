export type IngredientCategory = 'Honey' | 'Yeast' | 'Hops' | 'Water Profile' | 'Additive';

export type UnitType = 'g' | 'kg' | 'L' | 'ml' | 'oz' | 'lb' | 'gal' | 'ppm' | 'unit';

export interface BaseIngredient {
  id: string;
  name: string;
  category: IngredientCategory;
  notes?: string;
  origin?: string;
  updatedAt: string;
  createdBy?: string;
}

export interface HoneyIngredient extends BaseIngredient {
  category: 'Honey';
  sugarContentBrix: number;
  moistureContentPct: number;
}

export interface YeastIngredient extends BaseIngredient {
  category: 'Yeast';
  tempMinC: number;
  tempMaxC: number;
  alcoholTolerancePct: number;
  nitrogenDemand: 'Low' | 'Medium' | 'High' | 'Very High';
}

export interface HopsIngredient extends BaseIngredient {
  category: 'Hops';
  alphaAcidPct: number;
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
  additiveType: 'Nutrient' | 'Spice' | 'Fruit' | 'Clarifier' | 'Stabilizer' | 'Acid';
  yanValuePerGramPerLiter?: number;
}

export type IngredientUnion =
  | HoneyIngredient
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