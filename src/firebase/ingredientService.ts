import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import type { IngredientCategory, IngredientUnion, PopulatedInventoryItem, WorkspaceInventoryItem } from '../types/ingredient';
import { db } from './config';

export const getGlobalIngredients = async (category?: IngredientCategory | null): Promise<IngredientUnion[]> => {
  if (!db) return [];
  
  try {
    let q = collection(db, 'ingredients');
    
    if (category) {
      q = query(q, where('category', '==', category));
    }
    
    const querySnapshot = await getDocs(q);
    const ingredients: IngredientUnion[] = [];
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        ingredients.push({ ...data, id: docSnap.id } as IngredientUnion);
      }
    });
    
    return ingredients;
  } catch (error) {
    return [];
  }
};

export const getWorkspaceInventory = async (breweryId: string | null | undefined): Promise<PopulatedInventoryItem[]> => {
  if (!db || !breweryId) return [];
  
  try {
    const inventoryRef = collection(db, 'breweries', breweryId, 'inventory');
    const inventorySnapshot = await getDocs(inventoryRef);
    
    const populatedItems: PopulatedInventoryItem[] = [];
    
    for (const docSnap of inventorySnapshot.docs) {
      const invData = docSnap.data() as WorkspaceInventoryItem;
      
      if (!invData || !invData.ingredientId) continue;

      const ingredientRef = doc(db, 'ingredients', invData.ingredientId);
      const ingredientSnap = await getDoc(ingredientRef);
      
      if (ingredientSnap.exists()) {
        const ingredientData = ingredientSnap.data() as IngredientUnion;
        populatedItems.push({
          ...invData,
          id: docSnap.id,
          ingredient: { ...ingredientData, id: ingredientSnap.id }
        });
      }
    }
    
    return populatedItems;
  } catch (error) {
    return [];
  }
};

export const addWorkspaceInventoryItem = async (
  breweryId: string | null | undefined,
  itemData: Omit<WorkspaceInventoryItem, 'id' | 'breweryId'> | null | undefined
): Promise<WorkspaceInventoryItem | null> => {
  if (!db || !breweryId || !itemData) return null;
  
  try {
    const inventoryRef = doc(collection(db, 'breweries', breweryId, 'inventory'));
    
    const newItem: WorkspaceInventoryItem = {
      ...itemData,
      id: inventoryRef.id,
      breweryId
    };
    
    await setDoc(inventoryRef, newItem);
    return newItem;
  } catch (error) {
    return null;
  }
};

export const updateWorkspaceInventoryItem = async (
  breweryId: string | null | undefined,
  itemId: string | null | undefined,
  updates: Partial<WorkspaceInventoryItem> | null | undefined
): Promise<boolean> => {
  if (!db || !breweryId || !itemId || !updates) return false;
  
  try {
    const itemRef = doc(db, 'breweries', breweryId, 'inventory', itemId);
    await updateDoc(itemRef, updates);
    return true;
  } catch (error) {
    return false;
  }
};

export const deleteWorkspaceInventoryItem = async (
  breweryId: string | null | undefined,
  itemId: string | null | undefined
): Promise<boolean> => {
  if (!db || !breweryId || !itemId) return false;
  
  try {
    const itemRef = doc(db, 'breweries', breweryId, 'inventory', itemId);
    await deleteDoc(itemRef);
    return true;
  } catch (error) {
    return false;
  }
};