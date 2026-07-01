// src/store/useInventoryStore.ts
import { create } from 'zustand';
import { supabase } from '../supabase/client';
import type { IngredientCategory, IngredientUnion, PopulatedInventoryItem, WorkspaceInventoryItem } from '../types/ingredient';

export interface InventoryState {
  globalIngredients: IngredientUnion[];
  inventory: PopulatedInventoryItem[];
  isLoading: boolean;
  error: string | null;

  fetchGlobalIngredients: (category?: IngredientCategory | null) => Promise<void>;
  fetchInventory: (breweryId: string | null | undefined) => Promise<void>;
  addInventoryItem: (breweryId: string | null | undefined, itemData: Omit<WorkspaceInventoryItem, 'id' | 'breweryId'>) => Promise<boolean>;
  addCustomIngredient: (ingredientData: Omit<IngredientUnion, 'id' | 'updatedAt'>) => Promise<IngredientUnion | null>;
  updateItem: (breweryId: string | null | undefined, itemId: string, updates: Omit<Partial<WorkspaceInventoryItem>, 'id' | 'breweryId'>) => Promise<boolean>;
  removeItem: (breweryId: string | null | undefined, itemId: string) => Promise<boolean>;
  consumeIngredients: (breweryId: string | null | undefined, ingredientsToConsume: { globalIngredientId: string, quantity: number }[]) => Promise<boolean>;
  clearInventory: () => void;
}

const mapIngredientRow = (item: any): IngredientUnion => {
  const base = {
    id: item.id,
    name: item.name,
    category: item.category,
    notes: item.notes,
    origin: item.origin,
    producer: item.producer,
    updatedAt: item.updated_at,
    createdBy: item.created_by,
  };

  switch (item.category) {
    case 'Fermentable':
      return {
        ...base,
        category: 'Fermentable',
        type: item.form,
        yieldPpg: item.yield_ppg,
        colorEbc: item.color_ebc,
        moistureContentPct: item.moisture_content_pct,
        diastaticPowerLintner: item.diastatic_power_lintner,
        isMashed: item.form === 'Grain',
      } as any;
    case 'Honey':
      return {
        ...base,
        category: 'Honey',
        sugarContentBrix: item.sugar_content_brix,
        moistureContentPct: item.moisture_content_pct,
      } as any;
    case 'Yeast':
      return {
        ...base,
        category: 'Yeast',
        form: item.form,
        tempMinC: item.temp_min_c,
        tempMaxC: item.temp_max_c,
        alcoholTolerancePct: item.alcohol_tolerance_pct,
        attenuationPct: item.attenuation_pct,
        nitrogenDemand: item.nitrogen_demand,
      } as any;
    case 'Hops':
      return {
        ...base,
        category: 'Hops',
        form: item.form,
        alphaAcidPct: item.alpha_acid_pct,
      } as any;
    case 'Water Profile':
      return {
        ...base,
        category: 'Water Profile',
        calciumPpm: item.calcium_ppm,
        magnesiumPpm: item.magnesium_ppm,
        sodiumPpm: item.sodium_ppm,
        sulfatePpm: item.sulfate_ppm,
        chloridePpm: item.chloride_ppm,
        bicarbonatePpm: item.bicarbonate_ppm,
      } as any;
    case 'Additive':
      return {
        ...base,
        category: 'Additive',
        additiveType: item.additive_type,
        yanValuePerGramPerLiter: item.yan_value_per_gram_per_liter,
        dosagePer10Liters: item.dosage_per_10_liters,
        dosagePerGramYeast: item.dosage_per_gram_yeast,
      } as any;
    default:
      return base as any;
  }
};

