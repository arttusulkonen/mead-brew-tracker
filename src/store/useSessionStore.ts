import { arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from '../firebase/config';
import type { BrewLog, BrewSession } from '../types/session';

export interface SessionState {
  sessions: BrewSession[];
  currentSession: BrewSession | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: (breweryId: string | null | undefined) => Promise<void>;
  fetchSessionById: (sessionId: string | undefined) => Promise<void>;
  createSession: (session: BrewSession) => Promise<void>;
  addLogToSession: (sessionId: string, log: BrewLog) => Promise<void>;
  updateSessionStatus: (sessionId: string, status: BrewSession['status']) => Promise<void>;
  clearCurrentSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: false,
  error: null,

  fetchSessions: async (breweryId) => {
    if (!breweryId || !db) {
      set({ sessions: [], isLoading: false, error: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const q = query(collection(db, 'sessions'), where('breweryId', '==', breweryId));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          logs: data.logs || []
        } as BrewSession;
      });
      
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      set({ sessions: fetched, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchSessionById: async (sessionId) => {
    if (!sessionId || !db) {
      set({ currentSession: null, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, 'sessions', sessionId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({ 
          currentSession: { ...data, id: docSnap.id, logs: data.logs || [] } as BrewSession, 
          isLoading: false 
        });
      } else {
        set({ currentSession: null, error: 'Session not found', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createSession: async (session) => {
    if (!db) return;
    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, 'sessions', session.id);
      await setDoc(docRef, session);
      set(state => ({
        sessions: [session, ...state.sessions],
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  addLogToSession: async (sessionId, log) => {
    if (!sessionId || !db) return;
    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, 'sessions', sessionId);
      
      await updateDoc(docRef, {
        logs: arrayUnion(log),
        updatedAt: new Date().toISOString()
      });

      const currentSession = get().currentSession;
      
      if (currentSession) {
        const updatedLogs = [...(currentSession.logs || []), log];
        set({
          currentSession: { ...currentSession, logs: updatedLogs }
        });
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateSessionStatus: async (sessionId, status) => {
    if (!sessionId || !db) return;
    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, 'sessions', sessionId);
      const updateData: Partial<BrewSession> = { status, updatedAt: new Date().toISOString() };
      
      if (status === 'completed') {
        updateData.completedDate = new Date().toISOString();
      }

      await updateDoc(docRef, updateData);

      set(state => ({
        currentSession: state.currentSession ? { ...state.currentSession, ...updateData } : null,
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearCurrentSession: () => set({ currentSession: null, error: null })
}));