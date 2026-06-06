import { create } from 'zustand';
import {
  addGlobalIngredient,
  addWorkspaceInventoryItem,
  deleteWorkspaceInventoryItem,
  getGlobalIngredients,
  getWorkspaceInventory,
  updateWorkspaceInventoryItem,
} from '../firebase/ingredientService';
import type { IngredientCategory, IngredientUnion, PopulatedInventoryItem, WorkspaceInventoryItem } from '../types/ingredient';

export interface InventoryState {
  globalIngredients: IngredientUnion[];
  inventory: PopulatedInventoryItem[];
  isLoading: boolean;
  error: string | null;

  fetchGlobalIngredients: (category?: IngredientCategory | null) => Promise<void>;
  fetchInventory: (breweryId: string | null | undefined) => Promise<void>;
  addInventoryItem: (breweryId: string | null | undefined, itemData: Omit<WorkspaceInventoryItem, 'id' | 'breweryId'>) => Promise<boolean>;
  addCustomIngredient: (ingredientData: Omit<IngredientUnion, 'id' | 'updatedAt'>) => Promise<IngredientUnion | null>;
  updateItem: (breweryId: string | null | undefined, itemId: string, updates: Omit<Partial<WorkspaceInventoryItem>, 'id' | 'breweryId'>) => Promise<boolean>;
  removeItem: (breweryId: string | null | undefined, itemId: string) => Promise<boolean>;
  clearInventory: () => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  globalIngredients: [],
  inventory: [],
  isLoading: false,
  error: null,

  fetchGlobalIngredients: async (category) => {
    set({ isLoading: true, error: null });
    try {
      const ingredients = await getGlobalIngredients(category);
      set({ globalIngredients: ingredients });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch global ingredients' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchInventory: async (breweryId) => {
    if (!breweryId) {
      set({ inventory: [] });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const items = await getWorkspaceInventory(breweryId);
      set({ inventory: items });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch inventory' });
    } finally {
      set({ isLoading: false });
    }
  },

  addInventoryItem: async (breweryId, itemData) => {
    if (!breweryId || !itemData) return false;
    set({ isLoading: true, error: null });
    try {
      const newItem = await addWorkspaceInventoryItem(breweryId, itemData);
      if (newItem) {
        const globalIng = get().globalIngredients.find(g => g.id === newItem.ingredientId);
        if (globalIng) {
          const populated: PopulatedInventoryItem = { ...newItem, ingredient: globalIng };
          set(state => ({ inventory: [...state.inventory, populated] }));
        } else {
          const items = await getWorkspaceInventory(breweryId);
          set({ inventory: items });
        }
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err.message || 'Failed to add inventory item' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  addCustomIngredient: async (ingredientData) => {
    set({ isLoading: true, error: null });
    try {
      const newIngredient = await addGlobalIngredient(ingredientData);
      if (newIngredient) {
        set(state => ({ globalIngredients: [...state.globalIngredients, newIngredient] }));
        return newIngredient;
      }
      return null;
    } catch (err: any) {
      set({ error: err.message || 'Failed to add custom ingredient' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updateItem: async (breweryId, itemId, updates) => {
    if (!breweryId || !itemId) return false;
    set({ isLoading: true, error: null });
    try {
      const success = await updateWorkspaceInventoryItem(breweryId, itemId, updates);
      if (success) {
        set(state => ({
          inventory: state.inventory.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          )
        }));
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err.message || 'Failed to update inventory item' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  removeItem: async (breweryId, itemId) => {
    if (!breweryId || !itemId) return false;
    set({ isLoading: true, error: null });
    try {
      const success = await deleteWorkspaceInventoryItem(breweryId, itemId);
      if (success) {
        set(state => ({
          inventory: state.inventory.filter(item => item.id !== itemId)
        }));
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err.message || 'Failed to remove inventory item' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  clearInventory: () => set({ inventory: [], error: null })
}));