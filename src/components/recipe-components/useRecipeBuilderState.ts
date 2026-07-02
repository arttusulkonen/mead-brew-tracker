// src/components/recipe-components/useRecipeBuilderState.ts
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import type { AdditiveType, IngredientCategory, IngredientUnion } from '../../types/ingredient';
import type { BeverageType, Recipe } from '../../types/recipe';
import type { BjcpStyle } from '../../utils/bjcpMatchEngine';
import { SWEETNESS_LEVELS } from '../../utils/meadConstants';
import type { RecipeIngredientEntry, RecipeStepEntry } from './types';

interface IngredientRow {
  id: string;
  name: string;
  category: string;
  form?: string;
  alpha_acid_pct?: number;
  alpha_acid_pct_min?: number;
  alcohol_tolerance_pct?: number;
  alcohol_tolerance_pct_min?: number;
  temp_min_c?: number;
  temp_max_c?: number;
  attenuation_pct?: number;
  attenuation_pct_min?: number;
  notes?: string;
  origin?: string;
  producer?: string;
  yield_ppg?: number;
  color_ebc?: number;
  moisture_content_pct?: number;
  nitrogen_demand?: string;
  additive_type?: string;
  nutrient_role?: string;
  dosage_per_gram_yeast?: number;
  dosage_per_10_liters?: number;
  calcium_ppm?: number;
  magnesium_ppm?: number;
  sodium_ppm?: number;
  sulfate_ppm?: number;
  chloride_ppm?: number;
  bicarbonate_ppm?: number;
}

interface StyleRow {
  style_id: string;
  name: string;
  category: string;
  beverage_type: string;
  og_min: number | null;
  og_max: number | null;
  fg_min: number | null;
  fg_max: number | null;
  abv_min: number | null;
  abv_max: number | null;
  ibu_min: number | null;
  ibu_max: number | null;
  ebc_min: number | null;
  ebc_max: number | null;
  notes?: string;
}

interface RecipeStateData extends Recipe {
  baseStyle?: string;
}

