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

export interface BreweryState {
  activeBreweryId: string | null;
  activeBrewery: Brewery | null;
  breweries: Brewery[];
  setActiveBrewery: (brewery: Brewery | null) => void;
  setBreweries: (breweries: Brewery[]) => void;
}

export const useBreweryStore = create<BreweryState>()(
  persist(
    (set) => ({
      activeBreweryId: null,
      activeBrewery: null,
      breweries: [],
      setActiveBrewery: (brewery) => set({ 
        activeBrewery: brewery, 
        activeBreweryId: brewery ? brewery.id : null 
      }),
      setBreweries: (breweries) => set({ breweries }),
    }),
    {
      name: 'brewery-storage',
      partialize: (state) => ({ activeBreweryId: state.activeBreweryId }),
    }
  )
);