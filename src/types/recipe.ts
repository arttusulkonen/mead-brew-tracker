// src/types/recipe.ts
import type { AdditiveType, IngredientCategory } from './ingredient';

export type BeverageType = 'Beer' | 'Mead' | 'Cider' | 'Other';
export type MeadStyleTarget = 'Session (4-6%)' | 'Standard (7-10%)' | 'Wine/Sack (11%+)' | 'Custom';

// Раньше это была чистая ссылка на каталог (id/globalIngredientId/name/category/
// quantity/note). Но конструктор рецептов теперь даёт редактировать характеристики
// ингредиента "на месте" (Альфа-кислотность, Yield/Color, толерантность дрожжей,
// тип и этап внесения добавки и т.д.) и даже добавлять полностью кастомные
// ингредиенты, никогда не существовавшие в каталоге. Поэтому:
// 1) globalIngredientId стал nullable — у кастомного ингредиента его просто нет;
// 2) добавлены опциональные snapshot-поля — они сохраняются ПРЯМО в рецепте на
//    момент добавления, поэтому последующие правки глобального каталога или
//    отсутствие сети при просмотре рецепта не меняют то, что реально замешано
//    в конкретном рецепте.
// Все поля опциональны и зависят от category конкретной строки.
export interface RecipeIngredientReference {
  id: string;
  globalIngredientId: string | null;
  name: string;
  category: IngredientCategory;
  quantity: number;
  note: string;

  // --- Универсальные поля каталога ---
  form?: string;
  origin?: string;
  producer?: string;
  description?: string;

  // --- Fermentable ---
  yieldPpg?: number;
  colorEbc?: number;
  moistureContentPct?: number;
  diastaticPowerLintner?: number;

  // --- Honey ---
  sugarContentBrix?: number;

  // --- Hops ---
  alphaAcidPct?: number;
  boilTimeMinutes?: number;

  // --- Yeast ---
  alcoholTolerancePct?: number;
  attenuationPct?: number;
  tempMinC?: number;
  tempMaxC?: number;
  nitrogenDemand?: 'Low' | 'Medium' | 'High' | 'Very High';

  // --- Additive ---
  additiveType?: AdditiveType;
  additionStage?: string; // Boil/Whirlpool, Secondary, Aging, Bottling... (решение конкретного рецепта, не свойство самого вещества)
  yanValuePerGramPerLiter?: number;
  dosagePerGramYeast?: number;
  dosagePer10Liters?: number;

  // --- Water Profile (ppm) ---
  calciumPpm?: number;
  magnesiumPpm?: number;
  sodiumPpm?: number;
  sulfatePpm?: number;
  chloridePpm?: number;
  bicarbonatePpm?: number;
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