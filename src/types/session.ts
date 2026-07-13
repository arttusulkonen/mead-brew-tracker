// src/types/session.ts
import type { UUID } from './ingredient';
import type { BeverageType, RecipeIngredientReference, RecipeStep } from './recipe';

export type BrewSessionStage = 'planned' | 'mashing' | 'boiling' | 'fermenting' | 'aging' | 'completed' | 'split';

export interface BrewLog {
  id: UUID;
  timestamp: string;
  dayNumber: number;
  sg: number | null;
  ph: number | null;
  tempC: number | null;
  notes: string;
  actionTaken: string;
  stepId?: UUID | null;
}

export interface TosnaAddition {
  id: number;
  type: '24h' | '48h' | '72h' | '1/3 Sugar Break';
  targetDate?: string;
  isCompleted: boolean;
  actualDate?: string;
}

export interface TosnaSchedule {
  targetOneThirdBreak: number;
  isCompressed: boolean;
  additions: TosnaAddition[];
}

export interface BrewSession {
  id: UUID;
  recipeId: UUID | null;
  breweryId: UUID;
  recipeName: string;
  beverageType?: BeverageType;
  status: BrewSessionStage;
  targetStyle?: string;
  batchSizeLiters: number;
  targetOg: number;
  actualOg?: number | null;
  targetFg: number;  
  actualFg?: number | null;
  actualAbv?: number | null;
  pitchTimestamp?: string | null;
  tosnaSchedule?: TosnaSchedule | null;
  
  sessionIngredients: RecipeIngredientReference[];
  sessionSteps: RecipeStep[];
  
  logs: BrewLog[];
  startDate: string;
  completedDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UUID;

  isSplit?: boolean;
  parentSessionId?: UUID | null;
  splitTimestamp?: string | null;
  isAggregated?: boolean;
}