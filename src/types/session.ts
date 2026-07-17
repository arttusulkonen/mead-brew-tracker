// src/types/session.ts
import type { UUID } from './ingredient';
import type { BeverageType, RecipeIngredientReference, RecipeStep } from './recipe';

export type BrewSessionStage = 'Brew Day' | 'Fermentation' | 'Conditioning' | 'Bottled' | 'Completed';

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
  id: string;
  targetHours: number | null;
  isOneThirdBreak: boolean;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface TosnaSchedule {
  totalYeastGrams: number;
  goFermGrams: number;
  totalFermaidOGrams: number;
  dosePerAdditionGrams: number;
  targetOneThirdBreak?: number;
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

  aiScore?: number | null;
  aiAnalysisReport?: string | null;
}