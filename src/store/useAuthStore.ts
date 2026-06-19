import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { create } from 'zustand';
import { auth, db } from '../firebase/config';
import i18n from '../i18n';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setLanguage: (lang: string) => Promise<void>;
  language?: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setLanguage: async (lang: string) => {
    const user = auth.currentUser;
    if (user && db) {
      await setDoc(doc(db, 'users', user.uid), { language: lang }, { merge: true });
    }
    i18n.changeLanguage(lang);
    set({ language: lang }); 
  },
}));

export const initUserLanguage = async (userId: string) => {
  if (!db) return;
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (userDoc.exists() && userDoc.data().language) {
    i18n.changeLanguage(userDoc.data().language);
  }
};