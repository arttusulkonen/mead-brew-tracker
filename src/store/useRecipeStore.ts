import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from '../firebase/config';
import type { Recipe } from '../types/recipe';

export interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  isLoading: boolean;
  error: string | null;
  fetchRecipes: (breweryId: string | null | undefined) => Promise<void>;
  fetchRecipeById: (recipeId: string | undefined) => Promise<void>;
  clearCurrentRecipe: () => void;
}

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  currentRecipe: null,
  isLoading: false,
  error: null,

  fetchRecipes: async (breweryId) => {
    if (!breweryId || !db) {
      set({ recipes: [], isLoading: false, error: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const q = query(collection(db, 'recipes'), where('breweryId', '==', breweryId));
      const snapshot = await getDocs(q);
      const fetchedRecipes = snapshot.docs.map(doc => doc.data() as Recipe);
      
      fetchedRecipes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      set({ recipes: fetchedRecipes, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchRecipeById: async (recipeId) => {
    if (!recipeId || !db) {
      set({ currentRecipe: null, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, 'recipes', recipeId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        set({ currentRecipe: docSnap.data() as Recipe, isLoading: false });
      } else {
        set({ currentRecipe: null, error: 'Recipe not found', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearCurrentRecipe: () => set({ currentRecipe: null, error: null })
}));