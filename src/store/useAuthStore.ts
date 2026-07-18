import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';

export interface AuthState {
  user: User | null;
  isLoading: boolean; 
  setUser: (user: User | null) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user: user ?? null }),
  setIsLoading: (isLoading) => set({ isLoading: Boolean(isLoading) }),
}));