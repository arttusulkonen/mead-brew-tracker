import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
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
      const fetched = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id
      })) as BrewSession[];
      
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
        set({ currentSession: { ...docSnap.data(), id: docSnap.id } as BrewSession, isLoading: false });
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
      const currentSession = get().currentSession;
      
      if (!currentSession) throw new Error('No active session');

      const updatedLogs = [...currentSession.logs, log];
      await setDoc(docRef, { logs: updatedLogs, updatedAt: new Date().toISOString() }, { merge: true });

      set(state => ({
        currentSession: state.currentSession ? { ...state.currentSession, logs: updatedLogs } : null,
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
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

      await setDoc(docRef, updateData, { merge: true });

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