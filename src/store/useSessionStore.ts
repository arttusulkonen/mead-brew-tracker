// src/store/useSessionStore.ts
import { calculateOneThirdSugarBreak } from '@mead-tracker/math';
import { create } from 'zustand';
import { supabase } from '../supabase/client';
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
  deleteSession: (breweryId: string | null | undefined, sessionId: string | null | undefined) => Promise<void>;
  analyzeBrewSession: (breweryId: string | null | undefined, sessionId: string, locale: string) => Promise<void>;
}

const normalizeStatus = (status: string): BrewSessionStage => {
  const map: Record<string, BrewSessionStage> = {
    'planned': 'Brew Day',
    'fermenting': 'Fermentation',
    'aging': 'Conditioning',
    'completed': 'Completed',
    'split': 'Completed',
    'Brew Day': 'Brew Day',
    'Fermentation': 'Fermentation',
    'Conditioning': 'Conditioning',
    'Bottled': 'Completed',
    'Completed': 'Completed'
  };
  return map[status] || 'Brew Day';
};

const getDatabaseStatusKey = (status: BrewSessionStage): string => {
  const map: Record<BrewSessionStage, string> = {
    'Brew Day': 'planned',
    'Fermentation': 'fermenting',
    'Conditioning': 'aging',
    'Bottled': 'completed',
    'Completed': 'completed'
  };
  return map[status] || 'planned';
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: false,
  error: null,

  fetchSessions: async (breweryId) => {
    if (!breweryId) return;
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('brew_sessions')
        .select('*')
        .eq('brewery_id', breweryId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const sessions = (data || []).map(row => {
        let parsedSteps = [];
        let parsedIngredients = [];
        let parsedTosna = null;

        try { parsedSteps = typeof row.session_steps === 'string' ? JSON.parse(row.session_steps) : (row.session_steps || []); } catch (e) { console.warn('Failed to parse steps', e); }
        try { parsedIngredients = typeof row.session_ingredients === 'string' ? JSON.parse(row.session_ingredients) : (row.session_ingredients || []); } catch (e) { console.warn('Failed to parse ingredients', e); }
        try { parsedTosna = typeof row.tosna_schedule === 'string' ? JSON.parse(row.tosna_schedule) : (row.tosna_schedule || null); } catch (e) { console.warn('Failed to parse tosna', e); }

        return {
          id: row.id,
          breweryId: row.brewery_id,
          recipeId: row.recipe_id,
          recipeName: row.recipe_name,
          beverageType: row.beverage_type,
          status: normalizeStatus(row.status),
          batchSizeLiters: row.actual_batch_size_liters || row.batch_size_liters || 0,
          targetOg: row.actual_original_gravity || row.target_og || 1.000,
          targetFg: row.actual_final_gravity || row.target_fg || 1.000,
          startDate: row.created_at,
          pitchTimestamp: row.pitch_timestamp || null,
          sessionSteps: parsedSteps,
          sessionIngredients: parsedIngredients,
          tosnaSchedule: parsedTosna,
          isSplit: row.is_split || false,
          completedDate: row.completed_date || null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdBy: row.created_by || '',
          aiScore: row.ai_score || null,
          aiAnalysisReport: row.ai_analysis_report || null
        } as BrewSession;
      });

      set({ sessions });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSessionById: async (breweryId, sessionId) => {
    if (!breweryId || !sessionId) {
      set({ currentSession: null, isLoading: false, error: null });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('brew_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('brewery_id', breweryId)
        .single();

      if (sessionError || !sessionData) throw new Error('Session not found');

      const { data: logsData } = await supabase
        .from('daily_fermentation_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('logged_at', { ascending: true });

      const mappedLogs: BrewLog[] = (logsData || []).map(l => ({
        id: l.id,
        timestamp: l.logged_at,
        sg: l.gravity_reading,
        ph: l.ph_reading,
        tempC: l.liquid_temperature_c,
        actionTaken: l.notes && l.notes.includes('\n') ? l.notes.split('\n')[0] : (l.notes || 'Measurement'),
        notes: l.notes && l.notes.includes('\n') ? l.notes.substring(l.notes.indexOf('\n') + 1) : '',
        stepId: null,
        dayNumber: Math.max(1, Math.floor((new Date(l.logged_at).getTime() - new Date(sessionData.created_at).getTime()) / 86400000) + 1)
      }));

      let parsedSteps = [];
      let parsedIngredients = [];
      let parsedTosna = null;

      try { parsedSteps = typeof sessionData.session_steps === 'string' ? JSON.parse(sessionData.session_steps) : (sessionData.session_steps || []); } catch (e) { console.warn('Failed to parse steps', e); }
      try { parsedIngredients = typeof sessionData.session_ingredients === 'string' ? JSON.parse(sessionData.session_ingredients) : (sessionData.session_ingredients || []); } catch (e) { console.warn('Failed to parse ingredients', e); }
      try { parsedTosna = typeof sessionData.tosna_schedule === 'string' ? JSON.parse(sessionData.tosna_schedule) : (sessionData.tosna_schedule || null); } catch (e) { console.warn('Failed to parse tosna', e); }

      const mappedSession: BrewSession = {
        id: sessionData.id,
        breweryId: sessionData.brewery_id,
        recipeId: sessionData.recipe_id,
        recipeName: sessionData.recipe_name,
        beverageType: sessionData.beverage_type,
        status: normalizeStatus(sessionData.status),
        batchSizeLiters: sessionData.actual_batch_size_liters || sessionData.batch_size_liters || 0,
        targetOg: sessionData.actual_original_gravity || sessionData.target_og || 1.000,
        targetFg: sessionData.actual_final_gravity || sessionData.target_fg || 1.000,
        actualOg: sessionData.actual_original_gravity,
        actualFg: sessionData.actual_final_gravity,
        actualAbv: sessionData.actual_abv,
        sessionIngredients: parsedIngredients,
        sessionSteps: parsedSteps,
        startDate: sessionData.created_at,
        pitchTimestamp: sessionData.pitch_timestamp || null,
        logs: mappedLogs,
        tosnaSchedule: parsedTosna,
        isSplit: sessionData.is_split || false,
        completedDate: sessionData.completed_date || null,
        createdAt: sessionData.created_at,
        updatedAt: sessionData.updated_at,
        createdBy: sessionData.created_by || '',
        aiScore: sessionData.ai_score || null,
        aiAnalysisReport: sessionData.ai_analysis_report || null
      };

      set({ currentSession: mappedSession });
    } catch (err: unknown) {
      set({ currentSession: null, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearCurrentSession: () => set({ currentSession: null, error: null }),

  startSession: async (payload) => {
    if (!payload?.brewery_id) return null;
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('brew_sessions')
        .insert([payload])
        .select('id')
        .single();
        
      if (error) throw error;
      return data?.id || null;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to start session' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  }, 

  updateSteps: async (breweryId, sessionId, newSteps) => {
    if (!breweryId || !sessionId) return;
    const { currentSession } = get();
    if (currentSession) set({ currentSession: { ...currentSession, sessionSteps: newSteps || [] } });

    try {
      await supabase.from('brew_sessions').update({ session_steps: newSteps }).eq('id', sessionId).eq('brewery_id', breweryId);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update steps' });
    }
  },

  updateSessionStatus: async (breweryId, sessionId, newStatus, actualOg) => {
    if (!breweryId || !sessionId) return;
    const { currentSession } = get();
    
    const stateUpdate: Partial<BrewSession> = { status: newStatus };
    const dbUpdate: Record<string, unknown> = { 
      status: getDatabaseStatusKey(newStatus)
    };
    
    if (actualOg !== undefined) {
      stateUpdate.actualOg = actualOg;
      dbUpdate.actual_original_gravity = actualOg;
    }

    if (newStatus === 'Fermentation' && currentSession?.status === 'Brew Day') {
      const now = new Date().toISOString();
      stateUpdate.pitchTimestamp = now;
      dbUpdate.pitch_timestamp = now;
    }
    
    if (newStatus === 'Completed') {
      const now = new Date().toISOString();
      stateUpdate.completedDate = now;
      dbUpdate.completed_date = now;
    }

    if (currentSession?.tosnaSchedule) {
      stateUpdate.tosnaSchedule = { ...currentSession.tosnaSchedule };
    }

    if (currentSession) {
      set({ currentSession: { ...currentSession, ...stateUpdate } as BrewSession });
    }

    try {
      const { error } = await supabase.from('brew_sessions').update(dbUpdate).eq('id', sessionId).eq('brewery_id', breweryId);
      if (error) throw error;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update status' });
      await get().fetchSessionById(breweryId, sessionId);
    }
  },

  addLogToSession: async (breweryId, sessionId, newLog) => {
    if (!breweryId || !sessionId || !newLog) return;
    
    const { currentSession } = get();
    const updatedLogs = [...(currentSession?.logs || []), newLog];
    
    let updatedTosna = currentSession?.tosnaSchedule;
    const usedOg = currentSession?.actualOg || currentSession?.targetOg;
    const usedFg = currentSession?.actualFg || currentSession?.targetFg || 1.000;

    if (usedOg && newLog.sg !== null && updatedTosna && !updatedTosna.isCompressed) {
      const sugarBreak = calculateOneThirdSugarBreak(usedOg, usedFg);
      if (newLog.sg <= sugarBreak) {
        updatedTosna = { ...updatedTosna, isCompressed: true };
      }
    }

    if (currentSession) {
      set({ currentSession: { ...currentSession, logs: updatedLogs, tosnaSchedule: updatedTosna } });
    }

    try {
      const logPayload = {
        session_id: sessionId,
        logged_at: newLog.timestamp,
        gravity_reading: newLog.sg,
        ph_reading: newLog.ph,
        liquid_temperature_c: newLog.tempC,
        notes: newLog.notes ? `${newLog.actionTaken}\n${newLog.notes}` : newLog.actionTaken
      };
      
      await supabase.from('daily_fermentation_logs').insert([logPayload]);

      if (updatedTosna) {
        await supabase.from('brew_sessions').update({ tosna_schedule: updatedTosna }).eq('id', sessionId).eq('brewery_id', breweryId);
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to add log' });
    }
  },

  updateTosnaSchedule: async (breweryId, sessionId, updatedAdditions) => {
    if (!breweryId || !sessionId || !updatedAdditions) return;
    const { currentSession } = get();
    
    const updatedTosna = currentSession?.tosnaSchedule 
      ? { ...currentSession.tosnaSchedule, additions: updatedAdditions } 
      : null;

    if (currentSession && updatedTosna) {
      set({ currentSession: { ...currentSession, tosnaSchedule: updatedTosna } });
    }

    try {
      if (updatedTosna) {
        await supabase.from('brew_sessions').update({ tosna_schedule: updatedTosna }).eq('id', sessionId).eq('brewery_id', breweryId);
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update TOSNA' });
    }
  },

  splitBrewSession: async () => {
    set({ error: 'Split Batch functionality is not currently available.' });
    return;
  },

  deleteSession: async (breweryId, sessionId) => {
    if (!breweryId || !sessionId) return;
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('brew_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('brewery_id', breweryId);

      if (error) throw error;

      set(state => ({
        sessions: (state.sessions || []).filter(s => s.id !== sessionId),
        currentSession: state.currentSession?.id === sessionId ? null : state.currentSession
      }));
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete session' });
    } finally {
      set({ isLoading: false });
    }
  },  

  analyzeBrewSession: async (breweryId, sessionId, locale) => {
    if (!breweryId || !sessionId) return;
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke('analyze-brew', {
        body: { sessionId, breweryId, locale }
      });
      
      if (error) throw error;
      
      const { currentSession } = get();
      if (currentSession && currentSession.id === sessionId) {
        set({
          currentSession: {
            ...currentSession,
            aiScore: data.score,
            aiAnalysisReport: data.report
          }
        });
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'AI Analysis failed' });
    } finally {
      set({ isLoading: false });
    }
  },
}));