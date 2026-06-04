import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import type { Brewery } from '../store/useBreweryStore';
import { db } from './config';

export const createPersonalBrewery = async (userId: string | null | undefined, userEmail: string | null | undefined): Promise<Brewery | null> => {
  if (!userId) return null;
  
  const breweryId = `personal_${userId}`;
  const name = userEmail ? userEmail.split('@')[0] : 'Personal';
  
  const newBrewery: Brewery = {
    id: breweryId,
    name: name,
    ownerId: userId,
    members: [userId],
    isPersonal: true
  };

  try {
    await setDoc(doc(db, 'breweries', breweryId), newBrewery);
    return newBrewery;
  } catch (error) {
    return null;
  }
};

export const getUserBreweries = async (userId: string | null | undefined): Promise<Brewery[]> => {
  if (!userId) return [];
  
  try {
    const q = query(collection(db, 'breweries'), where('members', 'array-contains', userId));
    const querySnapshot = await getDocs(q);
    const breweries: Brewery[] = [];
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        breweries.push(data as Brewery);
      }
    });
    
    return breweries;
  } catch (error) {
    return [];
  }
};

export const createSharedBrewery = async (userId: string | null | undefined, name: string | null | undefined): Promise<Brewery | null> => {
  if (!userId || !name) return null;

  const breweryId = `shared_${Date.now()}_${userId}`;

  const newBrewery: Brewery = {
    id: breweryId,
    name: name,
    ownerId: userId,
    members: [userId],
    isPersonal: false
  };

  try {
    await setDoc(doc(db, 'breweries', breweryId), newBrewery);
    return newBrewery;
  } catch (error) {
    return null;
  }
};