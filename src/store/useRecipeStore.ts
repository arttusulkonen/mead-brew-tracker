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
}

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
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('brewery_id', breweryId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Маппинг snake_case (БД) в camelCase (Frontend)
      const formattedRecipes = data.map(item => ({
        id: item.id,
        breweryId: item.brewery_id,
        name: item.name,
        beverageType: item.beverage_type,
        targetStyle: item.target_style,
        expectedBatchSizeLiters: item.expected_batch_size_liters,
        targetOriginalGravity: item.target_original_gravity,
        targetFinalGravity: item.target_final_gravity,
        targetAbv: item.target_abv,
        targetIbu: item.target_ibu,
        targetColorEbc: item.target_color_ebc,
        ingredients: item.ingredients || [],
        steps: item.steps || [],
        targetCurves: item.target_curves,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        createdBy: item.created_by,
      })) as Recipe[];
      
      set({ recipes: formattedRecipes, isLoading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Failed to fetch recipes', isLoading: false });
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
        const formattedRecipe: Recipe = {
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
        };
        set({ currentRecipe: formattedRecipe, isLoading: false });
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
      
      // После успешного сохранения перезапрашиваем список
      await get().fetchRecipes(recipeData.breweryId);
      return data;
    } catch (error: any) {
      set({ error: error?.message || 'Failed to save recipe', isLoading: false });
      throw error;
    }
  }
}));