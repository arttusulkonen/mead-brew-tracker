// src/store/useRecipeStore.ts
import { create } from 'zustand';
import { supabase } from '../supabase/client';
import type { Recipe } from '../types/recipe';

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

const mapRowToRecipe = (data: any): Recipe => ({
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

  /**
   * Fetches all recipes associated with a specific brewery.
   * @param breweryId The ID of the brewery workspace.
   */
  fetchRecipes: async (breweryId) => {
    if (!breweryId) {
      set({ recipes: [], isLoading: false, error: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('brewery_id', breweryId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedRecipes = (data ?? []).map(mapRowToRecipe);
      
      set({ recipes: formattedRecipes, isLoading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Failed to fetch recipes', isLoading: false });
    }
  },

  /**
   * Saves a NEW recipe. For editing an existing recipe, use updateRecipe
   * instead - calling saveRecipe again would insert a duplicate row rather
   * than updating the original (Supabase .insert() always creates a new row).
   * @param recipeData The recipe object excluding auto-generated fields.
   * @returns The saved recipe object.
   */
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
        .select()
        .single();

      if (error) throw error;
      
      await get().fetchRecipes(recipeData.breweryId);
      
      if (!data) return null;
      
      return mapRowToRecipe(data);
      
    } catch (error: any) {
      set({ error: error?.message || 'Failed to save recipe', isLoading: false });
      throw error;
    }
  },

  /**
   * Updates an EXISTING recipe in place (UPDATE, not INSERT). Use this when
   * editingRecipeId is set in Recipes.tsx, otherwise the old saveRecipe()
   * path silently creates a duplicate row for every edit.
   * @param recipeId The id of the recipe row to update.
   * @param recipeData The full recipe object to persist.
   */
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
        .select()
        .single();

      if (error) throw error;

      await get().fetchRecipes(recipeData.breweryId);

      if (!data) return null;

      const formatted = mapRowToRecipe(data);
      set(state => ({
        currentRecipe: state.currentRecipe?.id === recipeId ? formatted : state.currentRecipe
      }));

      return formatted;
    } catch (error: any) {
      set({ error: error?.message || 'Failed to update recipe', isLoading: false });
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
        .select('*')
        .eq('id', recipeId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        set({ currentRecipe: mapRowToRecipe(data), isLoading: false });
      }
    } catch (error: any) {
      set({ error: error?.message || 'Recipe not found', isLoading: false, currentRecipe: null });
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
    } catch (error: any) {
      set({ error: error?.message || 'Failed to delete recipe', isLoading: false });
      throw error;
    }
  },
}));