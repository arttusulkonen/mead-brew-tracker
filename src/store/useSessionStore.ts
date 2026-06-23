import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { create } from 'zustand';
import { db } from '../firebase/config';
import type { BrewLog, BrewSession } from '../types/session';

interface SessionState {
  sessions: BrewSession[];
  currentSession: BrewSession | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: (breweryId: string | null | undefined) => Promise<void>;
  fetchSessionById: (breweryId: string | null | undefined, sessionId: string | null | undefined) => Promise<void>;
  clearCurrentSession: () => void;
  startSession: (payload: Record<string, any>) => Promise<string | null>;
  updateSteps: (breweryId: string | null | undefined, sessionId: string | null | undefined, newSteps: any[]) => Promise<void>;
  updateSessionStatus: (breweryId: string | null | undefined, sessionId: string | null | undefined, newStatus: 'planned' | 'fermenting' | 'aging' | 'completed', actualOg?: number) => Promise<void>;
  addLogToSession: (breweryId: string | null | undefined, sessionId: string | null | undefined, newLog: BrewLog) => Promise<void>;
  updateTosnaSchedule: (breweryId: string | null | undefined, sessionId: string | null | undefined, updatedAdditions: any[]) => Promise<void>;
  splitBrewSession: (payload: Record<string, any>) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: false,
  error: null,

  fetchSessions: async (breweryId) => {
    if (!db || !breweryId) return;
    
    set({ isLoading: true, error: null });
    try {
      const sessionsRef = collection(db, `breweries/${breweryId}/brew_sessions`);
      const snapshot = await getDocs(sessionsRef);
      const fetchedSessions = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as BrewSession));
      set({ sessions: fetchedSessions });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSessionById: async (breweryId, sessionId) => {
    if (!db || !breweryId || !sessionId) return;
    
    set({ isLoading: true, error: null });
    try {
      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        set({ currentSession: { ...sessionSnap.data(), id: sessionSnap.id } as BrewSession });
      } else {
        set({ currentSession: null, error: 'Session not found' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearCurrentSession: () => {
    set({ currentSession: null, error: null });
  },

  startSession: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const functions = getFunctions();
      const startBrewSessionFn = httpsCallable<{ payload: Record<string, any> }, { status: string, sessionId: string }>(functions, 'startBrewSession');
      
      const response = await startBrewSessionFn(payload);
      
      if (response.data && response.data.sessionId) {
        set({ isLoading: false });
        return response.data.sessionId;
      }
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start session', isLoading: false });
      throw err;
    }
  },

  updateSteps: async (breweryId, sessionId, newSteps) => {
    if (!db || !breweryId || !sessionId) return;
    
    const { currentSession } = get();
    if (currentSession) {
      set({ currentSession: { ...currentSession, sessionSteps: newSteps } });
    }

    try {
      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      await updateDoc(sessionRef, { 
        sessionSteps: newSteps, 
        updatedAt: new Date().toISOString() 
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update steps' });
    }
  },

  updateSessionStatus: async (breweryId, sessionId, newStatus, actualOg) => {
    if (!db || !breweryId || !sessionId) return;
    
    const { currentSession } = get();
    const updateData: Record<string, any> = {
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (actualOg !== undefined) {
      updateData.actualOg = actualOg;
    }

    if (currentSession) {
      set({ currentSession: { ...currentSession, ...updateData } });
    }

    try {
      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      await updateDoc(sessionRef, updateData);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update status' });
    }
  },

  addLogToSession: async (breweryId, sessionId, newLog) => {
    if (!db || !breweryId || !sessionId) return;

    const { currentSession } = get();
    let updatedLogs = [newLog];
    
    if (currentSession?.logs && Array.isArray(currentSession.logs)) {
      updatedLogs = [...currentSession.logs, newLog];
    }

    if (currentSession) {
      set({ currentSession: { ...currentSession, logs: updatedLogs } });
    }

    try {
      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      await updateDoc(sessionRef, { 
        logs: updatedLogs,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add log' });
    }
  },

  updateTosnaSchedule: async (breweryId, sessionId, updatedAdditions) => {
    if (!db || !breweryId || !sessionId) return;

    const { currentSession } = get();
    if (currentSession?.tosnaSchedule) {
      set({ 
        currentSession: { 
          ...currentSession, 
          tosnaSchedule: { ...currentSession.tosnaSchedule, additions: updatedAdditions } 
        } 
      });
    }

    try {
      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      await updateDoc(sessionRef, { 
        'tosnaSchedule.additions': updatedAdditions,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update TOSNA' });
    }
  },

  splitBrewSession: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const functions = getFunctions();
      const splitBatchFn = httpsCallable<{ payload: Record<string, any> }, { status: string }>(functions, 'splitBatch');
      
      await splitBatchFn(payload);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to split session' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  }
}));