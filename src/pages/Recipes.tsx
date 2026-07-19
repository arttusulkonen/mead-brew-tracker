// src/pages/Recipes.tsx
import { calculateAbvCrouch, calculateIbuTinseth, calculateMcu, calculateTosna, estimateOG, estimateSrmMorey, srmToEbc } from '@mead-tracker/math';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase/client';

import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { getSuggestedIngredients, validateStyleBounds } from '../utils/bjcpMatchEngine';

import { IngredientEditorModal, type EditedIngredientData } from '../components/IngredientEditorModal';
import { StyleSearchModal } from '../components/StyleSearchModal';

import { useNavigate } from 'react-router-dom';
import { BeerSuggestionsSection } from '../components/recipe-components/BeerSuggestionsSection';
import { BrewingStepsEditor } from '../components/recipe-components/BrewingStepsEditor';
import { CoreParametersSection } from '../components/recipe-components/CoreParametersSection';
import { IngredientFormulationSection } from '../components/recipe-components/IngredientFormulationSection';
import { IngredientGroup } from '../components/recipe-components/IngredientGroup';
import { MeadWizardSection } from '../components/recipe-components/MeadWizardSection';
import { RecipeListView } from '../components/recipe-components/RecipeListView';
import { RecipeStatsSidebar, type RecipeDetailsStats } from '../components/recipe-components/RecipeStatsSidebar';
import type { AiIngredientProposal, RecipeIngredientEntry, RecipeStepEntry } from '../components/recipe-components/types';
import { useRecipeBuilderState } from '../components/recipe-components/useRecipeBuilderState';
import type { AdditiveType, BaseIngredient, IngredientCategory, IngredientUnion, YeastIngredient } from '../types/ingredient';
import type { Recipe, RecipeIngredientReference, RecipeStep, StepPhase, TimeUnit } from '../types/recipe';

const VALID_PHASES: StepPhase[] = ['Preparation', 'Mashing', 'Boiling', 'Fermentation', 'Conditioning', 'Packaging'];
const VALID_UNITS: TimeUnit[] = ['minutes', 'days'];

interface AiResponseStep {
  phase: string;
  title: string;
  description: string;
  durationValue: number;
  durationUnit: string;
  targetTempC?: number | null;
}

interface AiResponseIngredient {
  ingredientId: string;
  suggestedQuantityGrams: number;
  aiNote?: string;
}

