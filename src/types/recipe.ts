import type { IngredientCategory } from './ingredient';

export interface RecipeIngredientReference {
  globalIngredientId: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  note: string;
}

export type StepPhase = 'Preparation' | 'Fermentation' | 'Aging';
export type TimeUnit = 'minutes' | 'days';

export interface RecipeStep {
  id: string;
  stepNumber: number;
  phase: StepPhase;
  title: string;
  description: string;
  durationValue: number;
  durationUnit: TimeUnit;
  targetTempC: number | null;
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
  steps: RecipeStep[];
  targetCurves?: IdealTargetCurves;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}