// src/pages/Recipes.tsx
import { calculateAbvCrouch, calculateIbuTinseth, calculateMcu, calculateTosna, estimateOG, estimateSrmMorey, srmToEbc } from '@mead-tracker/math';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaChevronDown, FaChevronUp, FaExclamationTriangle, FaInfoCircle, FaMagic, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { IngredientEditorModal, type EditedIngredientData, type NutrientRole } from '../components/IngredientEditorModal';
import { StyleSearchModal } from '../components/StyleSearchModal';
import { app } from '../firebase/config';
import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { supabase } from '../supabase/client';
import type { AdditiveType, BaseIngredient, IngredientCategory } from '../types/ingredient';
import type { BeverageType, Recipe, StepPhase, TimeUnit } from '../types/recipe';
import { getSuggestedIngredients, validateStyleBounds, type BjcpStyle } from '../utils/bjcpMatchEngine';
import { HONEY_TERROIR, MEAD_STYLES, SWEETNESS_LEVELS } from '../utils/meadConstants';

interface RecipeIngredientEntry {
  id: string;
  globalIngredientId: string | null;
  name: string;
  category: IngredientCategory;
  quantity: number;
  note: string;
  showNote: boolean;

  form?: string;
  origin?: string;
  producer?: string;
  description?: string;

  yieldPpg?: number;
  colorEbc?: number;
  moistureContentPct?: number;
  diastaticPowerLintner?: number;

  sugarContentBrix?: number;

  alphaAcidPct?: number;
  alphaAcidPctMin?: number;
  boilTimeMinutes?: number;

  alcoholTolerancePct?: number;
  alcoholTolerancePctMin?: number;
  attenuationPct?: number;
  attenuationPctMin?: number;
  tempMinC?: number;
  tempMaxC?: number;
  nitrogenDemand?: 'Low' | 'Medium' | 'High' | 'Very High';

  additiveType?: AdditiveType;
  nutrientRole?: NutrientRole;
  yanValuePerGramPerLiter?: number;
  dosagePerGramYeast?: number;
  dosagePer10Liters?: number;
  calciumPpm?: number;
  magnesiumPpm?: number;
  sodiumPpm?: number;
  sulfatePpm?: number;
  chloridePpm?: number;
  bicarbonatePpm?: number;

  additionStage?: string;
}

interface RecipeStepEntry {
  id: string;
  stepNumber: number;
  phase: StepPhase;
  title: string;
  description: string;
  durationValue: number;
  durationUnit: TimeUnit;
  targetTempC: number | null;
  isExpanded: boolean;
}

interface AiIngredientProposal {
  ingredientId: string;
  suggestedQuantityGrams: number;
  aiNote: string;
}

const VALID_PHASES: StepPhase[] = ['Preparation', 'Mashing', 'Boiling', 'Fermentation', 'Aging', 'Packaging'];
const VALID_UNITS: TimeUnit[] = ['minutes', 'days'];

