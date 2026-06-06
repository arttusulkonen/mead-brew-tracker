// src/store/useBreweryStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Brewery {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  invitedEmails: string[];
  isPersonal: boolean;
}

interface BreweryState {
  activeBrewery: Brewery | null;
  breweries: Brewery[];
  setActiveBrewery: (brewery: Brewery | null) => void;
  setBreweries: (breweries: Brewery[]) => void;
}

export const useBreweryStore = create<BreweryState>()(
  persist(
    (set) => ({
      activeBrewery: null,
      breweries: [],
      setActiveBrewery: (brewery) => set({ activeBrewery: brewery }),
      setBreweries: (breweries) => set({ breweries }),
    }),
    {
      name: 'brewery-storage',
      partialize: (state) => ({ activeBrewery: state.activeBrewery }),
    }
  )
);