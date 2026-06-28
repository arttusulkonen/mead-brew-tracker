import type { IngredientCategory } from './ingredient';

export type BeverageType = 'Beer' | 'Mead' | 'Cider' | 'Other';
export type MeadStyleTarget = 'Session (4-6%)' | 'Standard (7-10%)' | 'Wine/Sack (11%+)' | 'Custom';

export interface RecipeIngredientReference {
  id: string;
  globalIngredientId: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  note: string;
}

export type StepPhase = 'Preparation' | 'Mashing' | 'Boiling' | 'Fermentation' | 'Aging' | 'Packaging';
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
  
  isActive?: boolean;
  isCompleted?: boolean;
  startedAt?: string | null;
  accumulatedSeconds?: number;
  actualDurationSeconds?: number;
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
  beverageType: BeverageType;
  targetStyle: string;
  expectedBatchSizeLiters: number;
  targetOriginalGravity: number;
  targetFinalGravity: number;
  targetAbv: number;
  targetIbu?: number;
  targetColorEbc?: number;
  ingredients: RecipeIngredientReference[];
  steps: RecipeStep[];
  targetCurves?: IdealTargetCurves;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}