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
}

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

      const sessions = (data || []).map(row => ({
        id: row.id,
        breweryId: row.brewery_id,
        recipeId: row.recipe_id,
        recipeName: row.recipe_name,
        beverageType: row.beverage_type,
        status: (row.status as BrewSessionStage) || 'Brew Day',
        batchSizeLiters: row.actual_batch_size_liters || row.batch_size_liters || 0,
        targetOg: row.actual_original_gravity || row.target_og || 1.000,
        targetFg: row.actual_final_gravity || row.target_fg || 1.000,
        startDate: row.created_at,
        pitchTimestamp: row.pitch_timestamp || null,
        sessionSteps: typeof row.session_steps === 'string' ? JSON.parse(row.session_steps) : (row.session_steps || []),
        isSplit: row.is_split || false,
        completedDate: row.completed_date || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by || ''
      } as BrewSession));

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

      const mappedSession: BrewSession = {
        id: sessionData.id,
        breweryId: sessionData.brewery_id,
        recipeId: sessionData.recipe_id,
        recipeName: sessionData.recipe_name,
        beverageType: sessionData.beverage_type,
        status: (sessionData.status as BrewSessionStage) || 'Brew Day',
        batchSizeLiters: sessionData.actual_batch_size_liters || sessionData.batch_size_liters || 0,
        targetOg: sessionData.actual_original_gravity || sessionData.target_og || 1.000,
        targetFg: sessionData.actual_final_gravity || sessionData.target_fg || 1.000,
        actualOg: sessionData.actual_original_gravity,
        actualFg: sessionData.actual_final_gravity,
        actualAbv: sessionData.actual_abv,
        sessionIngredients: typeof sessionData.session_ingredients === 'string' ? JSON.parse(sessionData.session_ingredients) : (sessionData.session_ingredients || []),
        sessionSteps: typeof sessionData.session_steps === 'string' ? JSON.parse(sessionData.session_steps) : (sessionData.session_steps || []),
        startDate: sessionData.created_at,
        pitchTimestamp: sessionData.pitch_timestamp || null,
        logs: mappedLogs,
        tosnaSchedule: typeof sessionData.tosna_schedule === 'string' ? JSON.parse(sessionData.tosna_schedule) : (sessionData.tosna_schedule || null),
        isSplit: sessionData.is_split || false,
        completedDate: sessionData.completed_date || null,
        createdAt: sessionData.created_at,
        updatedAt: sessionData.updated_at,
        createdBy: sessionData.created_by || ''
      };

      set({ currentSession: mappedSession });
    } catch (err: unknown) {
      set({ currentSession: null, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearCurrentSession: () => set({ currentSession: null, error: null }),

  startSession: async () => null, 

  updateSteps: async (breweryId, sessionId, newSteps) => {
    if (!breweryId || !sessionId) return;
    const { currentSession } = get();
    if (currentSession) set({ currentSession: { ...currentSession, sessionSteps: newSteps } });

    try {
      await supabase.from('brew_sessions').update({ session_steps: newSteps }).eq('id', sessionId);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update steps' });
    }
  },

  updateSessionStatus: async (breweryId, sessionId, newStatus, actualOg) => {
    if (!breweryId || !sessionId) return;
    const { currentSession } = get();
    
    const stateUpdate: Partial<BrewSession> = { status: newStatus };
    const dbUpdate: Record<string, unknown> = { status: newStatus };
    
    if (actualOg !== undefined) {
      stateUpdate.actualOg = actualOg;
      dbUpdate.actual_original_gravity = actualOg;
    }

    if (newStatus === 'Fermentation' && currentSession?.status === 'Brew Day') {
      const now = new Date().toISOString();
      stateUpdate.pitchTimestamp = now;
      dbUpdate.pitch_timestamp = now;
    }

    if (currentSession) {
      set({ currentSession: { ...currentSession, ...stateUpdate } as BrewSession });
    }

    try {
      await supabase.from('brew_sessions').update(dbUpdate).eq('id', sessionId);
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update status' });
    }
  },

  addLogToSession: async (breweryId, sessionId, newLog) => {
    if (!breweryId || !sessionId) return;
    
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
        await supabase.from('brew_sessions').update({ tosna_schedule: updatedTosna }).eq('id', sessionId);
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to add log' });
    }
  },

  updateTosnaSchedule: async (breweryId, sessionId, updatedAdditions) => {
    if (!breweryId || !sessionId) return;
    const { currentSession } = get();
    
    const updatedTosna = currentSession?.tosnaSchedule 
      ? { ...currentSession.tosnaSchedule, additions: updatedAdditions } 
      : null;

    if (currentSession && updatedTosna) {
      set({ currentSession: { ...currentSession, tosnaSchedule: updatedTosna } });
    }

    try {
      if (updatedTosna) {
        await supabase.from('brew_sessions').update({ tosna_schedule: updatedTosna }).eq('id', sessionId);
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Failed to update TOSNA' });
    }
  },

  splitBrewSession: async () => {
    throw new Error('Split Batch functionality requires Supabase RPC implementation.');
  } 
}));