const Recipes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeBrewery } = useBreweryStore();
  const { recipes, fetchRecipes, saveRecipe, updateRecipe, isLoading: isRecipesLoading } = useRecipeStore();

  const [view, setView] = useState<'list' | 'builder'>('list');
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [beverageType, setBeverageType] = useState<BeverageType>('Beer');
  const [recipeName, setRecipeName] = useState('');
  const [batchSizeLiters, setBatchSizeLiters] = useState<number>(20);
  const [targetStyle, setTargetStyle] = useState<string>('Standard');
  const [targetFg, setTargetFg] = useState<number>(1.010);
  const [targetAutoAbv, setTargetAutoAbv] = useState<number>(5.0);

  const [wizardStyle, setWizardStyle] = useState<string>(MEAD_STYLES[0].id);
  const [wizardSweetness, setWizardSweetness] = useState<string>(SWEETNESS_LEVELS[2].id);
  const [wizardHoney, setWizardHoney] = useState<string>(HONEY_TERROIR[4].id);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [bjcpStyles, setBjcpStyles] = useState<BjcpStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');

  const [globalCatalog, setGlobalCatalog] = useState<BaseIngredient[]>([]);

  const [activeIngredientCategory, setActiveIngredientCategory] = useState<IngredientCategory | null>(null);
  const [modalInitialQuery, setModalInitialQuery] = useState<string>('');
  const [modalInitialAdditiveType, setModalInitialAdditiveType] = useState<string>('');

  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientEntry[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStepEntry[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [aiProposedIngredients, setAiProposedIngredients] = useState<AiIngredientProposal[]>([]);
  const [aiProposedSteps, setAiProposedSteps] = useState<RecipeStepEntry[]>([]);

  const fetchCatalogAndStyles = async () => {
    try {
      const { data: ingData } = await supabase.from('ingredients').select('*');
      if (ingData) {
        const formattedCatalog = ingData.map(item => ({
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
        })) as BaseIngredient[];
        setGlobalCatalog(formattedCatalog);
      }

      const { data: styleData } = await supabase.from('styles').select('*');
      if (styleData) {
        const formattedStyles = styleData.map(item => ({
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
    if (activeBrewery?.id) {
      fetchRecipes(activeBrewery.id);
    }
  }, [activeBrewery?.id, fetchRecipes]);

  useEffect(() => {
    if (location.state && location.state.editRecipe) {
      const r = location.state.editRecipe as Recipe;
      setRecipeName(r.name);
      setBeverageType(r.beverageType || 'Mead');
      setBatchSizeLiters(r.expectedBatchSizeLiters);
      setTargetStyle(r.targetStyle || 'Standard');
      setTargetFg(r.targetFinalGravity || 1.000);

      const rAny = r as any;
      if (rAny.baseStyle) {
        setWizardStyle(rAny.baseStyle);
      }

      const matchedSweetness = SWEETNESS_LEVELS.find(lvl => Math.abs(lvl.minFg - (r.targetFinalGravity || 1.000)) < 0.005);
      if (matchedSweetness) setWizardSweetness(matchedSweetness.id);

      const matchedStyle = bjcpStyles.find(s => s.name === r.targetStyle);
      if (matchedStyle) setSelectedStyleId(matchedStyle.style_id);

      const mappedIngredients = r.ingredients.map(ing => {
        const ingAny = ing as any;
        return {
          id: ing.id,
          globalIngredientId: ingAny.globalIngredientId ?? null,
          name: ing.name,
          category: ing.category,
          quantity: ing.quantity,
          note: ing.note || '',
          showNote: !!ing.note,
          form: ingAny.form,
          origin: ingAny.origin,
          producer: ingAny.producer,
          description: ingAny.description,
          boilTimeMinutes: ingAny.boilTimeMinutes,
          yieldPpg: ingAny.yieldPpg,
          colorEbc: ingAny.colorEbc,
          moistureContentPct: ingAny.moistureContentPct,
          diastaticPowerLintner: ingAny.diastaticPowerLintner,
          sugarContentBrix: ingAny.sugarContentBrix,
          alphaAcidPct: ingAny.alphaAcidPct,
          alphaAcidPctMin: ingAny.alphaAcidPctMin,
          alcoholTolerancePct: ingAny.alcoholTolerancePct,
          alcoholTolerancePctMin: ingAny.alcoholTolerancePctMin,
          attenuationPct: ingAny.attenuationPct,
          attenuationPctMin: ingAny.attenuationPctMin,
          tempMinC: ingAny.tempMinC,
          tempMaxC: ingAny.tempMaxC,
          nitrogenDemand: ingAny.nitrogenDemand,
          additiveType: ingAny.additiveType,
          nutrientRole: ingAny.nutrientRole,
          additionStage: ingAny.additionStage,
          yanValuePerGramPerLiter: ingAny.yanValuePerGramPerLiter,
          dosagePerGramYeast: ingAny.dosagePerGramYeast,
          dosagePer10Liters: ingAny.dosagePer10Liters,
          calciumPpm: ingAny.calciumPpm,
          magnesiumPpm: ingAny.magnesiumPpm,
          sodiumPpm: ingAny.sodiumPpm,
          sulfatePpm: ingAny.sulfatePpm,
          chloridePpm: ingAny.chloridePpm,
          bicarbonatePpm: ingAny.bicarbonatePpm
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
    setAiProposedIngredients([]);
    setAiProposedSteps([]);
  };

  const handleCancel = () => {
    resetForm();
    setView('list');
  };

  const currentSelectedStyle = useMemo(() => {
    return bjcpStyles.find(s => s.style_id === selectedStyleId) || null;
  }, [selectedStyleId, bjcpStyles]);

  const openIngredientModal = (category: IngredientCategory, search: string = '', additiveType: string = '') => {
    setModalInitialQuery(search);
    setModalInitialAdditiveType(additiveType);
    setActiveIngredientCategory(category);
  };

  const handleSaveIngredientFromModal = (data: EditedIngredientData) => {
    setRecipeIngredients(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ...data,
        showNote: !!data.note
      }
    ]);
    setActiveIngredientCategory(null);
  };

  const handleRemoveIngredient = (id: string) => {
    if (!id) return;
    setRecipeIngredients(prev => prev.filter(item => item.id !== id));
    setAiProposedIngredients(prev => prev.filter(p => p.ingredientId !== id));
  };

  const updateIngredient = (id: string, updates: Partial<RecipeIngredientEntry>) => {
    if (!id) return;
    setRecipeIngredients(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleAddStep = (phase: StepPhase = 'Preparation') => {
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

  const handleAutoCalculateHoney = () => {
    const fermentableItems = recipeIngredients.filter(i => i.category === 'Fermentable' || i.category === 'Honey');
    if (fermentableItems.length === 0) return;

    const targetEntry = fermentableItems[0];

    let minGrams = 100;
    let maxGrams = 25000;
    let bestGrams = 1000;
    let iterations = 0;

    while (minGrams <= maxGrams && iterations < 50) {
      const midGrams = Math.floor((minGrams + maxGrams) / 2);

      let totalGramsForCalc = 0;
      let totalWeightedYield = 0;

      recipeIngredients.forEach(ing => {
        if (ing.category === 'Fermentable' || ing.category === 'Honey') {
          const qty = ing.id === targetEntry.id ? midGrams : ing.quantity;
          const yld = ing.yieldPpg || 36;
          totalGramsForCalc += qty;
          totalWeightedYield += (yld * qty);
        }
      });

      const avgYield = totalGramsForCalc > 0 ? totalWeightedYield / totalGramsForCalc : 36;
      const testOG = estimateOG(batchSizeLiters, totalGramsForCalc, avgYield);
      const testABV = calculateAbvCrouch(testOG, targetFg);

      if (Math.abs(testABV - targetAutoAbv) < 0.05) {
        bestGrams = midGrams;
        break;
      }

      if (testABV < targetAutoAbv) {
        minGrams = midGrams + 1;
      } else {
        maxGrams = midGrams - 1;
      }
      bestGrams = midGrams;
      iterations++;
    }

    const roundedGrams = Math.round(bestGrams / 10) * 10;
    updateIngredient(targetEntry.id, { quantity: roundedGrams });
  };

  const handleAiGeneration = async () => {
    if (!app) return;
    setIsGenerating(true);

    try {
      const payload = {
        beverageType,
        style: beverageType === 'Mead' ? wizardStyle : selectedStyleId,
        sweetness: wizardSweetness,
        honeyTerroir: wizardHoney,
        targetAbv: targetAutoAbv,
        batchSizeLiters,
        targetFg,
        locale: i18n.resolvedLanguage || i18n.language || 'en',
        ingredients: recipeIngredients.map(i => ({
          ingredientId: i.id,
          globalIngredientId: i.globalIngredientId,
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          nutrientRole: i.nutrientRole, 
          additiveType: i.additiveType  
        }))
      };

      const functions = getFunctions(app, 'europe-west1');
      const generateRecipeAI = httpsCallable(functions, 'generateRecipeAI');
      const response = await generateRecipeAI(payload);
      const resultData = response.data as any;

      if (resultData?.status === 'success' && resultData?.data) {
        const aiData = resultData.data;

        if (Array.isArray(aiData.steps)) {
          const newSteps = aiData.steps.map((s: any, idx: number) => {
            const safePhase = VALID_PHASES.includes(s.phase) ? s.phase : 'Preparation';
            const safeUnit = VALID_UNITS.includes(s.durationUnit) ? s.durationUnit : 'minutes';

            return {
              id: crypto.randomUUID(),
              stepNumber: idx + 1,
              phase: safePhase as StepPhase,
              title: s.title || '',
              description: s.description || '',
              durationValue: s.durationValue || 0,
              durationUnit: safeUnit as TimeUnit,
              targetTempC: typeof s.targetTempC === 'number' ? s.targetTempC : null,
              isExpanded: true
            };
          });
          setAiProposedSteps(newSteps);
        }

        if (Array.isArray(aiData.ingredientQuantities)) {
          const validProposals: AiIngredientProposal[] = [];
          for (const suggestion of aiData.ingredientQuantities) {
            if (suggestion && suggestion.ingredientId && typeof suggestion.suggestedQuantityGrams === 'number') {
              validProposals.push({
                ingredientId: suggestion.ingredientId,
                suggestedQuantityGrams: suggestion.suggestedQuantityGrams,
                aiNote: suggestion.aiNote || ''
              });
            }
          }
          setAiProposedIngredients(validProposals);
        }
      }
    } catch {
      setAiProposedSteps([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const acceptIngredientProposal = (proposal: AiIngredientProposal) => {
    setRecipeIngredients(prev => prev.map(item => {
      if (item.id === proposal.ingredientId) {
        return {
          ...item,
          quantity: proposal.suggestedQuantityGrams,
          note: proposal.aiNote || item.note,
          showNote: !!proposal.aiNote || item.showNote
        };
      }
      return item;
    }));
    setAiProposedIngredients(prev => prev.filter(p => p.ingredientId !== proposal.ingredientId));
  };

  const rejectIngredientProposal = (ingredientId: string) => {
    setAiProposedIngredients(prev => prev.filter(p => p.ingredientId !== ingredientId));
  };

  const acceptAllProposedSteps = () => {
    setRecipeSteps(aiProposedSteps.map(s => ({ ...s, isExpanded: false })));
    setAiProposedSteps([]);
  };

  const rejectAllProposedSteps = () => {
    setAiProposedSteps([]);
  };

  const recipeDetails = useMemo(() => {
    let totalFermentableGrams = 0;
    let averageYield = 0;
    let totalMcu = 0;
    let totalIbu = 0;

    let yeastAddedGrams = 0;
    let yeastNitrogenDemand: RecipeIngredientEntry['nitrogenDemand'] = 'Medium';

    let totalWeightedYield = 0;
    let customNutrientName = '';
    const dynamicAdditives: Array<{ id: string; name: string; totalGrams: number; rule: string }> = [];

    recipeIngredients.forEach(item => {
      if (item.category === 'Fermentable' || item.category === 'Honey') {
        const yieldVal = item.yieldPpg || 36;
        const colorVal = item.colorEbc || 5;
        const qty = item.quantity || 0;

        totalFermentableGrams += qty;
        totalWeightedYield += (yieldVal * qty);

        if (item.category === 'Fermentable' && beverageType === 'Beer' && batchSizeLiters > 0) {
          totalMcu += calculateMcu(qty / 1000, colorVal, batchSizeLiters);
        }
      } else if (item.category === 'Yeast') {
        yeastAddedGrams += item.quantity || 0;
        if (item.nitrogenDemand) yeastNitrogenDemand = item.nitrogenDemand;
      }
    });

    if (totalFermentableGrams > 0) {
      averageYield = totalWeightedYield / totalFermentableGrams;
    }

    const estimatedOg = estimateOG(batchSizeLiters, totalFermentableGrams, averageYield);
    const estimatedAbv = calculateAbvCrouch(estimatedOg, targetFg);
    const estimatedEbc = beverageType === 'Beer' ? srmToEbc(estimateSrmMorey(totalMcu)) : 0;

    recipeIngredients.forEach(item => {
      if (item.category === 'Hops' && beverageType === 'Beer' && batchSizeLiters > 0) {
        const boilTime = item.boilTimeMinutes || 0;
        const alpha = item.alphaAcidPct || 5;
        totalIbu += calculateIbuTinseth(alpha, item.quantity, boilTime, batchSizeLiters, estimatedOg);
      }
    });

    let tosnaData = null;
    if (beverageType === 'Mead' && yeastAddedGrams > 0 && estimatedOg > 1.000) {
      let nFactor = 0.90;
      if (yeastNitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeastNitrogenDemand === 'High' || yeastNitrogenDemand === 'Very High') nFactor = 1.25;
      tosnaData = calculateTosna(batchSizeLiters, estimatedOg, nFactor);
    }

    recipeIngredients.forEach(item => {
      if (item.category !== 'Additive') return;

      let calculatedGrams = 0;
      let ruleApplied = '';

      if (item.additiveType === 'Nutrient' && tosnaData) {
        // Умное распределение на основе роли нутриента
        if (item.nutrientRole === 'Rehydration' || (!item.nutrientRole && item.name.toLowerCase().includes('go-ferm'))) {
          calculatedGrams = tosnaData.goFermGrams;
          ruleApplied = 'TOSNA 3.0: Rehydration';
        } else if (item.nutrientRole === 'Fermentation' || !item.nutrientRole) {
          calculatedGrams = tosnaData.totalFermaidOGrams;
          ruleApplied = 'TOSNA 3.0: Total Fermentation Nutrient';
          if (!customNutrientName) customNutrientName = item.name;
        }
      }
      else if (item.dosagePerGramYeast && yeastAddedGrams > 0) {
        calculatedGrams = yeastAddedGrams * item.dosagePerGramYeast;
        ruleApplied = `${item.dosagePerGramYeast}g / 1g Yeast`;
      } else if (item.dosagePer10Liters && batchSizeLiters > 0) {
        calculatedGrams = (batchSizeLiters / 10) * item.dosagePer10Liters;
        ruleApplied = `${item.dosagePer10Liters}g / 10L`;
        if (item.additiveType === 'Nutrient' && !customNutrientName) {
          customNutrientName = item.name;
        }
      }

      if (calculatedGrams > 0) {
        dynamicAdditives.push({
          id: item.id,
          name: item.name,
          totalGrams: calculatedGrams,
          rule: ruleApplied
        });
      }
    });

    return {
      og: estimatedOg,
      abv: estimatedAbv,
      ibu: totalIbu,
      ebc: estimatedEbc,
      tosna: tosnaData,
      yeastAdded: yeastAddedGrams,
      customNutrientName: customNutrientName || 'Fermaid-O',
      dynamicAdditives
    };
  }, [recipeIngredients, batchSizeLiters, targetFg, beverageType]);

  const validation = useMemo(() => {
    return validateStyleBounds(currentSelectedStyle, recipeDetails.og, targetFg, recipeDetails.abv, recipeDetails.ibu, recipeDetails.ebc);
  }, [currentSelectedStyle, recipeDetails, targetFg]);

  const suggestions = useMemo(() => {
    return getSuggestedIngredients(currentSelectedStyle, globalCatalog);
  }, [currentSelectedStyle, globalCatalog]);

  const isAbvMismatch = useMemo(() => {
    if (beverageType !== 'Mead') return false;
    if (targetStyle === 'Session (4-6%)' && recipeDetails.abv > 6.5) return true;
    if (targetStyle === 'Standard (7-10%)' && (recipeDetails.abv < 6.5 || recipeDetails.abv > 10.5)) return true;
    if (targetStyle === 'Wine/Sack (11%+)' && recipeDetails.abv < 10.5) return true;
    return false;
  }, [targetStyle, recipeDetails.abv, beverageType]);

  const meadYeastToleranceRange = useMemo((): { min: number; max: number } | null => {
    if (targetStyle === 'Session (4-6%)') return { min: 0, max: 9 };
    if (targetStyle === 'Standard (7-10%)') return { min: 9, max: 14 };
    if (targetStyle === 'Wine/Sack (11%+)') return { min: 13, max: 99 };
    return null;
  }, [targetStyle]);

  const meadYeastSuggestions = useMemo(() => {
    if (beverageType !== 'Mead' || !meadYeastToleranceRange) return [];
    return globalCatalog.filter(ing => {
      if (ing.category !== 'Yeast') return false;
      const tolerance = (ing as any).alcoholTolerancePct;
      return typeof tolerance === 'number' && tolerance >= meadYeastToleranceRange.min && tolerance <= meadYeastToleranceRange.max;
    }).slice(0, 5);
  }, [beverageType, meadYeastToleranceRange, globalCatalog]);

  const meadIngredientHint = useMemo((): { category: IngredientCategory; additiveType?: AdditiveType; label: string } | null => {
    if (beverageType !== 'Mead') return null;
    switch (wizardStyle) {
      case 'traditional':
        return { category: 'Honey', label: t('Honey') };
      case 'melomel':
        return { category: 'Additive', additiveType: 'Fruit', label: t('constants.additive_types.fruit', 'Fruit') };
      case 'metheglin':
        return { category: 'Additive', additiveType: 'Spice', label: t('constants.additive_types.spice', 'Spice') };
      case 'session_hopped':
      case 'braggot':
        return { category: 'Hops', label: t('Hops') };
      default:
        return null;
    }
  }, [beverageType, wizardStyle, t]);

  const handleSaveRecipe = async () => {
    if (!activeBrewery?.id || !recipeName || recipeIngredients.length === 0) return;

    setIsSaving(true);
    try {
      const cleanIngredients = recipeIngredients.map(item => ({
        id: item.id,
        globalIngredientId: item.globalIngredientId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        note: item.note,
        form: item.form,
        origin: item.origin,
        producer: item.producer,
        description: item.description,
        boilTimeMinutes: item.boilTimeMinutes,
        yieldPpg: item.yieldPpg,
        colorEbc: item.colorEbc,
        moistureContentPct: item.moistureContentPct,
        diastaticPowerLintner: item.diastaticPowerLintner,
        sugarContentBrix: item.sugarContentBrix,
        alphaAcidPct: item.alphaAcidPct,
        alphaAcidPctMin: item.alphaAcidPctMin,
        alcoholTolerancePct: item.alcoholTolerancePct,
        alcoholTolerancePctMin: item.alcoholTolerancePctMin,
        attenuationPct: item.attenuationPct,
        attenuationPctMin: item.attenuationPctMin,
        tempMinC: item.tempMinC,
        tempMaxC: item.tempMaxC,
        nitrogenDemand: item.nitrogenDemand,
        additiveType: item.additiveType,
        nutrientRole: item.nutrientRole,
        additionStage: item.additionStage,
        yanValuePerGramPerLiter: item.yanValuePerGramPerLiter,
        dosagePerGramYeast: item.dosagePerGramYeast,
        dosagePer10Liters: item.dosagePer10Liters,
        calciumPpm: item.calciumPpm,
        magnesiumPpm: item.magnesiumPpm,
        sodiumPpm: item.sodiumPpm,
        sulfatePpm: item.sulfatePpm,
        chloridePpm: item.chloridePpm,
        bicarbonatePpm: item.bicarbonatePpm
      }));

      const cleanSteps = recipeSteps.map(step => ({
        id: step.id,
        stepNumber: step.stepNumber,
        phase: step.phase,
        title: step.title,
        description: step.description,
        durationValue: step.durationValue,
        durationUnit: step.durationUnit,
        targetTempC: step.targetTempC
      }));

      const recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> = {
        breweryId: activeBrewery.id,
        name: recipeName,
        beverageType,
        targetStyle: beverageType === 'Beer' && currentSelectedStyle ? currentSelectedStyle.name : targetStyle,
        expectedBatchSizeLiters: batchSizeLiters,
        targetOriginalGravity: recipeDetails.og,
        targetFinalGravity: targetFg,
        targetAbv: recipeDetails.abv,
        targetIbu: beverageType === 'Beer' ? recipeDetails.ibu : undefined,
        targetColorEbc: beverageType === 'Beer' ? recipeDetails.ebc : undefined,
        ingredients: cleanIngredients as any,
        steps: cleanSteps,
        createdBy: 'user'
      };

      if (editingRecipeId) {
        await updateRecipe(editingRecipeId, recipeData);
      } else {
        await saveRecipe(recipeData);
      }
      resetForm();
      setView('list');
    } catch {
      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  };

  const renderIngredientGroup = (category: IngredientCategory, title: string) => {
    const items = recipeIngredients.filter(i =>
      category === 'Additive' ? (i.category === 'Additive' || i.category === 'Water Profile') : i.category === category
    );

    return (
      <div className="ingredient-group">
        <div className="ingredient-group__header">
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
            {title}{items.length > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}> ({items.length})</span>}
          </h3>
          <button type="button" className="recipe-lab__btn-secondary" style={{ padding: '4px 12px', fontSize: '0.85rem' }} onClick={() => openIngredientModal(category)}>
            <FaPlus /> {t('Add')}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="ingredient-group__empty" style={{ fontStyle: 'italic', color: 'var(--text-disabled)', fontSize: '0.9rem', padding: '0.5rem 0' }}>{t('Not added yet')}</div>
        ) : (
          <div className="ingredient-list" style={{ marginTop: '0.5rem' }}>
            {items.map(item => {
              const aiProposal = aiProposedIngredients.find(p => p.ingredientId === item.id);
              
              const formatRange = (min: number | undefined, max: number | undefined) => {
                return min && min !== max ? `${min}-${max}` : `${max}`;
              };

              return (
                <div key={item.id} className="recipe-ingredient">
                  <div className="recipe-ingredient__main">
                    <div className="recipe-ingredient__info" style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="recipe-ingredient__name">{item.name}</span>
                      <span className="recipe-ingredient__meta" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {item.category === 'Hops' && `${t('Alpha')}: ${formatRange(item.alphaAcidPctMin, item.alphaAcidPct)}%`}
                        {item.category === 'Fermentable' && `${t('Yield')}: ${item.yieldPpg ?? 0} PPG | ${t('Color')}: ${item.colorEbc ?? 0} EBC`}
                        {item.category === 'Honey' && `${t('Sugar Content')}: ${item.sugarContentBrix ?? 0} Brix | ${t('Moisture')}: ${item.moistureContentPct ?? 0}%`}
                        {item.category === 'Yeast' && `${t('Tolerance')}: ${formatRange(item.alcoholTolerancePctMin, item.alcoholTolerancePct)}% | ${t('Attenuation')}: ${formatRange(item.attenuationPctMin, item.attenuationPct)}%`}
                        {(item.category === 'Additive' || item.category === 'Water Profile') && [
                          item.additiveType ? t(`constants.additive_types.${item.additiveType.toLowerCase()}`) : '',
                          item.nutrientRole ? t(`constants.nutrient_roles.${item.nutrientRole.toLowerCase()}`) : '',
                          item.additionStage
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="recipe-ingredient__controls">
                      <button
                        type="button"
                        className="recipe-ingredient__btn-note"
                        onClick={() => updateIngredient(item.id, { showNote: !item.showNote })}
                        disabled={isSaving}
                      >
                        {item.showNote ? t('- Note') : t('+ Note')}
                      </button>

                      {beverageType === 'Beer' && item.category === 'Hops' && (
                         <div className="recipe-ingredient__hop-boil">
                            <input
                              className="form-field__input form-field__input--small"
                              type="number"
                              min="0"
                              value={item.boilTimeMinutes === 0 ? '' : item.boilTimeMinutes}
                              onChange={(e) => updateIngredient(item.id, { boilTimeMinutes: parseFloat(e.target.value) || 0 })}
                              placeholder={t('min')}
                              disabled={isSaving}
                            />
                            <span className="recipe-ingredient__unit">{t('min')}</span>
                         </div>
                      )}

                      <input
                        className="form-field__input form-field__input--small"
                        type="number"
                        min="0"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => updateIngredient(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        disabled={isSaving}
                      />
                      <span className="recipe-ingredient__unit">{t('g')}</span>
                      <button
                        type="button"
                        className="recipe-ingredient__btn-delete"
                        onClick={() => handleRemoveIngredient(item.id)}
                        disabled={isSaving}
                        aria-label={t('Remove')}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                  {item.showNote && (
                    <div className="recipe-ingredient__note">
                      <textarea
                        value={item.note}
                        onChange={(e) => updateIngredient(item.id, { note: e.target.value })}
                        placeholder={t('Add detailed notes for this ingredient...')}
                        className="form-field__textarea"
                        rows={2}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                  {aiProposal && (
                    <div className="ai-diff-box">
                      <h4><FaMagic /> {t('AI Proposed Adjustment')}</h4>
                      <div>
                        <strong>{t('Suggested Quantity')}:</strong> {aiProposal.suggestedQuantityGrams} {t('g')} <br />
                        {aiProposal.aiNote && <span><strong>{t('Note')}:</strong> {aiProposal.aiNote}</span>}
                      </div>
                      <div className="diff-actions">
                        <button type="button" className="btn-accept" onClick={() => acceptIngredientProposal(aiProposal)}>
                          <FaCheck /> {t('Accept')}
                        </button>
                        <button type="button" className="btn-reject" onClick={() => rejectIngredientProposal(item.id)}>
                          <FaTimes /> {t('Reject')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!activeBrewery) {
    return (
      <div className="recipe-lab">
        <div className="recipe-lab__empty-state">
          <p className="recipe-lab__empty-text">{t('Please select or create a brewery to manage recipes.')}</p>
        </div>
      </div>
    );
  }

  if (view === 'list') {
    return (
      <div className="recipe-lab">
        <header className="recipe-lab__header">
          <div className="recipe-lab__title-block">
            <h1 className="recipe-lab__title">{t('Recipes')}</h1>
          </div>
          <button type="button" className="recipe-lab__btn-primary" onClick={() => setView('builder')}>
            <FaPlus /> {t('Create Recipe')}
          </button>
        </header>

        {isRecipesLoading ? (
          <div className="recipe-lab__loading">{t('Loading recipes...')}</div>
        ) : recipes.length === 0 ? (
          <div className="recipe-lab__empty-state">
            <p className="recipe-lab__empty-text">{t('No recipes found. Create your first recipe!')}</p>
          </div>
        ) : (
          <ul className="recipe-list">
            {recipes.map(recipe => (
              <li
                key={recipe.id}
                className="recipe-card recipe-card--interactive"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/recipes/${recipe.id}`);
                  }
                }}
              >
                <div className="recipe-card__header">
                  <span className="recipe-card__badge">{t(`constants.beverage_types.${recipe.beverageType?.toLowerCase() || 'mead'}`, recipe.beverageType || 'Mead')}</span>
                  <h3 className="recipe-card__title">{recipe.name}</h3>
                </div>
                <div className="recipe-card__meta-stack">
                  <div className="recipe-card__meta-row">
                    <span className="recipe-card__style">{recipe.targetStyle}</span>
                    <span className="recipe-card__abv">{recipe.targetAbv?.toFixed(1)}% ABV</span>
                  </div>
                  <div className="recipe-card__meta-row">
                    <span>{t('Batch Size')}</span>
                    <span>{recipe.expectedBatchSizeLiters} {t('L')}</span>
                  </div>
                  <div className="recipe-card__meta-row">
                    <span>{t('Original Gravity')}</span>
                    <span>{recipe.targetOriginalGravity?.toFixed(3)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="recipe-lab">
      {activeIngredientCategory && (
        <IngredientEditorModal
          isOpen={true}
          onClose={() => setActiveIngredientCategory(null)}
          onSave={handleSaveIngredientFromModal}
          catalog={globalCatalog}
          category={activeIngredientCategory}
          initialQuery={modalInitialQuery}
          initialAdditiveType={modalInitialAdditiveType}
          onIngredientCreated={(newIng) => setGlobalCatalog(prev => [...prev, newIng as BaseIngredient])}
        />
      )}
      <StyleSearchModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        onSelect={(id) => { setSelectedStyleId(id); setIsStyleModalOpen(false); }}
        styles={bjcpStyles}
        beverageType={beverageType}
      />

      <header className="recipe-lab__header">
        <div className="recipe-lab__title-block">
          <h1 className="recipe-lab__title">{editingRecipeId ? t('Edit Recipe') : t('Recipe Builder')}</h1>
        </div>
        <button type="button" className="recipe-lab__btn-secondary" onClick={handleCancel}>
          {t('Cancel')}
        </button>
      </header>

      <div className="builder-layout">
        <main className="builder-main">

          <section className="builder-section">
            <div className="builder-section__header">
              <h2 className="builder-section__title">{t('Core Parameters')}</h2>
            </div>
            <div className="builder-section__body">
              <div className="form-field">
                <label className="form-field__label">{t('Beverage Type')}</label>
                <select className="form-field__select" value={beverageType} onChange={(e) => setBeverageType(e.target.value as BeverageType)}>
                  <option value="Beer">{t('constants.beverage_types.beer', 'Beer')}</option>
                  <option value="Mead">{t('constants.beverage_types.mead', 'Mead')}</option>
                  <option value="Cider">{t('constants.beverage_types.cider', 'Cider')}</option>
                </select>
              </div>

              {beverageType === 'Beer' && (
                <div className="form-field">
                  <label className="form-field__label">{t('BJCP Target Style')}</label>
                  <div className="form-field__fake-input" onClick={() => setIsStyleModalOpen(true)}>
                    {currentSelectedStyle ? `[${currentSelectedStyle.style_id}] ${currentSelectedStyle.name}` : t('Select target style...')}
                  </div>
                </div>
              )}

              <div className="form-field">
                <label className="form-field__label">{t('Recipe Name')}</label>
                <input
                  className="form-field__input"
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder={t('e.g. Traditional Wildflower Mead')}
                />
              </div>

              <div className="builder-row">
                {beverageType === 'Mead' && (
                  <div className="form-field builder-row__item">
                    <label className="form-field__label">{t('Target ABV Tier')}</label>
                    <select
                      className="form-field__select"
                      value={targetStyle}
                      onChange={(e) => setTargetStyle(e.target.value)}
                    >
                      <option value="Session (4-6%)">{t('Session (4-6%) - Light & Drinkable')}</option>
                      <option value="Standard (7-10%)">{t('Standard (7-10%) - Traditional')}</option>
                      <option value="Wine/Sack (11%+)">{t('Wine/Sack (11%+) - Strong & Sweet')}</option>
                      <option value="Custom">{t('Custom')}</option>
                    </select>
                  </div>
                )}
                <div className="form-field builder-row__item">
                  <label className="form-field__label">{t('Batch Size (Liters)')}</label>
                  <input
                    className="form-field__input"
                    type="number"
                    min="1"
                    value={batchSizeLiters || ''}
                    onChange={(e) => setBatchSizeLiters(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field builder-row__item">
                  <label className="form-field__label">{t('Target FG')}</label>
                  <input
                    className="form-field__input"
                    type="number"
                    step="0.001"
                    min="0.990"
                    max="1.150"
                    value={targetFg || ''}
                    onChange={(e) => setTargetFg(parseFloat(e.target.value) || 1.000)}
                  />
                </div>
              </div>
            </div>
          </section>

          {beverageType === 'Mead' && (
            <section className="builder-section">
              <div className="builder-section__header">
                <h2 className="builder-section__title"><FaMagic /> {t('Smart Recipe Wizard')}</h2>
              </div>
              <div className="builder-section__body">
                <div className="builder-row">
                  <div className="form-field builder-row__item">
                    <label className="form-field__label">{t('Base Style')}</label>
                    <select className="form-field__select" value={wizardStyle} onChange={e => setWizardStyle(e.target.value)}>
                      {MEAD_STYLES.map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
                    </select>
                  </div>
                  <div className="form-field builder-row__item">
                    <label className="form-field__label">{t('Sweetness / FG')}</label>
                    <select className="form-field__select" value={wizardSweetness} onChange={e => {
                      setWizardSweetness(e.target.value);
                      const selected = SWEETNESS_LEVELS.find(lvl => lvl.id === e.target.value);
                      if (selected) {
                        setTargetFg(selected.minFg);
                      }
                    }}>
                      {SWEETNESS_LEVELS.map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
                    </select>
                  </div>
                  <div className="form-field builder-row__item">
                    <label className="form-field__label">{t('Honey Terroir')}</label>
                    <select className="form-field__select" value={wizardHoney} onChange={e => setWizardHoney(e.target.value)}>
                      {HONEY_TERROIR.map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
                    </select>
                  </div>
                </div>

                {(meadIngredientHint || meadYeastSuggestions.length > 0) && (
                  <div className="suggestions-box" style={{ marginTop: '1rem' }}>
                    {meadIngredientHint && (
                      <div className="suggestions-box__group">
                        <h4><FaInfoCircle /> {t('Typically used for this mead style', 'Обычно используют для этого стиля мёда')}</h4>
                        <button
                          type="button"
                          className="suggestion-tag"
                          onClick={() => openIngredientModal(meadIngredientHint.category, '', meadIngredientHint.additiveType || '')}
                        >
                          {meadIngredientHint.label}
                        </button>
                      </div>
                    )}
                    {meadYeastSuggestions.length > 0 && (
                      <div className="suggestions-box__group">
                        <h4>{t('Suggested Yeasts for this ABV tier', 'Подходящие дрожжи для этого уровня ABV')}</h4>
                        {meadYeastSuggestions.map(y => (
                          <button type="button" key={y.id} className="suggestion-tag" onClick={() => openIngredientModal('Yeast', y.name)}>{y.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button type="button" className="recipe-lab__btn-secondary recipe-lab__btn-secondary--full" onClick={handleAiGeneration} disabled={isGenerating} style={{ marginTop: '1rem' }}>
                  <FaMagic /> {isGenerating ? t('AI is thinking...') : t('Generate / Review Steps with AI')}
                </button>
              </div>
            </section>
          )}

          {beverageType === 'Beer' && currentSelectedStyle && (suggestions.hops.length > 0 || suggestions.yeasts.length > 0) && (
            <section className="builder-section builder-section--suggestions">
              <h3 className="builder-section__title"><FaInfoCircle /> {t('Suggested for')} {currentSelectedStyle.name}</h3>
              <div className="suggestions-box">
                {suggestions.yeasts.length > 0 && (
                  <div className="suggestions-box__group">
                    <h4>{t('Yeasts')}</h4>
                    {suggestions.yeasts.map(y => (
                      <button type="button" key={y.id} className="suggestion-tag" onClick={() => openIngredientModal('Yeast', y.name)}>{y.name}</button>
                    ))}
                  </div>
                )}
                {suggestions.hops.length > 0 && (
                  <div className="suggestions-box__group">
                    <h4>{t('Hops')}</h4>
                    {suggestions.hops.map(h => (
                      <button type="button" key={h.id} className="suggestion-tag" onClick={() => openIngredientModal('Hops', h.name)}>{h.name}</button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="builder-section">
            <div className="builder-section__header builder-section__header--flex">
              <h2 className="builder-section__title">{t('Ingredients Formulation')}</h2>
              <div className="builder-auto-calc">
                <span className="builder-auto-calc__label">{t('Target ABV')}:</span>
                <input
                  className="builder-auto-calc__input"
                  type="number"
                  step="0.1"
                  min="1"
                  max="20"
                  value={targetAutoAbv}
                  onChange={(e) => setTargetAutoAbv(parseFloat(e.target.value) || 5.0)}
                />
                <button
                  type="button"
                  className="builder-auto-calc__btn"
                  onClick={handleAutoCalculateHoney}
                  title={t('Auto-calculate fermentable grams needed for this ABV')}
                >
                  <FaMagic /> {t('Auto-Scale')}
                </button>
              </div>
            </div>

            <div className="builder-section__body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {renderIngredientGroup('Fermentable', t('Fermentables (Malts, Extracts, Sugars)'))}
              {renderIngredientGroup('Honey', t('Honey'))}
              {beverageType === 'Beer' && renderIngredientGroup('Hops', t('Hops'))}
              {renderIngredientGroup('Yeast', t('Yeasts'))}
              {renderIngredientGroup('Additive', t('Additives & Water Chemistry'))}
            </div>
          </section>

          {aiProposedSteps.length > 0 && (
            <section className="builder-section ai-proposed-steps-container">
              <div className="ai-container-header">
                <h3><FaMagic /> {t('AI Generated Steps Review')}</h3>
                <div className="header-actions">
                  <button type="button" className="btn-accept" onClick={acceptAllProposedSteps}>
                    <FaCheck /> {t('Accept All Steps')}
                  </button>
                  <button type="button" className="btn-reject" onClick={rejectAllProposedSteps}>
                    <FaTimes /> {t('Reject AI Steps')}
                  </button>
                </div>
              </div>
              <div className="step-list">
                {aiProposedSteps.map((step) => (
                  <div key={step.id} className="step-item">
                    <div className="step-item__header">
                      <div className="step-item__header-left">
                        <span className="step-item__number">{step.stepNumber}</span>
                        <span className="recipe-ingredient__badge" style={{backgroundColor: '#3b82f6'}}>{t(`constants.step_phases.${step.phase.toLowerCase()}`, step.phase)}</span>
                      </div>
                      <div className='step-item__buttons'>
                        <button
                          type="button"
                          className="step-item__btn-icon"
                          onClick={() => setAiProposedSteps(prev => prev.map(s => s.id === step.id ? { ...s, isExpanded: !s.isExpanded } : s))}
                          aria-expanded={step.isExpanded}
                          aria-label={step.isExpanded ? t('Collapse step') : t('Expand step')}
                        >
                          {step.isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                      </div>
                    </div>

                    {step.isExpanded && (
                      <div className="step-item__body">
                        <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{step.title}</div>
                        <p style={{margin: '0', color: 'var(--text-secondary)'}}>{step.description}</p>
                        <div className="builder-row text-sm text-muted">
                          <div>⏱ {step.durationValue} {t(`constants.units.${step.durationUnit.toLowerCase()}`, step.durationUnit)}</div>
                          {step.targetTempC && <div>🌡 {step.targetTempC} °C</div>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="builder-section">
            <div className="builder-section__header">
              <h2 className="builder-section__title">{t('Current Brewing Steps')}</h2>
            </div>
            <div className="builder-section__body">
              <div className="step-list">
                {recipeSteps.map((step) => (
                  <div key={step.id} className="step-item">
                    <div className="step-item__header">
                      <div className="step-item__header-left">
                        <span className="step-item__number">{step.stepNumber}</span>
                        <select
                          className="form-field__select form-field__select--small"
                          value={step.phase}
                          onChange={(e) => updateStep(step.id, { phase: e.target.value as StepPhase })}
                          disabled={isSaving}
                        >
                          {VALID_PHASES.map(phase => (
                            <option key={phase} value={phase}>{t(`constants.step_phases.${phase.toLowerCase()}`, phase)}</option>
                          ))}
                        </select>
                      </div>
                      <div className='step-item__buttons'>
                        <button
                          type="button"
                          className="step-item__btn-icon"
                          onClick={() => updateStep(step.id, { isExpanded: !step.isExpanded })}
                          aria-expanded={step.isExpanded}
                          aria-label={step.isExpanded ? t('Collapse step') : t('Expand step')}
                        >
                          {step.isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                        <button
                          type="button"
                          className="step-item__btn-icon step-item__btn-icon--danger"
                          onClick={() => handleRemoveStep(step.id)}
                          disabled={isSaving}
                          aria-label={t('Remove step')}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>

                    {step.isExpanded && (
                      <div className="step-item__body">
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => updateStep(step.id, { title: e.target.value })}
                          placeholder={t('Step Title')}
                          className="form-field__input"
                          disabled={isSaving}
                        />
                        <textarea
                          value={step.description}
                          onChange={(e) => updateStep(step.id, { description: e.target.value })}
                          placeholder={t('Detailed instructions...')}
                          className="form-field__textarea"
                          rows={3}
                          disabled={isSaving}
                        />

                        <div className="builder-row">
                          <div className="form-field builder-row__item">
                            <label className="form-field__label">{t('Duration')}</label>
                            <div className="builder-row" style={{gap: '4px'}}>
                              <input
                                className="form-field__input builder-row__item"
                                type="number"
                                min="0"
                                value={step.durationValue === 0 ? '' : step.durationValue}
                                onChange={(e) => updateStep(step.id, { durationValue: parseFloat(e.target.value) || 0 })}
                                disabled={isSaving}
                              />
                              <select
                                className="form-field__select builder-row__item"
                                value={step.durationUnit}
                                onChange={(e) => updateStep(step.id, { durationUnit: e.target.value as TimeUnit })}
                                disabled={isSaving}
                              >
                                {VALID_UNITS.map(unit => (
                                  <option key={unit} value={unit}>{t(`constants.units.${unit.toLowerCase()}`, unit)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="form-field builder-row__item">
                            <label className="form-field__label">{t('Target Temp (°C)')}</label>
                            <input
                              className="form-field__input"
                              type="number"
                              value={step.targetTempC ?? ''}
                              onChange={(e) => updateStep(step.id, { targetTempC: e.target.value === '' ? null : parseFloat(e.target.value) })}
                              placeholder={t('Optional')}
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div style={{marginTop: '1rem'}}>
                  <button type="button" className="recipe-lab__btn-secondary recipe-lab__btn-secondary--full" onClick={() => handleAddStep('Preparation')} disabled={isSaving}>
                    <FaPlus /> {t('Add Manual Step')}
                  </button>
                </div>
              </div>
            </div>
          </section>

        </main>

        <aside className="builder-sidebar">
          <div className="stat-panel">
            <h3 className="stat-panel__title">{t('Estimated Specifications')}</h3>
            <ul className="stat-panel__list">
              <li className={`stat-panel__item ${!validation.isOgValid ? 'stat-panel__item--warning' : ''}`}>
                <span className="stat-panel__label">{t('OG')}</span>
                <span className="stat-panel__value">{recipeDetails.og.toFixed(3)}</span>
                {!validation.isOgValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.ogMin?.toFixed(3)}-{currentSelectedStyle.ogMax?.toFixed(3)})</span>}
              </li>
              <li className={`stat-panel__item ${!validation.isFgValid ? 'stat-panel__item--warning' : ''}`}>
                <span className="stat-panel__label">{t('FG')}</span>
                <span className="stat-panel__value">{targetFg.toFixed(3)}</span>
                {!validation.isFgValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.fgMin?.toFixed(3)}-{currentSelectedStyle.fgMax?.toFixed(3)})</span>}
              </li>
              <li className={`stat-panel__item ${!validation.isAbvValid || isAbvMismatch ? 'stat-panel__item--warning' : ''}`}>
                <span className="stat-panel__label">{t('ABV')}</span>
                <span className="stat-panel__value stat-panel__value--highlight">{recipeDetails.abv.toFixed(1)}%</span>
                {!validation.isAbvValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.abvMin}-{currentSelectedStyle.abvMax}%)</span>}
              </li>
              {beverageType === 'Beer' && (
                <>
                  <li className={`stat-panel__item ${!validation.isIbuValid ? 'stat-panel__item--warning' : ''}`}>
                    <span className="stat-panel__label">{t('IBU')}</span>
                    <span className="stat-panel__value">{recipeDetails.ibu.toFixed(1)}</span>
                    {!validation.isIbuValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.ibuMin}-{currentSelectedStyle.ibuMax})</span>}
                  </li>
                  <li className={`stat-panel__item ${!validation.isColorValid ? 'stat-panel__item--warning' : ''}`}>
                    <span className="stat-panel__label">{t('EBC')}</span>
                    <span className="stat-panel__value">{recipeDetails.ebc.toFixed(1)}</span>
                  </li>
                </>
              )}
            </ul>
            {!validation.isValidOverall && beverageType === 'Beer' && (
              <div className="style-alert">
                <FaExclamationTriangle />
                <p className="style-alert__text">{t('Recipe configuration parameters are outside the selected BJCP style boundaries.')}</p>
              </div>
            )}
            {isAbvMismatch && beverageType === 'Mead' && targetStyle !== 'Custom' && (
              <div className="style-alert">
                <FaExclamationTriangle />
                <p className="style-alert__text">{t('The calculated ABV does not match your selected Target Style. Adjust honey amount.')}</p>
              </div>
            )}
          </div>

          {recipeDetails.dynamicAdditives.length > 0 && (
            <div className="stat-panel">
              <h3 className="stat-panel__title">{t('Smart Additive Calculator')}</h3>
              <ul className="stat-panel__list stat-panel__list--stacked">
                {recipeDetails.dynamicAdditives.map(add => (
                  <li className="stat-panel__item stat-panel__item--row" key={add.id}>
                    <div className="stat-panel__info" style={{display: 'flex', flexDirection: 'column'}}>
                      <span className="stat-panel__label">{add.name}</span>
                      <span className="stat-panel__subtext">{add.rule}</span>
                    </div>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <strong className="stat-panel__value" style={{color: 'var(--color-primary)'}}>{add.totalGrams.toFixed(1)} g</strong>
                      <button
                        type="button"
                        className="stat-panel__btn-apply"
                        onClick={() => updateIngredient(add.id, { quantity: parseFloat(add.totalGrams.toFixed(1)) })}
                      >
                        {t('Apply')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="recipe-lab__btn-primary recipe-lab__btn-primary--large mt-md full-width"
            onClick={handleSaveRecipe}
            disabled={!recipeName || recipeIngredients.length === 0 || isSaving}
            style={{marginTop: '1.5rem', width: '100%', display: 'flex', justifyContent: 'center'}}
          >
            {isSaving ? t('Saving...') : editingRecipeId ? t('Update Recipe') : t('Save Recipe')}
          </button>
        </aside>
      </div>
    </div>
  );
};

export default Recipes;