export function useRecipeBuilderState() {
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState<'list' | 'builder'>('list');
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [beverageType, setBeverageType] = useState<BeverageType>('Beer');
  const [recipeName, setRecipeName] = useState('');
  const [batchSizeLiters, setBatchSizeLiters] = useState<number>(20);
  const [targetStyle, setTargetStyle] = useState<string>('Standard');
  const [targetFg, setTargetFg] = useState<number>(1.010);
  const [targetAutoAbv, setTargetAutoAbv] = useState<number>(5.0);

  const [wizardStyle, setWizardStyle] = useState<string>('traditional');
  const [wizardSweetness, setWizardSweetness] = useState<string>(SWEETNESS_LEVELS[2].id);
  const [wizardHoney, setWizardHoney] = useState<string>('');

  const [bjcpStyles, setBjcpStyles] = useState<BjcpStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');

  const [globalCatalog, setGlobalCatalog] = useState<IngredientUnion[]>([]);

  const [activeIngredientCategory, setActiveIngredientCategory] = useState<IngredientCategory | null>(null);
  const [modalInitialQuery, setModalInitialQuery] = useState<string>('');
  const [modalInitialAdditiveType, setModalInitialAdditiveType] = useState<string>('');

  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientEntry[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStepEntry[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchCatalogAndStyles = async () => {
    try {
      const { data: ingData } = await supabase.from('ingredients').select('*');
      if (ingData) {
        const formattedCatalog = (ingData as IngredientRow[]).map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          form: item.form,
          alphaAcidPct: item.alpha_acid_pct,
          alphaAcidPctMin: item.alpha_acid_pct_min,
          alcoholTolerancePct: item.alcohol_tolerance_pct,
          alcoholTolerancePctMin: item.alcohol_tolerance_pct_min,
          tempMinC: item.temp_min_c,
          tempMaxC: item.temp_max_c,
          attenuationPct: item.attenuation_pct,
          attenuationPctMin: item.attenuation_pct_min,
          notes: item.notes,
          origin: item.origin,
          producer: item.producer,
          yieldPpg: item.yield_ppg ?? 36,
          colorEbc: item.color_ebc ?? 5,
          moistureContentPct: item.moisture_content_pct,
          nitrogenDemand: item.nitrogen_demand,
          additiveType: item.additive_type,
          nutrientRole: item.nutrient_role,
          dosagePerGramYeast: item.dosage_per_gram_yeast,
          dosagePer10Liters: item.dosage_per_10_liters,
          calciumPpm: item.calcium_ppm,
          magnesiumPpm: item.magnesium_ppm,
          sodiumPpm: item.sodium_ppm,
          sulfatePpm: item.sulfate_ppm,
          chloridePpm: item.chloride_ppm,
          bicarbonatePpm: item.bicarbonate_ppm
        })) as unknown as IngredientUnion[];
        setGlobalCatalog(formattedCatalog);
      }

      const { data: styleData } = await supabase.from('styles').select('*');
      if (styleData) {
        const formattedStyles = (styleData as StyleRow[]).map(item => ({
          style_id: item.style_id,
          name: item.name,
          category: item.category,
          beverage_type: item.beverage_type,
          ogMin: item.og_min,
          ogMax: item.og_max,
          fgMin: item.fg_min,
          fgMax: item.fg_max,
          abvMin: item.abv_min,
          abvMax: item.abv_max,
          ibuMin: item.ibu_min,
          ibuMax: item.ibu_max,
          ebcMin: item.ebc_min,
          ebcMax: item.ebc_max,
          notes: item.notes
        })) as BjcpStyle[];
        setBjcpStyles(formattedStyles);
      }
    } catch {
      setGlobalCatalog([]);
      setBjcpStyles([]);
    }
  };

  useEffect(() => {
    fetchCatalogAndStyles();
  }, []);

  useEffect(() => {
    if (location.state && location.state.editRecipe) {
      const r = location.state.editRecipe as RecipeStateData;
      setRecipeName(r.name);
      setBeverageType(r.beverageType || 'Mead');
      setBatchSizeLiters(r.expectedBatchSizeLiters);
      setTargetStyle(r.targetStyle || 'Standard');
      setTargetFg(r.targetFinalGravity || 1.000);

      if (r.baseStyle) {
        setWizardStyle(r.baseStyle);
      }

      const matchedSweetness = SWEETNESS_LEVELS.find(lvl => Math.abs(lvl.minFg - (r.targetFinalGravity || 1.000)) < 0.005);
      if (matchedSweetness) setWizardSweetness(matchedSweetness.id);

      const matchedStyle = bjcpStyles.find(s => s.name === r.targetStyle);
      if (matchedStyle) setSelectedStyleId(matchedStyle.style_id);

      const mappedIngredients = r.ingredients.map(ing => {
        return {
          id: ing.id,
          globalIngredientId: ing.globalIngredientId ?? null,
          name: ing.name,
          category: ing.category as IngredientCategory,
          quantity: ing.quantity,
          note: ing.note || '',
          showNote: !!ing.note,
          form: ing.form,
          origin: ing.origin,
          producer: ing.producer,
          description: ing.description,
          boilTimeMinutes: ing.boilTimeMinutes,
          yieldPpg: ing.yieldPpg,
          colorEbc: ing.colorEbc,
          moistureContentPct: ing.moistureContentPct,
          diastaticPowerLintner: ing.diastaticPowerLintner,
          sugarContentBrix: ing.sugarContentBrix,
          alphaAcidPct: ing.alphaAcidPct,
          alphaAcidPctMin: (ing as { alphaAcidPctMin?: number }).alphaAcidPctMin,
          alcoholTolerancePct: ing.alcoholTolerancePct,
          alcoholTolerancePctMin: (ing as { alcoholTolerancePctMin?: number }).alcoholTolerancePctMin,
          attenuationPct: ing.attenuationPct,
          attenuationPctMin: (ing as { attenuationPctMin?: number }).attenuationPctMin,
          tempMinC: ing.tempMinC,
          tempMaxC: ing.tempMaxC,
          nitrogenDemand: ing.nitrogenDemand,
          additiveType: ing.additiveType as AdditiveType,
          nutrientRole: ing.nutrientRole,
          additionStage: ing.additionStage,
          yanValuePerGramPerLiter: ing.yanValuePerGramPerLiter,
          dosagePerGramYeast: ing.dosagePerGramYeast,
          dosagePer10Liters: ing.dosagePer10Liters,
          calciumPpm: ing.calciumPpm,
          magnesiumPpm: ing.magnesiumPpm,
          sodiumPpm: ing.sodiumPpm,
          sulfatePpm: ing.sulfatePpm,
          chloridePpm: ing.chloridePpm,
          bicarbonatePpm: ing.bicarbonatePpm
        } as RecipeIngredientEntry;
      });
      setRecipeIngredients(mappedIngredients);

      const mappedSteps = r.steps.map(step => ({
        ...step,
        isExpanded: false
      }));
      setRecipeSteps(mappedSteps);

      setEditingRecipeId(r.id);
      setView('builder');

      navigate(location.pathname, { replace: true });
    }
      
  }, [location.state, navigate, location.pathname, bjcpStyles]);

  const resetForm = () => {
    setRecipeName('');
    setBeverageType('Beer');
    setBatchSizeLiters(20);
    setTargetStyle('Standard');
    setTargetFg(1.010);
    setSelectedStyleId('');
    setRecipeIngredients([]);
    setRecipeSteps([]);
    setEditingRecipeId(null);
  };

  const handleCancel = () => {
    resetForm();
    setView('list');
  };

  const openIngredientModal = (category: IngredientCategory, search: string = '', additiveType: string = '') => {
    setModalInitialQuery(search);
    setModalInitialAdditiveType(additiveType);
    setActiveIngredientCategory(category);
  };

  const handleRemoveIngredient = (id: string, onRemoved?: (id: string) => void) => {
    if (!id) return;
    setRecipeIngredients(prev => prev.filter(item => item.id !== id));
    onRemoved?.(id);
  };

  const updateIngredient = (id: string, updates: Partial<RecipeIngredientEntry>) => {
    if (!id) return;
    setRecipeIngredients(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleAddStep = (phase: RecipeStepEntry['phase'] = 'Preparation') => {
    setRecipeSteps(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        stepNumber: prev.length + 1,
        phase,
        title: '',
        description: '',
        durationValue: 0,
        durationUnit: phase === 'Preparation' ? 'minutes' : 'days',
        targetTempC: null,
        isExpanded: true
      }
    ]);
  };

  const handleRemoveStep = (id: string) => {
    if (!id) return;
    setRecipeSteps(prev => {
      const filtered = prev.filter(step => step.id !== id);
      return filtered.map((step, index) => ({ ...step, stepNumber: index + 1 }));
    });
  };

  const updateStep = (id: string, updates: Partial<RecipeStepEntry>) => {
    if (!id) return;
    setRecipeSteps(prev => prev.map(step => step.id === id ? { ...step, ...updates } : step));
  };

  return {
    view, setView,
    editingRecipeId, setEditingRecipeId,
    beverageType, setBeverageType,
    recipeName, setRecipeName,
    batchSizeLiters, setBatchSizeLiters,
    targetStyle, setTargetStyle,
    targetFg, setTargetFg,
    targetAutoAbv, setTargetAutoAbv,
    wizardStyle, setWizardStyle,
    wizardSweetness, setWizardSweetness,
    wizardHoney, setWizardHoney,
    bjcpStyles,
    selectedStyleId, setSelectedStyleId,
    globalCatalog, setGlobalCatalog,
    activeIngredientCategory, setActiveIngredientCategory,
    modalInitialQuery,
    modalInitialAdditiveType,
    openIngredientModal,
    isStyleModalOpen, setIsStyleModalOpen,
    recipeIngredients, setRecipeIngredients,
    recipeSteps, setRecipeSteps,
    updateIngredient,
    handleRemoveIngredient,
    handleAddStep,
    handleRemoveStep,
    updateStep,
    isSaving, setIsSaving,
    resetForm,
    handleCancel
  };
}