import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from '../firebase/config';
import type { BrewLog, BrewSession } from '../types/session';

export interface SessionState {
  sessions: BrewSession[];
  currentSession: BrewSession | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: (breweryId: string | null | undefined) => Promise<void>;
  fetchSessionById: (breweryId: string | null | undefined, sessionId: string | null | undefined) => Promise<void>;
  createSession: (breweryId: string | null | undefined, session: BrewSession) => Promise<void>;
  addLogToSession: (breweryId: string | null | undefined, sessionId: string | null | undefined, log: BrewLog) => Promise<void>;
  updateSessionStatus: (breweryId: string | null | undefined, sessionId: string | null | undefined, status: BrewSession['status']) => Promise<void>;
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
      const sessionsRef = collection(db, `breweries/${breweryId}/brew_sessions`);
      const snapshot = await getDocs(sessionsRef);
      
      const fetched: BrewSession[] = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id,
        logs: [] as BrewLog[]
      } as unknown as BrewSession));
      
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      set({ sessions: fetched, isLoading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Error fetching sessions', isLoading: false });
    }
  },

  fetchSessionById: async (breweryId, sessionId) => {
    if (!breweryId || !sessionId || !db) {
      set({ currentSession: null, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        const logsRef = collection(db, `breweries/${breweryId}/brew_sessions/${sessionId}/fermentation_logs`);
        const logsSnap = await getDocs(logsRef);
        const logs = logsSnap.docs.map(l => l.data() as BrewLog);
        
        set({ 
          currentSession: { ...data, id: docSnap.id, logs } as BrewSession, 
          isLoading: false 
        });
      } else {
        set({ currentSession: null, error: 'Session not found', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error?.message || 'Error fetching session', isLoading: false });
    }
  },

  createSession: async (breweryId, session) => {
    if (!breweryId || !session || !db) return;
    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, `breweries/${breweryId}/brew_sessions`, session.id);
      const sessionData = { ...session };
      delete (sessionData as any).logs; 
      
      await setDoc(docRef, sessionData);
      
      set(state => ({
        sessions: [session, ...state.sessions],
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error?.message || 'Error creating session', isLoading: false });
      throw error;
    }
  },

  addLogToSession: async (breweryId, sessionId, log) => {
    if (!breweryId || !sessionId || !log || !db) return;
    set({ isLoading: true, error: null });
    try {
      const logRef = doc(db, `breweries/${breweryId}/brew_sessions/${sessionId}/fermentation_logs`, log.id);
      await setDoc(logRef, log);

      const sessionRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      const currentSession = get().currentSession;
      
      let updatedTosnaSchedule = currentSession?.tosnaSchedule;

      if (currentSession && currentSession.status === 'fermenting' && updatedTosnaSchedule && log.sg !== null) {
        if (!updatedTosnaSchedule.isCompressed && log.sg <= updatedTosnaSchedule.targetOneThirdBreak) {
          updatedTosnaSchedule = {
            ...updatedTosnaSchedule,
            isCompressed: true
          };
        }
      }

      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (updatedTosnaSchedule && currentSession?.tosnaSchedule?.isCompressed !== updatedTosnaSchedule.isCompressed) {
        updateData.tosnaSchedule = updatedTosnaSchedule;
      }

      await updateDoc(sessionRef, updateData);

      if (currentSession && currentSession.id === sessionId) {
        const updatedLogs = [...(currentSession.logs || []), log];
        set({
          currentSession: { 
            ...currentSession, 
            logs: updatedLogs,
            tosnaSchedule: updatedTosnaSchedule 
          }
        });
      }
    } catch (error: any) {
      set({ error: error?.message || 'Error adding log', isLoading: false });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateSessionStatus: async (breweryId, sessionId, status) => {
    if (!breweryId || !sessionId || !status || !db) return;
    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, `breweries/${breweryId}/brew_sessions`, sessionId);
      const session = get().currentSession;
      
      const updateData: Partial<BrewSession> = { status, updatedAt: new Date().toISOString() };
      
      if (status === 'fermenting' && session && session.status === 'planned') {
        const pitchTimestamp = new Date().toISOString();
        const targetOg = session.targetOg || 1.000;
        const targetOneThirdBreak = targetOg - ((targetOg - 1.000) / 3);
        
        updateData.pitchTimestamp = pitchTimestamp;
        updateData.tosnaSchedule = {
          targetOneThirdBreak: Math.round(targetOneThirdBreak * 1000) / 1000,
          isCompressed: false,
          additions: [
            { id: 1, type: '24h', targetDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), isCompleted: false },
            { id: 2, type: '48h', targetDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), isCompleted: false },
            { id: 3, type: '72h', targetDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), isCompleted: false },
            { id: 4, type: '1/3 Break', isCompleted: false }
          ]
        };
      }

      if (status === 'completed') {
        updateData.completedDate = new Date().toISOString();
      }

      await updateDoc(docRef, updateData);

      set(state => ({
        currentSession: state.currentSession?.id === sessionId ? { ...state.currentSession, ...updateData } : state.currentSession,
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error?.message || 'Error updating status', isLoading: false });
      throw error;
    }
  },

  clearCurrentSession: () => set({ currentSession: null, error: null })
}));