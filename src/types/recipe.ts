import type {
  AdditiveType,
  IngredientCategory,
  UnitType,
  UUID,
} from './ingredient';

export type BeverageType = 'Beer' | 'Mead' | 'Cider' | 'Other';
export type MeadStyleTarget =
  | 'Session (4-6%)'
  | 'Standard (7-10%)'
  | 'Wine/Sack (11%+)'
  | 'Custom';

export interface RecipeIngredientReference {
  id: UUID;
  globalIngredientId: UUID | null;
  inventoryItemId?: UUID;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: UnitType;
  note: string;

  form?: string;
  origin?: string;
  producer?: string;
  description?: string;

  yieldPpg?: number;
  colorEbc?: number;
  moistureContentPct?: number;
  diastaticPowerLintner?: number;

  sugarContentBrix?: number;

  alphaAcidPct?: number;
  boilTimeMinutes?: number;

  alcoholTolerancePct?: number;
  attenuationPct?: number;
  tempMinC?: number;
  tempMaxC?: number;
  nitrogenDemand?: 'Low' | 'Medium' | 'High' | 'Very High';

  additiveType?: AdditiveType;
  nutrientRole?: string;
  additionStage?: string;
  yanValuePerGramPerLiter?: number;
  dosagePerGramYeast?: number;
  dosagePer10Liters?: number;

  calciumPpm?: number;
  magnesiumPpm?: number;
  sodiumPpm?: number;
  sulfatePpm?: number;
  chloridePpm?: number;
  bicarbonatePpm?: number;
}

export type StepPhase =
  | 'Preparation'
  | 'Mashing'
  | 'Boiling'
  | 'Fermentation'
  | 'Conditioning'
  | 'Packaging';
export type TimeUnit = 'minutes' | 'days';

export interface RecipeStep {
  id: UUID;
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

export interface RecipeFork {
  id: UUID;
  name: string;
  target_style: string;
  target_abv: number;
  target_original_gravity: number;
}

export interface WizardData {
  wizardStyle: string;
  wizardSweetness: string;
  wizardHoney: string;
  isSafeBacksweetening: boolean;
  isColdCrashEnabled: boolean;
}

export interface Recipe {
  id: UUID;
  breweryId: UUID;
  parentRecipeId?: UUID | null;
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
  wizardData?: WizardData;
  createdAt: string;
  updatedAt: string;
  createdBy: UUID;
  forks?: RecipeFork[]; 
}