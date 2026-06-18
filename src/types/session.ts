export type SessionStatus = 'planned' | 'fermenting' | 'aging' | 'completed';

export interface BrewLog {
  id: string;
  timestamp: string;
  dayNumber: number;
  sg: number | null;
  ph: number | null;
  tempC: number | null;
  notes: string;
  actionTaken: string;
}

export interface BrewSession {
  id: string;
  breweryId: string;
  recipeId: string;
  recipeName: string;
  status: SessionStatus;
  startDate: string;
  completedDate: string | null;
  batchSizeLiters: number;
  targetOg: number;
  targetFg: number;
  logs: BrewLog[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}