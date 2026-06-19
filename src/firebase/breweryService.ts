import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import type { Brewery } from '../store/useBreweryStore';
import { db } from './config';

export const createPersonalBrewery = async (userId: string | null | undefined, userEmail: string | null | undefined): Promise<Brewery | null> => {
  if (!userId) return null;
  
  const breweryRef = doc(collection(db, 'breweries'));
  const name = userEmail ? userEmail.split('@')[0] : 'Personal';
  
  const newBrewery: Brewery = {
    id: breweryRef.id,
    name: name,
    ownerId: userId,
    members: [userId],
    invitedEmails: [],
    isPersonal: true
  };

  try {
    await setDoc(breweryRef, newBrewery);
    return newBrewery;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const createSharedBrewery = async (userId: string | null | undefined, name: string | null | undefined, emailsToInvite: string = ''): Promise<Brewery | null> => {
  if (!userId || !name) return null;

  const breweryRef = doc(collection(db, 'breweries'));
  
  const invitedEmails = emailsToInvite
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 5 && e.includes('@'));

  const newBrewery: Brewery = {
    id: breweryRef.id,
    name: name,
    ownerId: userId,
    members: [userId],
    invitedEmails: invitedEmails,
    isPersonal: false
  };

  try {
    await setDoc(breweryRef, newBrewery);
    return newBrewery;
  } catch (error) {
    console.error(error);
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
        breweries.push({ ...data, id: docSnap.id } as Brewery);
      }
    });
    return breweries;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const processPendingInvites = async (userId: string | null | undefined, email: string | null | undefined) => {
  if (!userId || !email) return;
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const q = query(collection(db, 'breweries'), where('invitedEmails', 'array-contains', normalizedEmail));
    const snapshot = await getDocs(q);
    
    const updatePromises = snapshot.docs.map(docSnap => {
      const breweryRef = doc(db, 'breweries', docSnap.id);
      
      return updateDoc(breweryRef, {
        members: arrayUnion(userId),
        invitedEmails: arrayRemove(normalizedEmail)
      });
    });
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error(error);
  }
};

export const inviteToBrewery = async (breweryId: string | null | undefined, email: string | null | undefined) => {
  if (!breweryId || !email) return false;
  try {
    const breweryRef = doc(db, 'breweries', breweryId);
    await updateDoc(breweryRef, {
      invitedEmails: arrayUnion(email.trim().toLowerCase())
    });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const deleteBrewery = async (breweryId: string | null | undefined) => {
  if (!breweryId) return false;
  try {
    const recipesQ = query(collection(db, 'recipes'), where('breweryId', '==', breweryId));
    const sessionsQ = query(collection(db, 'sessions'), where('breweryId', '==', breweryId));
    
    const [recipesSnap, sessionsSnap] = await Promise.all([getDocs(recipesQ), getDocs(sessionsQ)]);
    const deletePromises: Promise<void>[] = [];
    
    recipesSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    sessionsSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
    
    deletePromises.push(deleteDoc(doc(db, 'breweries', breweryId)));
    
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};