import { collection, doc, getDocs, increment, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from '../firebase/config';
import {
  addGlobalIngredient,
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
  consumeIngredients: (breweryId: string | null | undefined, ingredientsToConsume: { globalIngredientId: string, quantity: number }[]) => Promise<boolean>;
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
      set({ error: err?.message || 'Failed to fetch global ingredients' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchInventory: async (breweryId) => {
    if (!breweryId) {
      set({ inventory: [], error: null, isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const items = await getWorkspaceInventory(breweryId);
      set({ inventory: items });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to fetch inventory' });
    } finally {
      set({ isLoading: false });
    }
  },

  addInventoryItem: async (breweryId, itemData) => {
    if (!breweryId || !itemData || !db) return false;
    
    const qty = Number(itemData.quantityOnHand);
    if (!Number.isFinite(qty) || qty < 0) {
      set({ error: 'Invalid quantity provided', isLoading: false });
      return false;
    }
    
    set({ isLoading: true, error: null });
    try {
      const inventoryRef = collection(db, `breweries/${breweryId}/inventory`);
      const q = query(inventoryRef, where('ingredientId', '==', itemData.ingredientId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0]; 
        await updateDoc(existingDoc.ref, { 
          quantityOnHand: increment(qty),
          unit: itemData.unit
        });
      } else {
        const deterministicDocId = itemData.ingredientId; 
        const itemDocRef = doc(inventoryRef, deterministicDocId);
        await setDoc(itemDocRef, {
          id: deterministicDocId,
          breweryId,
          ingredientId: itemData.ingredientId,
          unit: itemData.unit,
          quantityOnHand: increment(qty)
        }, { merge: true });
      }

      await get().fetchInventory(breweryId);
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to add item', isLoading: false });
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
      set({ error: err?.message || 'Failed to add custom ingredient' });
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
      set({ error: err?.message || 'Failed to update inventory item' });
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
      set({ error: err?.message || 'Failed to remove inventory item' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  consumeIngredients: async (breweryId, ingredientsToConsume) => {
    if (!breweryId || !ingredientsToConsume.length || !db) return false;
    set({ isLoading: true, error: null });
    try {
      const batch = writeBatch(db);
      const currentInventory = get().inventory;
      
      for (const ing of ingredientsToConsume) {
        if (ing.quantity > 0) {
          const invItem = currentInventory.find(i => i.ingredientId === ing.globalIngredientId);
          if (invItem) {
            let decrementQty = ing.quantity;
            switch (invItem.unit) {
              case 'kg':
              case 'L':
                decrementQty = ing.quantity / 1000;
                break;
              case 'oz':
                decrementQty = ing.quantity / 28.3495;
                break;
              case 'lb':
                decrementQty = ing.quantity / 453.592;
                break;
              case 'gal':
                decrementQty = ing.quantity / 3785.41;
                break;
              default:
                decrementQty = ing.quantity;
            }
            const itemRef = doc(db, `breweries/${breweryId}/inventory`, invItem.id);
            batch.update(itemRef, { quantityOnHand: increment(-decrementQty) });
          }
        }
      }
      
      await batch.commit();
      await get().fetchInventory(breweryId);
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to consume ingredients', isLoading: false });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  clearInventory: () => set({ inventory: [], error: null })
}));