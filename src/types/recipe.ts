import { IngredientCategory, UnitType } from './ingredient';

export interface RecipeIngredientReference {
  ingredientId: string;
  quantity: number;
  unit: UnitType;
  category: IngredientCategory;
}

export interface IdealTargetCurves {
  tempTargetC: number;
  tempBufferMax: number;
  tempBufferMin: number;
}

export interface Recipe {
  id: string;
  breweryId: string;
  name: string;
  expectedBatchSizeLiters: number;
  targetOriginalGravity: number;
  targetFinalGravity: number;
  targetAbv: number;
  ingredients: RecipeIngredientReference[];
  targetCurves?: IdealTargetCurves;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}