const Recipes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { activeBrewery } = useBreweryStore();
  const navigate = useNavigate();
  
  const { recipes, saveRecipe, updateRecipe, fetchRecipes, isLoading: isRecipesLoading } = useRecipeStore();

  const state = useRecipeBuilderState();
  const [aiProposedIngredients, setAiProposedIngredients] = useState<AiIngredientProposal[]>([]);
  const [aiProposedSteps, setAiProposedSteps] = useState<RecipeStepEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Состояние для редактирования (линковки) ингредиента
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBrewery?.id) {
      fetchRecipes(activeBrewery.id);
    }
  }, [activeBrewery?.id, fetchRecipes]);

  const currentSelectedStyle = useMemo(() => {
    return (state.bjcpStyles || []).find(s => s?.style_id === state.selectedStyleId) || null;
  }, [state.selectedStyleId, state.bjcpStyles]);

  const recipeDetails: RecipeDetailsStats = useMemo(() => {
    let totalFermentableGrams = 0;
    let averageBrixEquivalent = 0;
    let totalMcu = 0;
    let totalIbu = 0;
    let yeastAddedGrams = 0;
    let yeastNitrogenDemand: string = 'Medium';
    let totalWeightedBrix = 0;
    let customNutrientName = '';
    const dynamicAdditives: Array<{ id: string; name: string; totalGrams: number; rule: string }> = [];

    (state.recipeIngredients || []).forEach(item => {
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

        if (item.category === 'Fermentable' && state.beverageType === 'Beer' && state.batchSizeLiters > 0) {
          totalMcu += calculateMcu(qty / 1000, item.colorEbc || 5, state.batchSizeLiters);
        }
      } else if (item.category === 'Yeast') {
        yeastAddedGrams += item.quantity || 0;
        if (item.nitrogenDemand) yeastNitrogenDemand = item.nitrogenDemand;
      }
    });

    if (totalFermentableGrams > 0) {
      averageBrixEquivalent = totalWeightedBrix / totalFermentableGrams;
    }

    const estimatedOg = estimateOG(state.batchSizeLiters, totalFermentableGrams, averageBrixEquivalent);
    const estimatedAbv = calculateAbvCrouch(estimatedOg, state.targetFg);
    const estimatedEbc = state.beverageType === 'Beer' ? srmToEbc(estimateSrmMorey(totalMcu)) : 0;

    (state.recipeIngredients || []).forEach(item => {
      if (!item) return;
      if (item.category === 'Hops' && state.beverageType === 'Beer' && state.batchSizeLiters > 0) {
        const boilTime = item.boilTimeMinutes || 0;
        const alpha = item.alphaAcidPct || 5;
        totalIbu += calculateIbuTinseth(alpha, item.quantity || 0, boilTime, state.batchSizeLiters, estimatedOg);
      }
    });

    let tosnaData = null;
    if (state.beverageType === 'Mead' && yeastAddedGrams > 0 && estimatedOg > 1.000) {
      let nFactor = 0.90;
      if (yeastNitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeastNitrogenDemand === 'High' || yeastNitrogenDemand === 'Very High') nFactor = 1.25;
      tosnaData = calculateTosna(state.batchSizeLiters, estimatedOg, nFactor);
    }

    (state.recipeIngredients || []).forEach(item => {
      if (!item || item.category !== 'Additive') return;
      let calculatedGrams = 0;
      let ruleApplied = '';

      if (item.additiveType === 'Nutrient' && tosnaData) {
        if (item.nutrientRole === 'Rehydration' || (!item.nutrientRole && item.name?.toLowerCase().includes('go-ferm'))) {
          calculatedGrams = tosnaData.goFermGrams;
          ruleApplied = 'TOSNA 3.0: Rehydration';
        } else if (item.nutrientRole === 'Fermentation' || !item.nutrientRole) {
          calculatedGrams = tosnaData.totalFermaidOGrams;
          ruleApplied = 'TOSNA 3.0: Total Fermentation Nutrient';
          if (!customNutrientName) customNutrientName = item.name;
        }
      } else if (item.dosagePerGramYeast && yeastAddedGrams > 0) {
        calculatedGrams = yeastAddedGrams * item.dosagePerGramYeast;
        ruleApplied = `${item.dosagePerGramYeast}g / 1g Yeast`;
      } else if (item.dosagePer10Liters && state.batchSizeLiters > 0) {
        calculatedGrams = (state.batchSizeLiters / 10) * item.dosagePer10Liters;
        ruleApplied = `${item.dosagePer10Liters}g / 10L`;
        if (item.additiveType === 'Nutrient' && !customNutrientName) customNutrientName = item.name;
      }

      if (calculatedGrams > 0) {
        dynamicAdditives.push({ id: item.id, name: item.name, totalGrams: calculatedGrams, rule: ruleApplied });
      }
    });

    return { og: estimatedOg, abv: estimatedAbv, ibu: totalIbu, ebc: estimatedEbc, tosna: tosnaData, yeastAdded: yeastAddedGrams, dynamicAdditives };
  }, [state.recipeIngredients, state.batchSizeLiters, state.targetFg, state.beverageType]);

  const validation = useMemo(() => {
    return validateStyleBounds(currentSelectedStyle, recipeDetails.og, state.targetFg, recipeDetails.abv, recipeDetails.ibu, recipeDetails.ebc);
  }, [currentSelectedStyle, recipeDetails, state.targetFg]);

  const suggestions = useMemo(() => getSuggestedIngredients(currentSelectedStyle, state.globalCatalog || []), [currentSelectedStyle, state.globalCatalog]);

  const isAbvMismatch = useMemo(() => {
    if (state.beverageType !== 'Mead') return false;
    if (state.targetStyle === 'Session (4-6%)' && recipeDetails.abv > 6.5) return true;
    if (state.targetStyle === 'Standard (7-10%)' && (recipeDetails.abv < 6.5 || recipeDetails.abv > 10.5)) return true;
    if (state.targetStyle === 'Wine/Sack (11%+)' && recipeDetails.abv < 10.5) return true;
    return false;
  }, [state.targetStyle, recipeDetails.abv, state.beverageType]);

  const meadYeastToleranceRange = useMemo(() => {
    if (state.targetStyle === 'Session (4-6%)') return { min: 0, max: 9 };
    if (state.targetStyle === 'Standard (7-10%)') return { min: 9, max: 14 };
    if (state.targetStyle === 'Wine/Sack (11%+)') return { min: 13, max: 99 };
    return null;
  }, [state.targetStyle]);

  const meadYeastSuggestions = useMemo(() => {
    if (state.beverageType !== 'Mead' || !meadYeastToleranceRange) return [];
    return (state.globalCatalog || []).filter(ing => {
      if (ing?.category !== 'Yeast') return false;
      const tolerance = (ing as YeastIngredient).alcoholTolerancePct;
      return typeof tolerance === 'number' && tolerance >= meadYeastToleranceRange.min && tolerance <= meadYeastToleranceRange.max;
    }).slice(0, 5);
  }, [state.beverageType, meadYeastToleranceRange, state.globalCatalog]);

  const meadIngredientHint = useMemo(() => {
    if (state.beverageType !== 'Mead') return null;
    switch (state.wizardStyle) {
      case 'traditional': return { category: 'Honey' as IngredientCategory, label: t('Honey') };
      case 'melomel': return { category: 'Additive' as IngredientCategory, additiveType: 'Fruit' as AdditiveType, label: t('constants.additive_types.fruit', 'Fruit') };
      case 'metheglin': return { category: 'Additive' as IngredientCategory, additiveType: 'Spice' as AdditiveType, label: t('constants.additive_types.spice', 'Spice') };
      case 'session_hopped': case 'braggot': return { category: 'Hops' as IngredientCategory, label: t('Hops') };
      default: return null;
    }
  }, [state.beverageType, state.wizardStyle, t]);

  // ИСПРАВЛЕНИЕ: Вычисляем editingIngredientData ДО условий выхода
  const editingIngredientData = useMemo(() => {
    return editingIngredientId ? state.recipeIngredients?.find(i => i.id === editingIngredientId) : undefined;
  }, [editingIngredientId, state.recipeIngredients]);

  const handleAutoCalculateHoney = () => {
    const targetEntry = (state.recipeIngredients || []).find(i => i?.category === 'Fermentable' || i?.category === 'Honey');
    if (!targetEntry) return;

    let minGrams = 100, maxGrams = 25000, bestGrams = 1000, iterations = 0;
    while (minGrams <= maxGrams && iterations < 50) {
      const midGrams = Math.floor((minGrams + maxGrams) / 2);
      let totalGramsForCalc = 0, totalWeightedBrix = 0;

      (state.recipeIngredients || []).forEach(ing => {
        if (!ing) return;
        if (ing.category === 'Fermentable' || ing.category === 'Honey') {
          let brixVal = 80;
          if (ing.category === 'Honey' && ing.sugarContentBrix) {
            brixVal = ing.sugarContentBrix;
          } else if (ing.yieldPpg) {
            brixVal = ing.yieldPpg;
          }

          const qty = ing.id === targetEntry.id ? midGrams : (ing.quantity || 0);
          totalGramsForCalc += qty;
          totalWeightedBrix += (brixVal * qty);
        }
      });

      const avgBrix = totalGramsForCalc > 0 ? totalWeightedBrix / totalGramsForCalc : 80;
      const testOG = estimateOG(state.batchSizeLiters, totalGramsForCalc, avgBrix);
      const testABV = calculateAbvCrouch(testOG, state.targetFg);

      if (Math.abs(testABV - state.targetAutoAbv) < 0.05) { bestGrams = midGrams; break; }
      if (testABV < state.targetAutoAbv) minGrams = midGrams + 1; else maxGrams = midGrams - 1;
      bestGrams = midGrams;
      iterations++;
    }
    state.updateIngredient(targetEntry.id, { quantity: Math.round(bestGrams / 10) * 10 });
  };

  const handleAiGeneration = async () => {
    setIsGenerating(true);
    try {
      const payload = {
        beverageType: state.beverageType,
        style: state.beverageType === 'Mead' ? state.wizardStyle : state.selectedStyleId,
        sweetness: state.wizardSweetness,
        honeyTerroir: state.wizardHoney,
        targetAbv: state.targetAutoAbv,
        batchSizeLiters: state.batchSizeLiters,
        targetFg: state.targetFg,
        locale: i18n?.resolvedLanguage || i18n?.language || 'en',
        ingredients: (state.recipeIngredients || []).map(i => ({
          ingredientId: i.id,
          globalIngredientId: i.globalIngredientId,
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          nutrientRole: i.nutrientRole,
          additiveType: i.additiveType
        }))
      };

      const { data, error } = await supabase.functions.invoke('generate-recipe', {
        body: payload
      });

      if (error) throw error;
      const resultData = data;

      if (resultData?.status === 'success' && resultData?.data) {
        if (Array.isArray(resultData.data.steps)) {
          setAiProposedSteps(resultData.data.steps.map((s: AiResponseStep, idx: number) => ({
            id: crypto.randomUUID(),
            stepNumber: idx + 1,
            phase: VALID_PHASES.includes(s.phase as StepPhase) ? (s.phase as StepPhase) : 'Preparation',
            title: s.title || '',
            description: s.description || '',
            durationValue: s.durationValue || 0,
            durationUnit: VALID_UNITS.includes(s.durationUnit as TimeUnit) ? (s.durationUnit as TimeUnit) : 'minutes',
            targetTempC: typeof s.targetTempC === 'number' ? s.targetTempC : null,
            isExpanded: true
          })));
        }
        if (Array.isArray(resultData.data.ingredientQuantities)) {
          setAiProposedIngredients(resultData.data.ingredientQuantities
            .filter((s: AiResponseIngredient) => s && s.ingredientId && typeof s.suggestedQuantityGrams === 'number')
            .map((s: AiResponseIngredient) => ({
              ingredientId: s.ingredientId,
              suggestedQuantityGrams: s.suggestedQuantityGrams,
              aiNote: s.aiNote || ''
            })));
        }
      }
    } catch {
      setAiProposedSteps([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!activeBrewery?.id || !state.recipeName || (state.recipeIngredients || []).length === 0) return;
    state.setIsSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('User not authenticated');

      const formattedIngredients = (state.recipeIngredients || []).map(ing => {
        const copy = { ...ing } as Partial<RecipeIngredientEntry>;
        delete copy.showNote;
        delete copy.alphaAcidPctMin;
        delete copy.alcoholTolerancePctMin;
        delete copy.attenuationPctMin;
        return copy as unknown as RecipeIngredientReference;
      });

      const formattedSteps = (state.recipeSteps || []).map(step => {
        const copy = { ...step } as Partial<RecipeStepEntry>;
        delete copy.isExpanded;
        return copy as unknown as RecipeStep;
      });

      const recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> = {
        breweryId: activeBrewery.id,
        name: state.recipeName,
        beverageType: state.beverageType,
        targetStyle: state.beverageType === 'Beer' && currentSelectedStyle ? currentSelectedStyle.name : state.targetStyle,
        expectedBatchSizeLiters: state.batchSizeLiters,
        targetOriginalGravity: recipeDetails.og,
        targetFinalGravity: state.targetFg,
        targetAbv: recipeDetails.abv,
        targetIbu: state.beverageType === 'Beer' ? recipeDetails.ibu : undefined,
        targetColorEbc: state.beverageType === 'Beer' ? recipeDetails.ebc : undefined,
        ingredients: formattedIngredients,
        steps: formattedSteps,
        createdBy: userId
      };

      let savedRecipe;
      if (state.editingRecipeId) {
        savedRecipe = await updateRecipe(state.editingRecipeId, recipeData);
      } else {
        savedRecipe = await saveRecipe(recipeData);
      }

      setAiProposedIngredients([]);
      setAiProposedSteps([]);
      state.resetForm();
      
      if (savedRecipe && savedRecipe.id) {
        navigate(`/recipes/${savedRecipe.id}`);
      } else {
        state.setView('list'); 
      }

    } catch (error) {
      console.error('Failed to save recipe:', error);
    } finally { 
      state.setIsSaving(false); 
    }
  };

  // УСЛОВИЯ РАННЕГО ВЫХОДА (ТЕПЕРЬ ПОСЛЕ ВСЕХ ХУКОВ)
  if (!activeBrewery) {
    return (
      <div className="recipe-lab">
        <div className="recipe-lab__empty-state">
          <p className="recipe-lab__empty-text">{t('Please select or create a brewery to manage recipes.')}</p>
        </div>
      </div>
    );
  }

  if (state.view === 'list') {
    return <RecipeListView recipes={recipes || []} isLoading={isRecipesLoading} onCreate={() => state.setView('builder')} />;
  }

  return (
    <div className="recipe-lab">
      {state.activeIngredientCategory && (
        <IngredientEditorModal
          isOpen={true}
          initialData={editingIngredientData}
          onClose={() => {
            state.setActiveIngredientCategory(null);
            setEditingIngredientId(null);
          }}
          onSave={(data: EditedIngredientData) => {
            if (editingIngredientId) {
              state.updateIngredient(editingIngredientId, { ...data, showNote: !!data.note });
            } else {
              state.setRecipeIngredients(prev => [...(prev || []), { id: crypto.randomUUID(), ...data, showNote: !!data.note } as unknown as RecipeIngredientEntry]);
            }
            state.setActiveIngredientCategory(null);
            setEditingIngredientId(null);
          }}
          catalog={state.globalCatalog || []}
          category={state.activeIngredientCategory}
          initialQuery={state.modalInitialQuery}
          initialAdditiveType={state.modalInitialAdditiveType}
          onIngredientCreated={(newIng) => state.setGlobalCatalog(prev => [...(prev || []), newIng as IngredientUnion])}
        />
      )}

      <StyleSearchModal
        isOpen={state.isStyleModalOpen}
        onClose={() => state.setIsStyleModalOpen(false)}
        onSelect={(id) => { state.setSelectedStyleId(id); state.setIsStyleModalOpen(false); }}
        styles={state.bjcpStyles || []}
        beverageType={state.beverageType}
      />

      <header className="recipe-lab__header">
        <div className="recipe-lab__title-block">
          <h1 className="recipe-lab__title">{state.editingRecipeId ? t('Edit Recipe') : t('Recipe Builder')}</h1>
        </div>
        <button type="button" className="btn-secondary" onClick={state.handleCancel}>{t('Cancel')}</button>
      </header>

      <div className="builder-layout">
        <main className="builder-main">

          <CoreParametersSection
            beverageType={state.beverageType} setBeverageType={state.setBeverageType}
            currentSelectedStyle={currentSelectedStyle} onOpenStyleModal={() => state.setIsStyleModalOpen(true)}
            recipeName={state.recipeName} setRecipeName={state.setRecipeName}
            targetStyle={state.targetStyle} setTargetStyle={state.setTargetStyle}
            batchSizeLiters={state.batchSizeLiters} setBatchSizeLiters={state.setBatchSizeLiters}
            targetFg={state.targetFg} setTargetFg={state.setTargetFg}
          />

          {state.beverageType === 'Mead' && (
            <MeadWizardSection
              wizardStyle={state.wizardStyle} setWizardStyle={state.setWizardStyle}
              wizardSweetness={state.wizardSweetness} setWizardSweetness={state.setWizardSweetness}
              setTargetFg={state.setTargetFg} wizardHoney={state.wizardHoney} setWizardHoney={state.setWizardHoney}
              meadIngredientHint={meadIngredientHint} meadYeastSuggestions={meadYeastSuggestions}
              openIngredientModal={state.openIngredientModal} isGenerating={isGenerating} onGenerate={handleAiGeneration}
            />
          )}

          {state.beverageType === 'Beer' && currentSelectedStyle && (suggestions.hops.length > 0 || suggestions.yeasts.length > 0) && (
            <BeerSuggestionsSection currentSelectedStyle={currentSelectedStyle} suggestions={{ hops: suggestions.hops as BaseIngredient[], yeasts: suggestions.yeasts as BaseIngredient[] }} openIngredientModal={state.openIngredientModal} />
          )}

          <IngredientFormulationSection targetAutoAbv={state.targetAutoAbv} setTargetAutoAbv={state.setTargetAutoAbv} handleAutoCalculateHoney={handleAutoCalculateHoney}>
            {(['Fermentable', 'Honey', 'Hops', 'Yeast', 'Additive'] as IngredientCategory[]).map(cat => {
              const titleMap: Record<string, string> = {
                'Fermentable': t('Fermentables (Malts, Extracts, Sugars)'), 'Honey': t('Honey'), 'Hops': t('Hops'), 'Yeast': t('Yeasts'), 'Additive': t('Additives & Water Chemistry')
              };
              return (
                <IngredientGroup
                  key={cat} category={cat} title={titleMap[cat]} beverageType={state.beverageType}
                  recipeIngredients={state.recipeIngredients || []} aiProposedIngredients={aiProposedIngredients || []}
                  isSaving={state.isSaving} 
                  onOpenModal={state.openIngredientModal} 
                  onUpdateIngredient={state.updateIngredient}
                  onEditIngredient={(id) => {
                    const ing = state.recipeIngredients?.find(i => i.id === id);
                    if (ing) {
                      setEditingIngredientId(id);
                      state.setActiveIngredientCategory(ing.category);
                    }
                  }}
                  onRemoveIngredient={(id) => state.handleRemoveIngredient(id, (id) => setAiProposedIngredients(prev => (prev || []).filter(p => p.ingredientId !== id)))}
                  onAcceptProposal={(proposal) => {
                    state.updateIngredient(proposal.ingredientId, { quantity: proposal.suggestedQuantityGrams, note: proposal.aiNote, showNote: !!proposal.aiNote });
                    setAiProposedIngredients(prev => (prev || []).filter(p => p.ingredientId !== proposal.ingredientId));
                  }}
                  onRejectProposal={(id) => setAiProposedIngredients(prev => (prev || []).filter(p => p.ingredientId !== id))}
                />
              );
            })}
          </IngredientFormulationSection>

          <BrewingStepsEditor
            recipeSteps={state.recipeSteps || []} aiProposedSteps={aiProposedSteps || []} isSaving={state.isSaving}
            onAddStep={state.handleAddStep} onRemoveStep={state.handleRemoveStep} onUpdateStep={state.updateStep}
            onAcceptAllAiSteps={() => { state.setRecipeSteps((aiProposedSteps || []).map(s => ({ ...s, isExpanded: false }))); setAiProposedSteps([]); }}
            onRejectAllAiSteps={() => setAiProposedSteps([])} setAiProposedSteps={setAiProposedSteps}
          />
        </main>

        <RecipeStatsSidebar
          validation={validation}
          currentSelectedStyle={currentSelectedStyle}
          targetFg={state.targetFg}
          recipeDetails={recipeDetails}
          beverageType={state.beverageType}
          isAbvMismatch={isAbvMismatch}
          targetStyle={state.targetStyle}
          updateIngredient={state.updateIngredient}
          handleSaveRecipe={handleSaveRecipe}
          isSaving={state.isSaving}
          recipeName={state.recipeName}
          recipeIngredientsLength={(state.recipeIngredients || []).length}
          editingRecipeId={state.editingRecipeId}
          recipeIngredients={state.recipeIngredients || []}
        />
      </div>
    </div>
  );
};

export default Recipes;