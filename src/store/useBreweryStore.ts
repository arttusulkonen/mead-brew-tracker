// src/store/useBreweryStore.ts
import { create } from 'zustand';
import { supabase } from '../supabase/client';

export interface Brewery {
  id: string;
  name: string;
  ownerId: string;
  isPersonal: boolean;
  members: string[];
  invitedEmails: string[];
}

interface BreweryState {
  breweries: Brewery[];
  activeBrewery: Brewery | null;
  activeBreweryId: string | null;
  isLoading: boolean;
  error: string | null; // <--- ДОБАВЛЕНО
  fetchBreweries: (userId: string) => Promise<void>;
  createBrewery: (userId: string, name: string, isPersonal?: boolean, inviteEmails?: string) => Promise<Brewery | null>;
  deleteBrewery: (breweryId: string) => Promise<boolean>;
  inviteToBrewery: (breweryId: string, email: string) => Promise<boolean>;
  processPendingInvites: (userId: string, userEmail: string) => Promise<void>;
  setActiveBrewery: (brewery: Brewery | null) => void;
  setBreweries: (breweries: Brewery[]) => void;
}

export const useBreweryStore = create<BreweryState>((set, get) => ({
  breweries: [],
  activeBrewery: null,
  activeBreweryId: null,
  isLoading: false,
  error: null,

  setActiveBrewery: (brewery) => set({ 
    activeBrewery: brewery, 
    activeBreweryId: brewery?.id || null 
  }),

  setBreweries: (breweries) => set({ breweries }),

  fetchBreweries: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('breweries')
        .select('*')
        .or(`owner_id.eq.${userId},members.cs.{${userId}}`);

      if (error) throw error;

      const formattedBreweries = (data || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        ownerId: b.owner_id,
        members: b.members || [],
        invitedEmails: b.invited_emails || [],
        isPersonal: b.is_personal,
        createdAt: b.created_at,
      }));

      set({ 
        breweries: formattedBreweries, 
        activeBrewery: formattedBreweries.length > 0 ? formattedBreweries[0] : null,
        activeBreweryId: formattedBreweries.length > 0 ? formattedBreweries[0].id : null
      });
    } catch (err: any) {
      set({ error: err.message }); 
    } finally {
      set({ isLoading: false });
    }
  },

  createBrewery: async (userId, name, isPersonal = false, inviteEmails = '') => {
    try {
      const emailsList = inviteEmails
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.includes('@'));

      const { data, error } = await supabase
        .from('breweries')
        .insert([{ 
          name, 
          owner_id: userId, 
          is_personal: isPersonal,
          members: [userId],
          invited_emails: emailsList
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          name: data.name,
          ownerId: data.owner_id,
          isPersonal: data.is_personal,
          members: data.members || [],
          invitedEmails: data.invited_emails || [],
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to create brewery:', error);
      return null;
    }
  },

  deleteBrewery: async (breweryId) => {
    try {
      const { error } = await supabase.from('breweries').delete().eq('id', breweryId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete brewery:', error);
      return false;
    }
  },

  inviteToBrewery: async (breweryId, email) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const brewery = get().breweries.find(b => b.id === breweryId);
      if (!brewery) return false;

      const newInvites = [...new Set([...(brewery.invitedEmails || []), normalizedEmail])];

      const { error } = await supabase
        .from('breweries')
        .update({ invited_emails: newInvites })
        .eq('id', breweryId);

      if (error) throw error;

      set(state => ({
        breweries: state.breweries.map(b => b.id === breweryId ? { ...b, invitedEmails: newInvites } : b)
      }));
      return true;
    } catch (error) {
      console.error('Failed to invite:', error);
      return false;
    }
  },

  processPendingInvites: async (userId, userEmail) => {
    try {
      // Ищем пивоварни, где мы числимся в приглашенных (Supabase RLS это пропустит)
      const { data, error } = await supabase
        .from('breweries')
        .select('*')
        .contains('invited_emails', [userEmail.toLowerCase()]);

      if (error) throw error;

      if (data && data.length > 0) {
        for (const b of data) {
          const newMembers = [...new Set([...(b.members || []), userId])];
          const newInvites = (b.invited_emails || []).filter((e: string) => e !== userEmail.toLowerCase());

          await supabase
            .from('breweries')
            .update({ members: newMembers, invited_emails: newInvites })
            .eq('id', b.id);
        }
      }
    } catch (error) {
      console.error('Failed to process invites:', error);
    }
  },
}));