// src/utils/recipeCalculators.ts
import type { TosnaRequirements } from '@mead-tracker/math';
import { calculateAbvCrouch, calculateIbuTinseth, calculateMcu, calculateTosna, estimateOG, estimateSrmMorey, srmToEbc } from '@mead-tracker/math';
import type { RecipeIngredientEntry } from '../components/recipe-components/types';
import type { BeverageType } from '../types/recipe';
import { SWEETNESS_LEVELS } from './meadConstants';

export interface DynamicAdditive {
  id: string;
  name: string;
  totalGrams: number;
  rule: string;
  type: 'Yeast' | 'Nutrient' | 'Additive';
}

export interface RecipeDetailsStats {
  og: number;
  abv: number;
  ibu: number;
  ebc: number;
  tosna: TosnaRequirements | null;
  yeastAdded: number;
  dynamicAdditives: DynamicAdditive[];
}

export interface CalculationParams {
  ingredients: RecipeIngredientEntry[];
  batchSizeLiters: number;
  targetFg: number;
  beverageType: BeverageType;
  isSafeBacksweetening: boolean;
  wizardSweetness: string;
}

export const calculateRecipeStats = ({
  ingredients,
  batchSizeLiters,
  targetFg,
  beverageType,
  isSafeBacksweetening,
  wizardSweetness
}: CalculationParams): RecipeDetailsStats => {
  let totalFermentableGrams = 0;
  let averageBrixEquivalent = 0;
  let totalMcu = 0;
  let totalIbu = 0;
  let yeastAddedGrams = 0;
  let yeastNitrogenDemand: string = 'Medium';
  let totalWeightedBrix = 0;
  let customNutrientName = '';
  const dynamicAdditives: DynamicAdditive[] = [];

  (ingredients || []).forEach(item => {
    if (!item) return;
    if (item.category === 'Fermentable' || item.category === 'Honey') {
      let brixVal = 80;
      if (item.category === 'Honey' && item.sugarContentBrix) {
        brixVal = item.sugarContentBrix;
      } else if (item.yieldPpg) {
        brixVal = item.yieldPpg; 
      }

      const qty = item.quantity || 0;
      totalFermentableGrams += qty;
      totalWeightedBrix += (brixVal * qty);

      if (item.category === 'Fermentable' && beverageType === 'Beer' && batchSizeLiters > 0) {
        totalMcu += calculateMcu(qty / 1000, item.colorEbc || 5, batchSizeLiters);
      }
    } else if (item.category === 'Yeast') {
      yeastAddedGrams += item.quantity || 0;
      if (item.nitrogenDemand) yeastNitrogenDemand = item.nitrogenDemand;
      
      const recommendedYeastGrams = item.dosagePer10Liters 
        ? (batchSizeLiters / 10) * item.dosagePer10Liters
        : batchSizeLiters * 0.5; 

      if (recommendedYeastGrams > 0) {
        dynamicAdditives.push({ 
          id: item.id, 
          name: item.name, 
          totalGrams: recommendedYeastGrams, 
          rule: item.dosagePer10Liters ? `${item.dosagePer10Liters}g / 10L` : 'Standard 0.5g / 1L',
          type: 'Yeast'
        });
      }
    }
  });

  if (totalFermentableGrams > 0) {
    averageBrixEquivalent = totalWeightedBrix / totalFermentableGrams;
  }

  const estimatedOg = estimateOG(batchSizeLiters, totalFermentableGrams, averageBrixEquivalent);
  const estimatedAbv = calculateAbvCrouch(estimatedOg, targetFg);
  const estimatedEbc = beverageType === 'Beer' ? srmToEbc(estimateSrmMorey(totalMcu)) : 0;

  (ingredients || []).forEach(item => {
    if (!item) return;
    if (item.category === 'Hops' && beverageType === 'Beer' && batchSizeLiters > 0) {
      const boilTime = item.boilTimeMinutes || 0;
      const alpha = item.alphaAcidPct || 5;
      totalIbu += calculateIbuTinseth(alpha, item.quantity || 0, boilTime, batchSizeLiters, estimatedOg);
    }
  });

  const targetYeastObj = dynamicAdditives.find(d => d.type === 'Yeast');
  const targetYeastGrams = targetYeastObj ? targetYeastObj.totalGrams : yeastAddedGrams;

  let tosnaData = null;
  if (beverageType === 'Mead' && targetYeastGrams > 0 && estimatedOg > 1.000) {
    let nFactor = 0.90;
    if (yeastNitrogenDemand === 'Low') nFactor = 0.75;
    else if (yeastNitrogenDemand === 'High' || yeastNitrogenDemand === 'Very High') nFactor = 1.25;
    tosnaData = calculateTosna(batchSizeLiters, estimatedOg, nFactor);
  }

  (ingredients || []).forEach(item => {
    if (!item || item.category !== 'Additive') return;
    let calculatedGrams = 0;
    let ruleApplied = '';

    if (item.additiveType === 'Nutrient' && tosnaData) {
      if (item.nutrientRole === 'Rehydration' || (!item.nutrientRole && item.name?.toLowerCase().includes('go-ferm'))) {
        calculatedGrams = tosnaData.goFermGrams || (targetYeastGrams * 1.25); 
        ruleApplied = 'TOSNA 3.0: Rehydration';
      } else if (item.nutrientRole === 'Fermentation' || !item.nutrientRole) {
        calculatedGrams = tosnaData.totalFermaidOGrams;
        ruleApplied = 'TOSNA 3.0: Total Fermentation Nutrient';
        if (!customNutrientName) customNutrientName = item.name;
      }
    } else if (item.dosagePerGramYeast && targetYeastGrams > 0) {
      calculatedGrams = targetYeastGrams * item.dosagePerGramYeast;
      ruleApplied = `${item.dosagePerGramYeast}g / 1g Yeast`;
    } else if (item.dosagePer10Liters && batchSizeLiters > 0) {
      calculatedGrams = (batchSizeLiters / 10) * item.dosagePer10Liters;
      ruleApplied = `${item.dosagePer10Liters}g / 10L`;
      if (item.additiveType === 'Nutrient' && !customNutrientName) customNutrientName = item.name;
    }

    if (calculatedGrams > 0) {
      dynamicAdditives.push({ id: item.id, name: item.name, totalGrams: calculatedGrams, rule: ruleApplied, type: 'Nutrient' });
    }
  });

  if (isSafeBacksweetening && beverageType === 'Mead') {
    const sweetnessLvl = SWEETNESS_LEVELS.find(s => s.id === wizardSweetness);
    const targetSweetFg = sweetnessLvl ? sweetnessLvl.minFg : 1.000;
    
    const points = Math.max(0, Math.round((targetSweetFg - 1.000) * 1000));
    const erythritolGrams = Math.round(batchSizeLiters * points * 2.5);
    
    if (erythritolGrams > 0) {
      const existingErythritol = (ingredients || []).find(i => i.form === 'Erythritol' || i.name?.toLowerCase().includes('erythritol') || i.name?.toLowerCase().includes('эритрит'));
      dynamicAdditives.push({
        id: existingErythritol ? existingErythritol.id : 'virtual-erythritol',
        name: existingErythritol ? existingErythritol.name : 'Erythritol',
        totalGrams: erythritolGrams,
        rule: `Target ${targetSweetFg.toFixed(3)} FG`,
        type: 'Additive'
      });
    }

    const dextroseGrams = Math.round(batchSizeLiters * 6.5);
    if (dextroseGrams > 0) {
      const existingDextrose = (ingredients || []).find(i => i.form === 'Dextrose' || i.name?.toLowerCase().includes('dextrose') || i.name?.toLowerCase().includes('декстроза'));
      dynamicAdditives.push({
        id: existingDextrose ? existingDextrose.id : 'virtual-dextrose',
        name: existingDextrose ? existingDextrose.name : 'Dextrose',
        totalGrams: dextroseGrams,
        rule: `Sparkling ~2.5 vols CO2`,
        type: 'Additive'
      });
    }
  }

  return { og: estimatedOg, abv: estimatedAbv, ibu: totalIbu, ebc: estimatedEbc, tosna: tosnaData, yeastAdded: yeastAddedGrams, dynamicAdditives };
};