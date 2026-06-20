import type { MeadStyleTarget, RecipeIngredientReference, RecipeStep } from './recipe';

export type BrewSessionStage = 'planned' | 'fermenting' | 'aging' | 'completed';

export interface BrewLog {
  id: string;
  timestamp: string;
  dayNumber: number;
  sg: number | null;
  ph: number | null;
  tempC: number | null;
  notes: string;
  actionTaken: string;
  stepId?: string | null;
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
  id: string;
  recipeId: string | null;
  breweryId: string;
  recipeName: string;
  status: BrewSessionStage;
  targetStyle?: MeadStyleTarget;
  batchSizeLiters: number;
  targetOg: number;
  targetFg: number;
  
  pitchTimestamp?: string | null;
  tosnaSchedule?: TosnaSchedule | null;
  
  sessionIngredients: RecipeIngredientReference[];
  sessionSteps: RecipeStep[];
  
  logs: BrewLog[];
  startDate: string;
  completedDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}