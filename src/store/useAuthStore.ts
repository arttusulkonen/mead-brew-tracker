// src/store/useAuthStore.ts
import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';

export interface AuthState {
  user: User | null;
  isLoading: boolean; // Оставляем только одно поле
  setUser: (user: User | null) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));