//src/store/useSessionStore.ts
import { calculateOneThirdSugarBreak } from '@mead-tracker/math';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { create } from 'zustand';
import { db } from '../firebase/config';
import type { RecipeStep } from '../types/recipe';
import type { BrewLog, BrewSession, BrewSessionStage, TosnaAddition } from '../types/session';

interface SessionState {
  sessions: BrewSession[];
  currentSession: BrewSession | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: (breweryId: string | null | undefined) => Promise<void>;
  fetchSessionById: (breweryId: string | null | undefined, sessionId: string | null | undefined) => Promise<void>;
  clearCurrentSession: () => void;
  startSession: (payload: Record<string, unknown>) => Promise<string | null>;
  updateSteps: (breweryId: string | null | undefined, sessionId: string | null | undefined, newSteps: RecipeStep[]) => Promise<void>;
  addLogToSession: (breweryId: string | null | undefined, sessionId: string | null | undefined, newLog: BrewLog) => Promise<void>;
  updateTosnaSchedule: (breweryId: string | null | undefined, sessionId: string | null | undefined, updatedAdditions: TosnaAddition[]) => Promise<void>;
  splitBrewSession: (payload: Record<string, unknown>) => Promise<void>;
  updateSessionStatus: (breweryId: string | null | undefined, sessionId: string | null | undefined, newStatus: BrewSessionStage, actualOg?: number) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: false,
  error: null,

  fetchSessions: async (breweryId) => {
    if (!db || !breweryId) {
      set({ sessions: [], isLoading: false, error: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const sessionsRef = collection(db, `breweries/${breweryId}/brew_sessions`);
      const snapshot = await getDocs(sessionsRef);
      const fetchedSessions = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as BrewSession));
      
      fetchedSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      set({ sessions: fetchedSessions });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSessionById: async (breweryId, sessionId) => {
    if (!db || !breweryId || !sessionId) {
      set({ currentSession: null, isLoading: false, error: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const data = sessionSnap.data();
        let logs = data.logs || [];
        
        if (!data.logs) {
          const logsRef = collection(db, `breweries/${breweryId}/brew_sessions/${sessionId}/fermentation_logs`);
          const logsSnap = await getDocs(logsRef);
          logs = logsSnap.docs.map(l => l.data() as BrewLog);
        }
        
        set({ currentSession: { ...data, id: sessionSnap.id, logs } as BrewSession });
      } else {
        set({ currentSession: null, error: 'Session not found' });
      }
    } catch (err: unknown) {
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
      const startBrewSessionFn = httpsCallable<Record<string, unknown>, { status: string, sessionId: string }>(functions, 'startBrewSession');
      
      const response = await startBrewSessionFn(payload);
      
      if (response.data && response.data.sessionId) {
        set({ isLoading: false });
        return response.data.sessionId;
      }
      
      set({ isLoading: false });
      return null;
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update steps' });
    }
  },

  updateSessionStatus: async (breweryId, sessionId, newStatus, actualOg) => {
    if (!db || !breweryId || !sessionId) return;
    
    const { currentSession } = get();
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (actualOg !== undefined) {
      updateData.actualOg = actualOg;
    }

    if (newStatus === 'fermenting' && currentSession?.status === 'planned') {
      updateData.pitchTimestamp = new Date().toISOString();
    } else if (newStatus === 'completed') {
      updateData.completedDate = new Date().toISOString();
    }

    if (currentSession) {
      set({ currentSession: { ...currentSession, ...updateData } as BrewSession });
    }

    try {
      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      await updateDoc(sessionRef, updateData);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update status' });
    }
  },

  addLogToSession: async (breweryId, sessionId, newLog) => {
    if (!db || !breweryId || !sessionId) return;

    const { currentSession } = get();
    const updatedLogs = [...(currentSession?.logs || []), newLog];
    
    let updatedTosna = currentSession?.tosnaSchedule;
    const usedOg = currentSession?.actualOg || currentSession?.targetOg;

    if (usedOg && newLog.sg !== null && updatedTosna && !updatedTosna.isCompressed) {
      const sugarBreak = calculateOneThirdSugarBreak(usedOg);
      if (newLog.sg <= sugarBreak) {
        updatedTosna = { ...updatedTosna, isCompressed: true };
      }
    }

    if (currentSession) {
      set({ 
        currentSession: { 
          ...currentSession, 
          logs: updatedLogs,
          tosnaSchedule: updatedTosna
        } 
      });
    }

    try {
      const logRef = doc(collection(db, `breweries/${breweryId}/brew_sessions/${sessionId}/fermentation_logs`), newLog.id);
      await setDoc(logRef, newLog);

      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      const updatePayload: Record<string, unknown> = {
        updatedAt: new Date().toISOString()
      };

      if (updatedTosna && currentSession?.tosnaSchedule?.isCompressed !== updatedTosna.isCompressed) {
        updatePayload.tosnaSchedule = updatedTosna;
      }

      await updateDoc(sessionRef, updatePayload);
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update TOSNA' });
    }
  },

  splitBrewSession: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const functions = getFunctions();
      const splitBatchFn = httpsCallable<Record<string, unknown>, { status: string }>(functions, 'splitBatch');
      
      await splitBatchFn(payload);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to split session';
      set({ error: errorMessage });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  }
}));