export const useInventoryStore = create<InventoryState>((set, get) => ({
  globalIngredients: [],
  inventory: [],
  isLoading: false,
  error: null,

  fetchGlobalIngredients: async (category) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase.from('ingredients').select('*');
      if (category) {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (error) throw error;

      const ingredients = (data ?? []).map(mapIngredientRow);
      set({ globalIngredients: ingredients });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to fetch global ingredients' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchInventory: async (breweryId) => {
    if (!breweryId) {
      set({ inventory: [], error: null, isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, ingredient:ingredients(*)')
        .eq('brewery_id', breweryId);

      if (error) throw error;

      const items: PopulatedInventoryItem[] = (data ?? []).map((row: any) => ({
        id: row.id,
        breweryId: row.brewery_id,
        ingredientId: row.ingredient_id,
        quantityOnHand: row.quantity_on_hand,
        unit: row.unit,
        batchLotNumber: row.batch_lot_number,
        expirationDate: row.expiration_date,
        ingredient: mapIngredientRow(row.ingredient),
      }));

      set({ inventory: items });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to fetch inventory' });
    } finally {
      set({ isLoading: false });
    }
  },

  addInventoryItem: async (breweryId, itemData) => {
    if (!breweryId || !itemData) return false;
    
    const qty = Number(itemData.quantityOnHand);
    if (!Number.isFinite(qty) || qty < 0) {
      set({ error: 'Invalid quantity provided', isLoading: false });
      return false;
    }
    
    set({ isLoading: true, error: null });
    try {
      const { data: existing } = await supabase
        .from('inventory')
        .select('*')
        .eq('brewery_id', breweryId)
        .eq('ingredient_id', itemData.ingredientId)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ 
            quantity_on_hand: existing.quantity_on_hand + qty,
            unit: itemData.unit 
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('inventory')
          .insert([{
            brewery_id: breweryId,
            ingredient_id: itemData.ingredientId,
            quantity_on_hand: qty,
            unit: itemData.unit
          }]);

        if (insertError) throw insertError;
      }

      await get().fetchInventory(breweryId);
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to add item', isLoading: false });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  addCustomIngredient: async (ingredientData) => {
    set({ isLoading: true, error: null });
    try {
      const payload: any = {
        name: ingredientData.name,
        category: ingredientData.category,
        notes: ingredientData.notes,
        origin: ingredientData.origin,
        producer: ingredientData.producer,
      };

      if ('form' in ingredientData) payload.form = ingredientData.form;
      if ('type' in ingredientData) payload.form = ingredientData.type;
      if ('yieldPpg' in ingredientData) payload.yield_ppg = ingredientData.yieldPpg;
      if ('colorEbc' in ingredientData) payload.color_ebc = ingredientData.colorEbc;
      if ('moistureContentPct' in ingredientData) payload.moisture_content_pct = ingredientData.moistureContentPct;
      if ('diastaticPowerLintner' in ingredientData) payload.diastatic_power_lintner = ingredientData.diastaticPowerLintner;
      if ('sugarContentBrix' in ingredientData) payload.sugar_content_brix = ingredientData.sugarContentBrix;
      if ('alphaAcidPct' in ingredientData) payload.alpha_acid_pct = ingredientData.alphaAcidPct;
      if ('alcoholTolerancePct' in ingredientData) payload.alcohol_tolerance_pct = ingredientData.alcoholTolerancePct;
      if ('attenuationPct' in ingredientData) payload.attenuation_pct = ingredientData.attenuationPct;
      if ('tempMinC' in ingredientData) payload.temp_min_c = ingredientData.tempMinC;
      if ('tempMaxC' in ingredientData) payload.temp_max_c = ingredientData.tempMaxC;
      if ('nitrogenDemand' in ingredientData) payload.nitrogen_demand = ingredientData.nitrogenDemand;
      if ('additiveType' in ingredientData) payload.additive_type = ingredientData.additiveType;
      if ('yanValuePerGramPerLiter' in ingredientData) payload.yan_value_per_gram_per_liter = ingredientData.yanValuePerGramPerLiter;
      if ('dosagePerGramYeast' in ingredientData) payload.dosage_per_gram_yeast = ingredientData.dosagePerGramYeast;
      if ('dosagePer10Liters' in ingredientData) payload.dosage_per_10_liters = ingredientData.dosagePer10Liters;
      if ('calciumPpm' in ingredientData) payload.calcium_ppm = ingredientData.calciumPpm;
      if ('magnesiumPpm' in ingredientData) payload.magnesium_ppm = ingredientData.magnesiumPpm;
      if ('sodiumPpm' in ingredientData) payload.sodium_ppm = ingredientData.sodiumPpm;
      if ('sulfatePpm' in ingredientData) payload.sulfate_ppm = ingredientData.sulfatePpm;
      if ('chloridePpm' in ingredientData) payload.chloride_ppm = ingredientData.chloridePpm;
      if ('bicarbonatePpm' in ingredientData) payload.bicarbonate_ppm = ingredientData.bicarbonatePpm;

      const { data, error } = await supabase
        .from('ingredients')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newIngredient = mapIngredientRow(data);
        set(state => ({ globalIngredients: [...state.globalIngredients, newIngredient] }));
        return newIngredient;
      }
      return null;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to add custom ingredient' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updateItem: async (breweryId, itemId, updates) => {
    if (!breweryId || !itemId) return false;
    set({ isLoading: true, error: null });
    try {
      const payload: any = {};
      if (updates.quantityOnHand !== undefined) payload.quantity_on_hand = updates.quantityOnHand;
      if (updates.unit !== undefined) payload.unit = updates.unit;
      if (updates.batchLotNumber !== undefined) payload.batch_lot_number = updates.batchLotNumber;
      if (updates.expirationDate !== undefined) payload.expiration_date = updates.expirationDate;

      const { error } = await supabase
        .from('inventory')
        .update(payload)
        .eq('id', itemId)
        .eq('brewery_id', breweryId);

      if (error) throw error;

      set(state => ({
        inventory: state.inventory.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        )
      }));
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to update inventory item' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  removeItem: async (breweryId, itemId) => {
    if (!breweryId || !itemId) return false;
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId)
        .eq('brewery_id', breweryId);

      if (error) throw error;

      set(state => ({
        inventory: state.inventory.filter(item => item.id !== itemId)
      }));
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to remove inventory item' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  consumeIngredients: async (breweryId, ingredientsToConsume) => {
    if (!breweryId || !ingredientsToConsume.length) return false;
    set({ isLoading: true, error: null });
    try {
      const currentInventory = get().inventory;
      const updatePromises = [];

      for (const ing of ingredientsToConsume) {
        if (ing.quantity > 0) {
          const invItem = currentInventory.find(i => i.ingredientId === ing.globalIngredientId);
          if (invItem) {
            let decrementQty = ing.quantity;
            switch (invItem.unit) {
              case 'kg':
              case 'L':
                decrementQty = ing.quantity / 1000;
                break;
              case 'oz':
                decrementQty = ing.quantity / 28.3495;
                break;
              case 'lb':
                decrementQty = ing.quantity / 453.592;
                break;
              case 'gal':
                decrementQty = ing.quantity / 3785.41;
                break;
              default:
                decrementQty = ing.quantity;
            }

            updatePromises.push(
              supabase
                .from('inventory')
                .update({ quantity_on_hand: Math.max(0, invItem.quantityOnHand - decrementQty) })
                .eq('id', invItem.id)
                .eq('brewery_id', breweryId)
            );
          }
        }
      }
      
     const results = await Promise.all(updatePromises);
      
      for (const result of results) {
        if (result.error) throw result.error;
      }
      
      await get().fetchInventory(breweryId);
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to consume ingredients', isLoading: false });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  clearInventory: () => set({ inventory: [], error: null })
}));