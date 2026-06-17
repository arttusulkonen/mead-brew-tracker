import type { IngredientCategory } from './ingredient';

export interface RecipeIngredientReference {
  id: string;
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
  phCurvePoints: {
    relativeDay: number;
    targetPh: number;
    phBufferMax: number;
    phBufferMin: number;
  };
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

export type BrewSessionStage =
  | 'Planning'
  | 'Brew Day'
  | 'Primary Fermentation'
  | 'Secondary/Aging'
  | 'Packaging/Bottling'
  | 'Completed';

export interface BrewSession {
  id: string;
  recipeId: string | null;
  breweryId: string;
  parentSessionId: string | null;
  childSessionIds: string[];
  status: BrewSessionStage;
  actualBatchSizeLiters: number;
  actualOriginalGravity: number | null;
  actualFinalGravity: number | null;
  actualAbv: number | null;
  startedAt: string;
  completedAt: string | null;
  splitTimestamp: string | null;
  sessionIngredients: RecipeIngredientReference[];
  sessionSteps: RecipeStep[];
}