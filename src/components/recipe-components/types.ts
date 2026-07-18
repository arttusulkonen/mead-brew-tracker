// src/components/recipe-components/types.ts
import type { RecipeIngredientReference, RecipeStep } from '../../types/recipe';

export interface AiIngredientProposal {
  ingredientId: string;
  suggestedQuantityGrams: number;
  aiNote?: string;
}

export interface RecipeStepEntry extends RecipeStep {
  isExpanded?: boolean;
}

export interface RecipeIngredientEntry extends RecipeIngredientReference {
  showNote?: boolean;
  alphaAcidPctMin?: number;
  alcoholTolerancePctMin?: number;
  attenuationPctMin?: number;
}