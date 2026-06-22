import { calculateAbvCrouch, calculateTosna, estimateOG } from '@mead-tracker/math';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaChevronDown, FaChevronUp, FaExclamationTriangle, FaMagic, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { app, auth, db } from '../firebase/config';
import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';
import type { BaseIngredient, HoneyIngredient, IngredientCategory, YeastIngredient } from '../types/ingredient';
import type { MeadStyleTarget, Recipe, StepPhase, TimeUnit } from '../types/recipe';
import { HONEY_TERROIR, MEAD_STYLES, SWEETNESS_LEVELS } from '../utils/meadConstants';

interface RecipeIngredientEntry {
  id: string;
  globalIngredientId: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  note: string;
  showNote: boolean;
}

interface RecipeStep {
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

const VALID_PHASES: StepPhase[] = ['Preparation', 'Fermentation', 'Aging'];
const VALID_UNITS: TimeUnit[] = ['minutes', 'days'];

const Recipes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeBreweryId } = useBreweryStore();
  const { recipes, fetchRecipes, isLoading: isRecipesLoading } = useRecipeStore();

  const [view, setView] = useState<'list' | 'builder'>('list');
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [recipeName, setRecipeName] = useState('');
  const [batchSizeLiters, setBatchSizeLiters] = useState<number>(10);
  const [targetStyle, setTargetStyle] = useState<MeadStyleTarget>('Session (4-6%)');
  const [targetFg, setTargetFg] = useState<number>(1.000);
  
  const [targetAutoAbv, setTargetAutoAbv] = useState<number>(5.0);

  const [wizardStyle, setWizardStyle] = useState<string>(MEAD_STYLES[0].id);
  const [wizardSweetness, setWizardSweetness] = useState<string>(SWEETNESS_LEVELS[2].id);
  const [wizardHoney, setWizardHoney] = useState<string>(HONEY_TERROIR[4].id);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [globalCatalog, setGlobalCatalog] = useState<BaseIngredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientEntry[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [aiProposedIngredients, setAiProposedIngredients] = useState<AiIngredientProposal[]>([]);
  const [aiProposedSteps, setAiProposedSteps] = useState<RecipeStep[]>([]);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        if (!db) return;
        const querySnapshot = await getDocs(collection(db, 'ingredients'));
        const catalogData = querySnapshot.docs.map(docSnap => ({
          ...docSnap.data(),
          id: docSnap.id
        })) as BaseIngredient[];
        setGlobalCatalog(catalogData);
      } catch {
        console.error('Error fetching global ingredient catalog');
      }
    };
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (activeBreweryId) {
      fetchRecipes(activeBreweryId);
    }
  }, [activeBreweryId, fetchRecipes]);

  useEffect(() => {
    if (location.state && location.state.editRecipe) {
      const r = location.state.editRecipe as Recipe;
      setRecipeName(r.name);
      setBatchSizeLiters(r.expectedBatchSizeLiters);
      setTargetStyle(r.targetStyle || 'Session (4-6%)');
      setTargetFg(r.targetFinalGravity || 1.000);
      
      const rAny = r as any;
      if (rAny.baseStyle) {
        setWizardStyle(rAny.baseStyle);
      } else {
        const matchedStyle = MEAD_STYLES.find(s => s.name === r.targetStyle || s.id === r.targetStyle);
        if (matchedStyle) setWizardStyle(matchedStyle.id);
      }

      const matchedSweetness = SWEETNESS_LEVELS.find(lvl => Math.abs(lvl.minFg - r.targetFinalGravity) < 0.005);
      if (matchedSweetness) setWizardSweetness(matchedSweetness.id);

      const mappedIngredients = r.ingredients.map(ing => ({
        ...ing,
        showNote: !!ing.note
      }));
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
  }, [location.state, navigate, location.pathname]);

  const resetForm = () => {
    setRecipeName('');
    setBatchSizeLiters(10);
    setTargetStyle('Session (4-6%)');
    setTargetFg(1.000);
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

  const handleAddIngredient = () => {
    if (!selectedIngredientId) return;
    const template = globalCatalog.find(i => i.id === selectedIngredientId);
    if (!template) return;

    setRecipeIngredients(prev => [
      ...prev,
      { 
        id: crypto.randomUUID(), 
        globalIngredientId: template.id, 
        name: template.name,
        category: template.category as IngredientCategory,
        quantity: 0,
        note: '',
        showNote: false
      }
    ]);
    setSelectedIngredientId('');
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

  const updateStep = (id: string, updates: Partial<RecipeStep>) => {
    if (!id) return;
    setRecipeSteps(prev => prev.map(step => step.id === id ? { ...step, ...updates } : step));
  };

  const handleAutoCalculateHoney = () => {
    const honeyItems = recipeIngredients.filter(i => i.category === 'Honey');
    
    if (honeyItems.length === 0) {
      alert(t('Please add at least one Honey ingredient to the recipe first.'));
      return;
    }
    
    if (honeyItems.length > 1) {
      alert(t('Auto-calculation currently supports recipes with a single type of honey.'));
      return;
    }

    const honeyEntry = honeyItems[0];
    const template = globalCatalog.find(t => t.id === honeyEntry.globalIngredientId) as unknown as HoneyIngredient;
    const brix = template?.sugarContentBrix || 80;

    let minGrams = 100;
    let maxGrams = 20000;
    let bestGrams = 1000;
    let iterations = 0;

    while (minGrams <= maxGrams && iterations < 50) {
      const midGrams = Math.floor((minGrams + maxGrams) / 2);
      const testOG = estimateOG(batchSizeLiters, midGrams, brix);
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
    updateIngredient(honeyEntry.id, { quantity: roundedGrams });
  };

  const handleAiGeneration = async () => {
    if (!app) return;
    setIsGenerating(true);
    
    try {
      const payload = {
        style: wizardStyle,
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
          quantity: i.quantity
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
      alert(t('AI Generation failed'));
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
    let totalHoneyGrams = 0;
    let averageBrix = 80;
    let selectedYeast: YeastIngredient | null = null;
    let yeastAddedGrams = 0;
    let totalWeightedBrix = 0;
    let customNutrientName = '';
    const dynamicAdditives: Array<{ id: string; name: string; totalGrams: number; rule: string }> = [];

    recipeIngredients.forEach(item => {
      const template = globalCatalog.find(t => t.id === item.globalIngredientId);
      if (!template) return;

      if (template.category === 'Honey') {
        const honey = template as unknown as HoneyIngredient;
        const brix = honey.sugarContentBrix || 80;
        const qty = item.quantity || 0;
        
        totalHoneyGrams += qty;
        totalWeightedBrix += (brix * qty);
      } else if (template.category === 'Yeast') {
        selectedYeast = template as unknown as YeastIngredient;
        yeastAddedGrams += item.quantity || 0;
      }
    });

    if (totalHoneyGrams > 0) {
      averageBrix = totalWeightedBrix / totalHoneyGrams;
    }

    const estimatedOg = estimateOG(batchSizeLiters, totalHoneyGrams, averageBrix);
    const estimatedAbv = calculateAbvCrouch(estimatedOg, targetFg);

    let tosnaData = null;
    if (selectedYeast && estimatedOg > 1.000) {
      const yeast = selectedYeast as YeastIngredient;
      let nFactor = 0.90;
      if (yeast.nitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeast.nitrogenDemand === 'High' || yeast.nitrogenDemand === 'Very High') nFactor = 1.25;
      tosnaData = calculateTosna(batchSizeLiters, estimatedOg, nFactor);
    }

    recipeIngredients.forEach(item => {
      const template = globalCatalog.find(t => t.id === item.globalIngredientId);
      if (!template || template.category !== 'Additive') return;

      const additive = template as any;
      let calculatedGrams = 0;
      let ruleApplied = '';

      if (additive.additiveType === 'Nutrient' && tosnaData) {
        if (item.name.toLowerCase().includes('go-ferm') || additive.dosagePerGramYeast) {
          calculatedGrams = tosnaData.goFermGrams;
          ruleApplied = 'TOSNA 3.0: Go-Ferm (1.25x Yeast)';
        } else {
          calculatedGrams = tosnaData.totalFermaidOGrams;
          ruleApplied = 'TOSNA 3.0: Total Fermaid-O';
          if (!customNutrientName) customNutrientName = item.name;
        }
      } 
      else if (additive.dosagePerGramYeast && yeastAddedGrams > 0) {
        calculatedGrams = yeastAddedGrams * additive.dosagePerGramYeast;
        ruleApplied = `${additive.dosagePerGramYeast}g / 1g Yeast`;
      } else if (additive.dosagePer10Liters && batchSizeLiters > 0) {
        calculatedGrams = (batchSizeLiters / 10) * additive.dosagePer10Liters;
        ruleApplied = `${additive.dosagePer10Liters}g / 10L`;
        if (additive.additiveType === 'Nutrient' && !customNutrientName) {
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
      tosna: tosnaData, 
      yeastAdded: yeastAddedGrams, 
      customNutrientName: customNutrientName || 'Fermaid-O',
      dynamicAdditives 
    };
  }, [recipeIngredients, batchSizeLiters, targetFg, globalCatalog]);

  const isAbvMismatch = useMemo(() => {
    if (targetStyle === 'Session (4-6%)' && recipeDetails.abv > 6.5) return true;
    if (targetStyle === 'Standard (7-10%)' && (recipeDetails.abv < 6.5 || recipeDetails.abv > 10.5)) return true;
    if (targetStyle === 'Wine/Sack (11%+)' && recipeDetails.abv < 10.5) return true;
    return false;
  }, [targetStyle, recipeDetails.abv]);

  const handleSaveRecipe = async () => {
    if (!activeBreweryId || !recipeName || !recipeIngredients || recipeIngredients.length === 0 || !db || !auth?.currentUser) return;

    setIsSaving(true);
    try {
      const recipeId = editingRecipeId || crypto.randomUUID();
      const recipeRef = doc(db, 'recipes', recipeId);
      
      const cleanIngredients = recipeIngredients.map(item => ({
        id: item?.id || crypto.randomUUID(),
        globalIngredientId: item?.globalIngredientId || '',
        name: item?.name || '',
        category: item?.category || 'Additive',
        quantity: item?.quantity || 0,
        note: item?.note || ''
      }));
      
      const cleanSteps = recipeSteps.map(step => ({
        id: step?.id || crypto.randomUUID(),
        stepNumber: step?.stepNumber || 0,
        phase: step?.phase || 'Preparation',
        title: step?.title || '',
        description: step?.description || '',
        durationValue: step?.durationValue || 0,
        durationUnit: step?.durationUnit || 'minutes',
        targetTempC: step?.targetTempC ?? null
      }));

      const recipeData: Partial<Recipe> & { baseStyle?: string } = {
        id: recipeId,
        breweryId: activeBreweryId,
        name: recipeName,
        targetStyle,
        baseStyle: wizardStyle,
        expectedBatchSizeLiters: batchSizeLiters || 0,
        targetOriginalGravity: recipeDetails?.og || 1.000,
        targetFinalGravity: targetFg || 1.000,
        targetAbv: recipeDetails?.abv || 0,
        ingredients: cleanIngredients,
        steps: cleanSteps,
        updatedAt: new Date().toISOString()
      };

      if (!editingRecipeId) {
        recipeData.createdAt = new Date().toISOString();
        recipeData.createdBy = auth.currentUser.uid;
        await setDoc(recipeRef, recipeData);
      } else {
        await setDoc(recipeRef, recipeData, { merge: true });
      }
      
      const wasEditingId = editingRecipeId;
      const currentRecipeId = recipeId;
      
      resetForm();
      await fetchRecipes(activeBreweryId);
      
      if (wasEditingId) {
        navigate(`/recipes/${currentRecipeId}`);
      } else {
        setView('list');
      }
    } catch {
      alert(t('Error saving recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeBreweryId) return null;

  if (view === 'list') {
    return (
      <div className="recipes-page">
        <header className="page-header">
          <h1>{t('Recipes')}</h1>
          <button type="button" className="btn-primary" onClick={() => setView('builder')}>
            <FaPlus /> {t('Create Recipe')}
          </button>
        </header>
        
        {isRecipesLoading ? (
          <div className="loading-text">{t('Loading recipes...')}</div>
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <p>{t('No recipes found. Create your first recipe!')}</p>
          </div>
        ) : (
          <div className="recipes-list-grid">
            {recipes.map(recipe => (
              <div 
                key={recipe.id} 
                className="card recipe-card interactive" 
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
                <h3 className="recipe-title">{recipe.name}</h3>
                <div className="recipe-meta-stack">
                  <div className="meta-row">
                    <span className="font-bold">{recipe.targetStyle}</span>
                    <span className="text-primary-bold">{recipe.targetAbv?.toFixed(1)}% ABV</span>
                  </div>
                  <div className="meta-row">
                    <span>{t('Batch Size')}</span>
                    <span>{recipe.expectedBatchSizeLiters} {t('L')}</span>
                  </div>
                  <div className="meta-row">
                    <span>{t('Original Gravity')}</span>
                    <span>{recipe.targetOriginalGravity?.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="recipes-page">
      <header className="page-header">
        <h1>{editingRecipeId ? t('Edit Recipe') : t('Recipe Builder')}</h1>
        <button type="button" className="btn-secondary" onClick={handleCancel}>
          {t('Cancel')}
        </button>
      </header>

      <div className="recipe-grid">
        <div className="flex-col gap-lg">
          
          <div className="card">
            <div className="card-header-flex">
              <h3 className="m-0"><FaMagic /> {t('Smart Recipe Wizard')}</h3>
            </div>
            <div className="form-row multi-col mb-md">
              <div className="form-group">
                <label>{t('Base Style')}</label>
                <select value={wizardStyle} onChange={e => setWizardStyle(e.target.value)}>
                  {MEAD_STYLES.map(s => <option key={s.id} value={s.id}>{t(s.name)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('Sweetness / FG')}</label>
                <select value={wizardSweetness} onChange={e => {
                  setWizardSweetness(e.target.value);
                  const selected = SWEETNESS_LEVELS.find(lvl => lvl.id === e.target.value);
                  if (selected) {
                    setTargetFg(selected.minFg);
                  }
                }}>
                  {SWEETNESS_LEVELS.map(s => <option key={s.id} value={s.id}>{t(s.name)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('Honey Terroir')}</label>
                <select value={wizardHoney} onChange={e => setWizardHoney(e.target.value)}>
                  {HONEY_TERROIR.map(s => <option key={s.id} value={s.id}>{t(s.name)}</option>)}
                </select>
              </div>
            </div>
            <button type="button" className="btn-secondary full-width" onClick={handleAiGeneration} disabled={isGenerating}>
              <FaMagic /> {isGenerating ? t('AI is thinking...') : t('Generate / Review Steps with AI')}
            </button>
          </div>

          <div className="card">
            <div className="form-group">
              <label>{t('Recipe Name')}</label>
              <input 
                type="text" 
                value={recipeName} 
                onChange={(e) => setRecipeName(e.target.value)} 
                placeholder={t('e.g. Traditional Wildflower Mead')}
              />
            </div>
            <div className="form-row multi-col">
              <div className="form-group">
                <label>{t('Target ABV Tier')}</label>
                <select 
                  value={targetStyle}
                  onChange={(e) => setTargetStyle(e.target.value as MeadStyleTarget)}
                >
                  <option value="Session (4-6%)">{t('Session (4-6%) - Light & Drinkable')}</option>
                  <option value="Standard (7-10%)">{t('Standard (7-10%) - Traditional')}</option>
                  <option value="Wine/Sack (11%+)">{t('Wine/Sack (11%+) - Strong & Sweet')}</option>
                  <option value="Custom">{t('Custom')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('Batch Size (Liters)')}</label>
                <input 
                  type="number" 
                  min="1" 
                  value={batchSizeLiters || ''} 
                  onChange={(e) => setBatchSizeLiters(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="form-group">
                <label>{t('Target FG (Gravity)')}</label>
                <input 
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

          <div className="card">
            <div className="card-header-flex">
              <h3 className="m-0">{t('Ingredients')}</h3>
              
              <div className="auto-calc-widget">
                <span className="widget-label">{t('Target ABV')}:</span>
                <input 
                  type="number" 
                  step="0.1"
                  min="1"
                  max="20"
                  value={targetAutoAbv} 
                  onChange={(e) => setTargetAutoAbv(parseFloat(e.target.value) || 5.0)}
                  className="widget-input"
                />
                <button 
                  type="button"
                  className="btn-text-small widget-btn" 
                  onClick={handleAutoCalculateHoney}
                  title={t('Auto-calculate honey grams needed for this ABV')}
                >
                  <FaMagic /> {t('Auto-Honey')}
                </button>
              </div>
            </div>
            
            <div className="ingredient-selector">
              <select 
                value={selectedIngredientId} 
                onChange={(e) => setSelectedIngredientId(e.target.value)}
              >
                <option value="" disabled>{t('Select an ingredient...')}</option>
                {globalCatalog.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({t(template.category)})
                  </option>
                ))}
              </select>
              <button type="button" className="btn-primary" onClick={handleAddIngredient} disabled={!selectedIngredientId || isSaving}>
                <FaPlus /> {t('Add')}
              </button>
            </div>

            <div className="ingredients-list">
              {recipeIngredients.map(item => {
                const aiProposal = aiProposedIngredients.find(p => p.ingredientId === item.id);
                return (
                  <div key={item.id} className="ingredient-row">
                    <div className="ingredient-main-row">
                      <div className="ingredient-info">
                        <span className="category-tag" data-category={item.category}>{t(item.category)}</span>
                        <span className="name">{item.name}</span>
                      </div>
                      <div className="ingredient-controls">
                        <button 
                          type="button"
                          className="btn-text-small" 
                          onClick={() => updateIngredient(item.id, { showNote: !item.showNote })}
                          disabled={isSaving}
                        >
                          {item.showNote ? t('- Note') : t('+ Note')}
                        </button>
                        <input 
                          type="number" 
                          min="0" 
                          value={item.quantity === 0 ? '' : item.quantity} 
                          onChange={(e) => updateIngredient(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                          disabled={isSaving}
                        />
                        <span className="unit">{t('g')}</span>
                        <button 
                          type="button"
                          className="btn-icon danger" 
                          onClick={() => handleRemoveIngredient(item.id)} 
                          disabled={isSaving}
                          aria-label={t('Remove')}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                    {item.showNote && (
                      <div className="ingredient-note-container">
                        <textarea 
                          value={item.note}
                          onChange={(e) => updateIngredient(item.id, { note: e.target.value })}
                          placeholder={t('Add detailed notes for this ingredient...')}
                          className="note-textarea"
                          rows={2}
                          disabled={isSaving}
                        />
                      </div>
                    )}
                    {aiProposal && (
                      <div className="ai-diff-box">
                        <h4><FaMagic /> {t('AI Proposed Adjustment')}</h4>
                        <div className="text-sm">
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
              {recipeIngredients.length === 0 && (
                <div className="empty-text">{t('No ingredients added yet.')}</div>
              )}
            </div>
          </div>

          {aiProposedSteps.length > 0 && (
            <div className="ai-proposed-steps-container">
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
              <div className="steps-list">
                {aiProposedSteps.map((step) => (
                  <div key={step.id} className="step-card ai-step-card">
                    <div className="step-header">
                      <div className="step-header-left">
                        <span className="step-number ai-step-number">{step.stepNumber}</span>
                        <span className="font-bold text-sm">{step.phase}</span>
                      </div>
                      <div className='step-buttons'>
                        <button 
                          type="button"
                          className="btn-icon" 
                          onClick={() => setAiProposedSteps(prev => prev.map(s => s.id === step.id ? { ...s, isExpanded: !s.isExpanded } : s))}
                          aria-expanded={step.isExpanded}
                          aria-label={step.isExpanded ? t('Collapse step') : t('Expand step')}
                        >
                          {step.isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                      </div>
                    </div>

                    {step.isExpanded && (
                      <div className="step-body">
                        <div className="font-bold mb-sm">{step.title}</div>
                        <p className="text-sm m-0">{step.description}</p>
                        <div className="form-row multi-col mt-sm text-sm text-muted">
                          <div>⏱ {step.durationValue} {step.durationUnit}</div>
                          {step.targetTempC && <div>🌡 {step.targetTempC} °C</div>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3>{t('Current Brewing Steps')}</h3>
            <div className="steps-list">
              {recipeSteps.map((step) => (
                <div key={step.id} className="step-card">
                  <div className="step-header">
                    <div className="step-header-left">
                      <span className="step-number">{step.stepNumber}</span>
                      <select 
                        className="phase-selector"
                        value={step.phase}
                        onChange={(e) => updateStep(step.id, { phase: e.target.value as StepPhase })}
                        disabled={isSaving}
                      >
                        <option value="Preparation">{t('Preparation')}</option>
                        <option value="Fermentation">{t('Fermentation')}</option>
                        <option value="Aging">{t('Aging')}</option>
                      </select>
                    </div>
                    <div className='step-buttons'>
                      <button 
                        type="button"
                        className="btn-icon" 
                        onClick={() => updateStep(step.id, { isExpanded: !step.isExpanded })}
                        aria-expanded={step.isExpanded}
                        aria-label={step.isExpanded ? t('Collapse step') : t('Expand step')}
                      >
                        {step.isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                      <button 
                        type="button"
                        className="btn-icon danger" 
                        onClick={() => handleRemoveStep(step.id)} 
                        disabled={isSaving}
                        aria-label={t('Remove step')}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  {step.isExpanded && (
                    <div className="step-body">
                      <input 
                        type="text" 
                        value={step.title}
                        onChange={(e) => updateStep(step.id, { title: e.target.value })}
                        placeholder={t('Step Title')}
                        className="step-title-input"
                        disabled={isSaving}
                      />
                      <textarea 
                        value={step.description}
                        onChange={(e) => updateStep(step.id, { description: e.target.value })}
                        placeholder={t('Detailed instructions...')}
                        className="step-desc-textarea"
                        rows={3}
                        disabled={isSaving}
                      />
                      
                      <div className="form-row multi-col">
                        <div className="form-group">
                          <label>{t('Duration')}</label>
                          <div className="duration-inputs">
                            <input 
                              type="number" 
                              min="0"
                              value={step.durationValue === 0 ? '' : step.durationValue}
                              onChange={(e) => updateStep(step.id, { durationValue: parseFloat(e.target.value) || 0 })}
                              disabled={isSaving}
                            />
                            <select 
                              value={step.durationUnit}
                              onChange={(e) => updateStep(step.id, { durationUnit: e.target.value as TimeUnit })}
                              disabled={isSaving}
                            >
                              <option value="minutes">{t('Minutes')}</option>
                              <option value="days">{t('Days')}</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>{t('Target Temp (°C)')}</label>
                          <input 
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
              <div className="step-add-buttons">
                <button type="button" className="btn-secondary full-width" onClick={() => handleAddStep('Preparation')} disabled={isSaving}>
                  <FaPlus /> {t('Add Manual Step')}
                </button>
              </div>
            </div>
          </div>

        </div>

        <div className="flex-col gap-lg">
          <div className="card stat-card">
            <h3>{t('Estimated Specifications')}</h3>
            <div className="stat-grid">
              <div className="stat-box">
                <span className="label">{t('Original Gravity (OG)')}</span>
                <span className="value">{recipeDetails.og.toFixed(3)}</span>
              </div>
              <div className="stat-box">
                <span className="label">{t('Target Final Gravity')}</span>
                <span className="value">{targetFg.toFixed(3)}</span>
              </div>
              <div className="stat-box">
                <span className="label">{t('Estimated ABV')}</span>
                <span className={`value ${isAbvMismatch ? 'text-error' : ''}`}>
                  {recipeDetails.abv.toFixed(1)}%
                </span>
              </div>
            </div>
            {isAbvMismatch && targetStyle !== 'Custom' && (
              <div className="abv-warning-msg mt-md text-error flex-row gap-sm align-center">
                <FaExclamationTriangle /> {t('The calculated ABV does not match your selected Target Style. Adjust honey amount.')}
              </div>
            )}
          </div>

          {recipeDetails.dynamicAdditives.length > 0 && (
            <div className="card stat-card mt-md">
              <h3 className="mb-md">{t('Smart Additive Calculator')}</h3>
              <div className="tosna-grid">
                {recipeDetails.dynamicAdditives.map(add => (
                  <div className="tosna-row align-center" key={add.id}>
                    <div className="flex-col gap-xs">
                      <span className="font-bold">{add.name}</span>
                      <span className="text-sm text-muted">{add.rule}</span>
                    </div>
                    <div className="flex-row gap-sm align-center">
                      <strong className="text-lg text-primary">{add.totalGrams.toFixed(1)} g</strong>
                      <button 
                        type="button"
                        className="btn-apply-small" 
                        onClick={() => updateIngredient(add.id, { quantity: parseFloat(add.totalGrams.toFixed(1)) })}
                      >
                        {t('Apply')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            type="button"
            className="btn-primary full-width mt-md" 
            onClick={handleSaveRecipe}
            disabled={!recipeName || recipeIngredients.length === 0 || isSaving}
          >
            {isSaving ? t('Saving...') : editingRecipeId ? t('Update Recipe') : t('Save Recipe')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Recipes;