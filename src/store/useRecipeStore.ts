// src/store/useRecipeStore.ts
import { create } from 'zustand';
import { supabase } from '../supabase/client';
import type { BeverageType, IdealTargetCurves, Recipe, RecipeIngredientReference, RecipeStep } from '../types/recipe';

export interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  isLoading: boolean;
  error: string | null;
  fetchRecipes: (breweryId: string | null | undefined) => Promise<void>;
  fetchRecipeById: (recipeId: string | undefined) => Promise<void>;
  clearCurrentRecipe: () => void;
  deleteRecipe: (recipeId: string) => Promise<void>;
  saveRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Recipe | null>;
  updateRecipe: (recipeId: string, recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Recipe | null>;
}

interface RecipeRow {
  id: string;
  brewery_id: string;
  name: string;
  beverage_type: BeverageType;
  target_style: string;
  expected_batch_size_liters: number;
  target_original_gravity: number;
  target_final_gravity: number;
  target_abv: number;
  target_ibu?: number;
  target_color_ebc?: number;
  ingredients: RecipeIngredientReference[] | null;
  steps: RecipeStep[] | null;
  target_curves?: IdealTargetCurves;
  created_at: string;
  updated_at: string;
  created_by: string;
}

const mapRowToRecipe = (data: RecipeRow): Recipe => ({
  id: data.id,
  breweryId: data.brewery_id,
  name: data.name,
  beverageType: data.beverage_type,
  targetStyle: data.target_style,
  expectedBatchSizeLiters: data.expected_batch_size_liters,
  targetOriginalGravity: data.target_original_gravity,
  targetFinalGravity: data.target_final_gravity,
  targetAbv: data.target_abv,
  targetIbu: data.target_ibu,
  targetColorEbc: data.target_color_ebc,
  ingredients: data.ingredients || [],
  steps: data.steps || [],
  targetCurves: data.target_curves,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  createdBy: data.created_by,
});

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  currentRecipe: null,
  isLoading: false,
  error: null,

  fetchRecipes: async (breweryId) => {
    if (!breweryId) {
      set({ recipes: [], isLoading: false, error: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      // Подтягиваем рецепты вместе с базовыми данными их сессий (Golden Batch Data)
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          brew_sessions (
            status,
            ai_score,
            actual_original_gravity,
            actual_final_gravity
          )
        `)
        .eq('brewery_id', breweryId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedRecipes = (data || []).map((row: any) => {
        const sessions = row.brew_sessions || [];
        const completedSessions = sessions.filter((s: any) => s.status === 'completed');
        
        // Считаем среднюю оценку ИИ среди завершенных варок
        const scores = completedSessions.map((s: any) => s.ai_score).filter((v: any) => typeof v === 'number');
        const avgAiScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;

        return {
          id: row.id,
          breweryId: row.brewery_id,
          name: row.name,
          beverageType: row.beverage_type,
          targetStyle: row.target_style,
          expectedBatchSizeLiters: row.expected_batch_size_liters,
          targetOriginalGravity: row.target_original_gravity,
          targetFinalGravity: row.target_final_gravity,
          targetAbv: row.target_abv,
          targetIbu: row.target_ibu,
          targetColorEbc: row.target_color_ebc,
          ingredients: typeof row.ingredients === 'string' ? JSON.parse(row.ingredients) : (row.ingredients || []),
          steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps || []),
          targetCurves: row.target_curves,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdBy: row.created_by,
          
          // НОВЫЕ ПОЛЯ АНАЛИТИКИ
          totalBrews: sessions.length,
          completedBrews: completedSessions.length,
          avgAiScore: avgAiScore
        };
      });
      
      set({ recipes: formattedRecipes as Recipe[], isLoading: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch recipes', isLoading: false });
    }
  },

  saveRecipe: async (recipeData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert([{
          brewery_id: recipeData.breweryId,
          name: recipeData.name,
          beverage_type: recipeData.beverageType,
          target_style: recipeData.targetStyle,
          expected_batch_size_liters: recipeData.expectedBatchSizeLiters,
          target_original_gravity: recipeData.targetOriginalGravity,
          target_final_gravity: recipeData.targetFinalGravity,
          target_abv: recipeData.targetAbv,
          target_ibu: recipeData.targetIbu,
          target_color_ebc: recipeData.targetColorEbc,
          ingredients: recipeData.ingredients,
          steps: recipeData.steps,
          target_curves: recipeData.targetCurves,
          created_by: recipeData.createdBy
        }])
        .select();

      if (error) throw error;
      
      await get().fetchRecipes(recipeData.breweryId);
      
      if (!data || data.length === 0) return null;
      
      return mapRowToRecipe(data[0] as RecipeRow);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save recipe';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateRecipe: async (recipeId, recipeData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('recipes')
        .update({
          brewery_id: recipeData.breweryId,
          name: recipeData.name,
          beverage_type: recipeData.beverageType,
          target_style: recipeData.targetStyle,
          expected_batch_size_liters: recipeData.expectedBatchSizeLiters,
          target_original_gravity: recipeData.targetOriginalGravity,
          target_final_gravity: recipeData.targetFinalGravity,
          target_abv: recipeData.targetAbv,
          target_ibu: recipeData.targetIbu,
          target_color_ebc: recipeData.targetColorEbc,
          ingredients: recipeData.ingredients,
          steps: recipeData.steps,
          target_curves: recipeData.targetCurves
        })
        .eq('id', recipeId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Update blocked by database. Please check your RLS policies for the 'recipes' table.");
      }

      await get().fetchRecipes(recipeData.breweryId);

      const formatted = mapRowToRecipe(data[0] as RecipeRow);
      set(state => ({
        currentRecipe: state.currentRecipe?.id === recipeId ? formatted : state.currentRecipe,
        // Мы не заменяем объект в массиве напрямую через mapRowToRecipe, 
        // чтобы не потерять уже подтянутую аналитику. fetchRecipes обновит список корректно.
      }));

      return formatted;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update recipe';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  fetchRecipeById: async (recipeId) => {
    if (!recipeId) {
      set({ currentRecipe: null, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          brew_sessions (
            status,
            ai_score
          )
        `)
        .eq('id', recipeId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const row = data as any;
        const sessions = row.brew_sessions || [];
        const completedSessions = sessions.filter((s: any) => s.status === 'completed');
        
        const scores = completedSessions.map((s: any) => s.ai_score).filter((v: any) => typeof v === 'number');
        const avgAiScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;

        const mapped = mapRowToRecipe(row);
        (mapped as any).totalBrews = sessions.length;
        (mapped as any).completedBrews = completedSessions.length;
        (mapped as any).avgAiScore = avgAiScore;

        set({ currentRecipe: mapped, isLoading: false });
      }
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Recipe not found', isLoading: false, currentRecipe: null });
    }
  },

  clearCurrentRecipe: () => set({ currentRecipe: null, error: null }),

  deleteRecipe: async (recipeId) => {
    if (!recipeId) return;
    
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);
        
      if (error) throw error;
      
      set(state => ({
        recipes: state.recipes.filter(r => r.id !== recipeId),
        currentRecipe: state.currentRecipe?.id === recipeId ? null : state.currentRecipe,
        isLoading: false
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },
}));