import { create } from 'zustand';

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

export const useBreweryStore = create<BreweryState>((set) => ({
  activeBrewery: null,
  breweries: [],
  setActiveBrewery: (brewery) => set({ activeBrewery: brewery }),
  setBreweries: (breweries) => set({ breweries }),
}));