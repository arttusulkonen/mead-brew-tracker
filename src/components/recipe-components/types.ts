/*
 * File: src/components/recipe-components/types.ts
 * Description: Type definitions for the recipe builder UI components, including AI proposals and UI state extensions.
 */

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