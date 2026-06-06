import type { DocumentData, Query } from 'firebase/firestore';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import type { IngredientCategory, IngredientUnion, PopulatedInventoryItem, WorkspaceInventoryItem } from '../types/ingredient';
import { db } from './config';

export const getGlobalIngredients = async (category?: IngredientCategory | null): Promise<IngredientUnion[]> => {
  if (!db) return [];
  
  try {
    const collRef = collection(db, 'ingredients');
    const q: Query<DocumentData, DocumentData> = category ? query(collRef, where('category', '==', category)) : collRef;
    
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
    console.error(error);
    return [];
  }
};

export const getWorkspaceInventory = async (breweryId: string | null | undefined): Promise<PopulatedInventoryItem[]> => {
  if (!db || !breweryId) return [];
  
  try {
    const inventoryRef = collection(db, 'breweries', breweryId, 'inventory');
    const inventorySnapshot = await getDocs(inventoryRef);
    
    const populatedItems: PopulatedInventoryItem[] = [];
    
    const fetchPromises = inventorySnapshot.docs.map(async (docSnap) => {
      const invData = docSnap.data() as WorkspaceInventoryItem;
      if (!invData || !invData.ingredientId) return null;

      const ingredientRef = doc(db, 'ingredients', invData.ingredientId);
      const ingredientSnap = await getDoc(ingredientRef);
      
      if (ingredientSnap.exists()) {
        const ingredientData = ingredientSnap.data() as IngredientUnion;
        return {
          ...invData,
          id: docSnap.id,
          ingredient: { ...ingredientData, id: ingredientSnap.id }
        } as PopulatedInventoryItem;
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    results.forEach(res => {
      if (res) populatedItems.push(res);
    });
    
    return populatedItems;
  } catch (error) {
    console.error(error);
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
    console.error(error);
    return null;
  }
};

export const updateWorkspaceInventoryItem = async (
  breweryId: string | null | undefined,
  itemId: string | null | undefined,
  updates: Omit<Partial<WorkspaceInventoryItem>, 'id' | 'breweryId'> | null | undefined
): Promise<boolean> => {
  if (!db || !breweryId || !itemId || !updates) return false;
  
  try {
    const itemRef = doc(db, 'breweries', breweryId, 'inventory', itemId);
    await updateDoc(itemRef, updates);
    return true;
  } catch (error) {
    console.error(error);
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
    console.error(error);
    return false;
  }
};

export const addGlobalIngredient = async (ingredientData: Omit<IngredientUnion, 'id' | 'updatedAt'>): Promise<IngredientUnion | null> => {
  if (!db || !ingredientData) return null;
  try {
    const newRef = doc(collection(db, 'ingredients'));
    const newIngredient = {
      ...ingredientData,
      id: newRef.id,
      updatedAt: new Date().toISOString()
    } as IngredientUnion;
    await setDoc(newRef, newIngredient);
    return newIngredient;
  } catch (error) {
    console.error(error);
    return null;
  }
};