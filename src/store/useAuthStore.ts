import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isLoading: boolean;
  setLanguage: (language: string) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isLoading: true,
  setLanguage: (language) => {
    localStorage.setItem('language', language);
    set({}); // Trigger a re-render
  },
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));