import type { DocumentData, Query } from 'firebase/firestore';
import { collection, deleteDoc, doc, documentId, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import type { IngredientCategory, IngredientUnion, PopulatedInventoryItem, WorkspaceInventoryItem } from '../types/ingredient';
import { auth, db } from './config';

export const getGlobalIngredients = async (category?: IngredientCategory | null): Promise<IngredientUnion[]> => {
  if (!db) throw new Error('Firestore is not initialized');
  
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
    console.error('getGlobalIngredients failed:', error);
    throw error;
  }
};

export const getWorkspaceInventory = async (breweryId: string | null | undefined): Promise<PopulatedInventoryItem[]> => {
  if (!db || !breweryId) throw new Error('Missing database or breweryId');
  
  try {
    const inventoryRef = collection(db, 'breweries', breweryId, 'inventory');
    const inventorySnapshot = await getDocs(inventoryRef);
    
    const invItems = inventorySnapshot.docs.map(docSnap => ({
      ...docSnap.data(),
      id: docSnap.id
    } as WorkspaceInventoryItem));

    const ingredientIds = [...new Set(invItems.map(i => i.ingredientId).filter(Boolean))];
    const ingredientsMap = new Map<string, IngredientUnion>();

    for (let i = 0; i < ingredientIds.length; i += 10) {
      const chunk = ingredientIds.slice(i, i + 10);
      const q = query(collection(db, 'ingredients'), where(documentId(), 'in', chunk));
      const snaps = await getDocs(q);
      snaps.forEach(snap => {
        ingredientsMap.set(snap.id, { ...snap.data(), id: snap.id } as IngredientUnion);
      });
    }
    
    const populatedItems: PopulatedInventoryItem[] = [];
    invItems.forEach(inv => {
      const ing = ingredientsMap.get(inv.ingredientId);
      if (ing) {
        populatedItems.push({ ...inv, ingredient: ing });
      }
    });
    
    return populatedItems;
  } catch (error) {
    console.error('getWorkspaceInventory failed:', error);
    throw error;
  }
};

export const addWorkspaceInventoryItem = async (
  breweryId: string | null | undefined,
  itemData: Omit<WorkspaceInventoryItem, 'id' | 'breweryId'> | null | undefined
): Promise<WorkspaceInventoryItem | null> => {
  if (!db || !breweryId || !itemData) throw new Error('Missing parameters');
  
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
    console.error('addWorkspaceInventoryItem failed:', error);
    throw error;
  }
};

export const updateWorkspaceInventoryItem = async (
  breweryId: string | null | undefined,
  itemId: string | null | undefined,
  updates: Omit<Partial<WorkspaceInventoryItem>, 'id' | 'breweryId'> | null | undefined
): Promise<boolean> => {
  if (!db || !breweryId || !itemId || !updates) throw new Error('Missing parameters');
  
  try {
    const itemRef = doc(db, 'breweries', breweryId, 'inventory', itemId);
    await updateDoc(itemRef, updates);
    return true;
  } catch (error) {
    console.error('updateWorkspaceInventoryItem failed:', error);
    throw error;
  }
};

export const deleteWorkspaceInventoryItem = async (
  breweryId: string | null | undefined,
  itemId: string | null | undefined
): Promise<boolean> => {
  if (!db || !breweryId || !itemId) throw new Error('Missing parameters');
  
  try {
    const itemRef = doc(db, 'breweries', breweryId, 'inventory', itemId);
    await deleteDoc(itemRef);
    return true;
  } catch (error) {
    console.error('deleteWorkspaceInventoryItem failed:', error);
    throw error;
  }
};

export const addGlobalIngredient = async (ingredientData: Omit<IngredientUnion, 'id' | 'updatedAt'>): Promise<IngredientUnion | null> => {
  if (!db || !ingredientData) throw new Error('Missing parameters');
  try {
    const newRef = doc(collection(db, 'ingredients'));
    const newIngredient = {
      ...ingredientData,
      id: newRef.id,
      createdBy: auth.currentUser?.uid || 'system',
      updatedAt: new Date().toISOString()
    } as IngredientUnion;
    
    await setDoc(newRef, newIngredient);
    return newIngredient;
  } catch (error) {
    console.error('addGlobalIngredient failed:', error);
    throw error;
  }
};