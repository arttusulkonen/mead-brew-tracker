// src/pages/BrewSessionSetup.tsx
import { calculateAbvCrouch, calculateTosna, estimateOG } from '@mead-tracker/math';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlay, FaSlidersH, FaWater } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { supabase } from '../supabase/client';
import type { RecipeStep } from '../types/recipe';
import { MEAD_STYLES } from '../utils/meadConstants';

const generateSmartSteps = (baseSteps: RecipeStep[], beverageType: string, ingredients: any[], t: any): RecipeStep[] => {
  const safeBaseSteps = baseSteps || [];
  const safeIngredients = ingredients || [];
  const result = [...safeBaseSteps];

  if (beverageType === 'Beer') {
    const dryHopIngs = safeIngredients.filter(i => i?.category === 'Hops' && typeof i?.additionStage === 'string' && i.additionStage.toLowerCase().includes('dry hop'));
    if (dryHopIngs.length > 0) {
      const hopList = dryHopIngs.map(h => `${h.quantity || 0}g ${h.name || 'Hops'}`).join(', ');
      result.push({ 
        id: crypto.randomUUID(), 
        stepNumber: 0, 
        phase: 'Fermentation', 
        title: t('Dry Hop Addition'), 
        description: t('Add {{hops}}. Transfer to secondary or add directly to fermenter after primary fermentation is 80% complete. Leave for 3-5 days.', { hops: hopList }), 
        durationValue: 4, 
        durationUnit: 'days', 
        targetTempC: null 
      });
    }
  }

  return result.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
};

const BrewSessionSetup: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { currentRecipe, fetchRecipeById, isLoading } = useRecipeStore();
  const { inventory, consumeIngredients, fetchInventory } = useInventoryStore();
  
  const [actualVolume, setActualVolume] = useState<number>(10);
  const [preBoilVolume, setPreBoilVolume] = useState<number>(10);
  const [sessionIngredients, setSessionIngredients] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    fetchRecipeById(id);
    if (activeBreweryId) fetchInventory(activeBreweryId);
  }, [id, activeBreweryId, fetchRecipeById, fetchInventory]);

  useEffect(() => {
    if (currentRecipe) {
      const safeVolume = currentRecipe.expectedBatchSizeLiters || 10;
      setActualVolume(safeVolume);
      const rAny = currentRecipe as any;
      const baseStyle = rAny.baseStyle || 'traditional';
      const styleDef = (MEAD_STYLES || []).find(s => s.id === baseStyle);
      const isBoil = styleDef?.boilProtocol?.includes('Boil');
      setPreBoilVolume(isBoil ? Math.round(safeVolume * 1.15 * 10) / 10 : safeVolume);
      setSessionIngredients(currentRecipe.ingredients || []);
    }
  }, [currentRecipe]);

  const handleScaleVolume = (newVolume: number) => {
    if (!currentRecipe || newVolume <= 0) return;
    const safeBaseVolume = currentRecipe.expectedBatchSizeLiters || 1;
    const scaleFactor = newVolume / safeBaseVolume;
    setActualVolume(newVolume);
    const rAny = currentRecipe as any;
    const baseStyle = rAny.baseStyle || 'traditional';
    const styleDef = (MEAD_STYLES || []).find(s => s.id === baseStyle);
    const isBoil = styleDef?.boilProtocol?.includes('Boil');
    setPreBoilVolume(Math.round(newVolume * (isBoil ? 1.15 : 1) * 10) / 10);
    setSessionIngredients((currentRecipe.ingredients || []).map(ing => ({ ...ing, quantity: Math.round((ing.quantity || 0) * scaleFactor * 10) / 10 })));
  };

  const handleIngredientChange = (ingredientId: string, newQuantity: number) => {
    setSessionIngredients(prev => (prev || []).map(ing => ing.id === ingredientId ? { ...ing, quantity: newQuantity } : ing));
  };

  const sessionDetails = useMemo(() => {
    let totalFermentableGrams = 0;
    let totalWeightedBrix = 0;
    let nitrogenDemand: string = 'Medium';
    let hasYeast = false;

    (sessionIngredients || []).forEach(item => {
      if (!item) return;
      if (item.category === 'Honey') {
        const brix = item.sugarContentBrix || 80;
        const qty = item.quantity || 0;
        totalFermentableGrams += qty;
        totalWeightedBrix += brix * qty;
      } else if (item.category === 'Fermentable') {
        const brix = item.yieldPpg ? (item.yieldPpg / 46) * 100 : 80;
        const qty = item.quantity || 0;
        totalFermentableGrams += qty;
        totalWeightedBrix += brix * qty;
      } else if (item.category === 'Yeast' || (item.name || '').toLowerCase().includes('yeast') || (item.name || '').toLowerCase().includes('дрожж')) {
        hasYeast = true;
        if (item.nitrogenDemand) nitrogenDemand = item.nitrogenDemand;
      }
    });

    const avgBrix = totalFermentableGrams > 0 ? totalWeightedBrix / totalFermentableGrams : 80;
    const safeVolume = actualVolume || 1;
    const estimatedOg = estimateOG(safeVolume, totalFermentableGrams, avgBrix);
    const targetFg = currentRecipe?.targetFinalGravity || 1.000;
    const estimatedAbv = calculateAbvCrouch(estimatedOg, targetFg);

    let tosnaData = null;
    if (hasYeast && estimatedOg > 1.000 && currentRecipe?.beverageType === 'Mead') {
      let nFactor = 0.90;
      if (nitrogenDemand === 'Low') nFactor = 0.75;
      else if (nitrogenDemand === 'High' || nitrogenDemand === 'Very High') nFactor = 1.25;
      tosnaData = calculateTosna(safeVolume, estimatedOg, nFactor);
    }

    return { og: estimatedOg, abv: estimatedAbv, fg: targetFg, tosna: tosnaData };
  }, [sessionIngredients, actualVolume, currentRecipe]);

  const handleStartSession = async () => {
    if (!currentRecipe || !activeBreweryId) return;
    setIsStarting(true);
    try {
      const safeInventory = inventory || [];
      const mapped = (sessionIngredients || []).map(i => {
        const invMatch = safeInventory.find(inv => inv?.ingredientId === i?.globalIngredientId);
        return {
          globalIngredientId: i.globalIngredientId,
          inventoryItemId: invMatch ? invMatch.id : undefined,
          quantity: i.quantity || 0
        };
      });

      const consumed = await consumeIngredients(activeBreweryId, mapped);
      if (!consumed) throw new Error('Inventory consumption failed.');

      const smartSteps = generateSmartSteps(currentRecipe.steps || [], currentRecipe.beverageType || 'Mead', sessionIngredients || [], t);
      
      let tosnaSchedulePayload = null;
      if (sessionDetails.tosna) {
        tosnaSchedulePayload = {
          ...sessionDetails.tosna,
          additions: [
            { id: crypto.randomUUID(), targetHours: 24, isCompleted: false, completedAt: null },
            { id: crypto.randomUUID(), targetHours: 48, isCompleted: false, completedAt: null },
            { id: crypto.randomUUID(), targetHours: 72, isCompleted: false, completedAt: null },
            { id: crypto.randomUUID(), isOneThirdBreak: true, isCompleted: false, completedAt: null }
          ]
        };
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      
      const { data: sessionData, error } = await supabase
        .from('brew_sessions')
        .insert([{
          recipe_id: currentRecipe.id,
          brewery_id: activeBreweryId,
          recipe_name: currentRecipe.name || 'Unnamed Recipe',
          beverage_type: currentRecipe.beverageType || 'Mead',
          status: 'planned', 
          batch_size_liters: actualVolume,
          target_og: sessionDetails.og,
          target_fg: sessionDetails.fg,
          actual_batch_size_liters: actualVolume, 
          actual_original_gravity: sessionDetails.og, 
          actual_final_gravity: sessionDetails.fg, 
          actual_abv: sessionDetails.abv, 
          session_ingredients: sessionIngredients,
          session_steps: smartSteps,
          tosna_schedule: tosnaSchedulePayload,
          created_by: userId
        }])
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/brew/${sessionData?.id}`);
    } catch (err) {
      console.error(err);
      alert(t('Failed to start session. Check your stock.'));
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) return <div className="brew-session-setup__loading"><div className="spinner"></div></div>;
  if (!currentRecipe) return <div className="brew-session-setup--empty"><p className="brew-session-setup__empty-text">{t('Recipe not found')}</p></div>;

  const safePreBoil = preBoilVolume || 0;
  const safeActual = actualVolume || 0;
  const boilOffAmount = Math.max(0, safePreBoil - safeActual).toFixed(1);

  return (
    <div className="brew-session-setup">
      <header className="brew-session-setup__header">
        <div>
          <h1 className="brew-session-setup__header-title">{t('Brew Day Setup')}</h1>
          <p className="brew-session-setup__header-subtitle">{t('Recipe')}: {currentRecipe.name || t('Unknown Recipe')}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate(`/recipes/${currentRecipe.id}`)}>{t('Cancel')}</button>
      </header>

      <div className="brew-session-setup__grid">
        <div className="brew-session-setup__main-column">
          
          <div className="brew-session-setup__card brew-session-setup__card--volume">
            <h2 className="brew-session-setup__card-title">
              <FaSlidersH className="brew-session-setup__icon" /> {t('Volume & Scaling')}
            </h2>
            <div className="brew-session-setup__form-group">
              <label className="brew-session-setup__label">{t('Target Fermenter Volume (L)')}</label>
              <input type="number" step="0.5" className="brew-session-setup__input brew-session-setup__input--primary" value={actualVolume || ''} onChange={(e) => handleScaleVolume(parseFloat(e.target.value) || 0)} disabled={isStarting} />
            </div>
            <div className="brew-session-setup__form-group">
              <label className="brew-session-setup__label">
                <FaWater className="brew-session-setup__icon brew-session-setup__icon--water" /> {t('Pre-boil Volume (L)')}
              </label>
              <input type="number" step="0.5" className="brew-session-setup__input" value={preBoilVolume || ''} onChange={(e) => setPreBoilVolume(parseFloat(e.target.value) || 0)} disabled={isStarting} />
              <span className="brew-session-setup__hint">
                {t('Estimated boil-off')}: <span className="brew-session-setup__hint--highlight">{boilOffAmount}</span> {t('L')}
              </span>
            </div>
          </div>

          <div className="brew-session-setup__card">
            <h2 className="brew-session-setup__card-title">{t('Review Ingredients')}</h2>
            <div className="brew-session-setup__ingredients-list">
              {(sessionIngredients || []).map(ing => (
                <div key={ing.id} className="brew-session-setup__ingredient-item">
                  <div className="brew-session-setup__ingredient-info">
                    <span className="brew-session-setup__category">{t(`constants.categories.${ing.category?.toLowerCase().replace(' ', '_') || 'other'}`, ing.category)}</span>
                    <strong className="brew-session-setup__ingredient-name">{ing.name || t('Unknown')}</strong>
                  </div>
                  <div className="brew-session-setup__ingredient-controls">
                    <input type="number" className="brew-session-setup__quantity-input" value={ing.quantity || ''} onChange={(e) => handleIngredientChange(ing.id, parseFloat(e.target.value) || 0)} disabled={isStarting} />
                    <span className="brew-session-setup__unit">{t('constants.units.g', 'g')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="brew-session-setup__side-column">
          <button type="button" className="brew-session-setup__btn brew-session-setup__btn--action" onClick={handleStartSession} disabled={isStarting}>
            <FaPlay className="brew-session-setup__icon" /> {isStarting ? t('Starting...') : t('Start Brew Day')}
          </button>

          {(sessionDetails.tosna || (sessionIngredients || []).some(i => i?.category === 'Hops' && i?.additionStage?.toLowerCase().includes('dry hop'))) && (
            <div className="brew-session-setup__card">
              <h2 className="brew-session-setup__card-title brew-session-setup__card-title--static">✨ {t('Smart Tracker Activated')}</h2>
              <ul className="brew-session-setup__smart-list">
                {sessionDetails.tosna && (
                  <li>{t('TOSNA 3.0 tracker will activate during Fermentation.')}</li>
                )}
                {(sessionIngredients || []).some(i => i?.category === 'Hops' && i?.additionStage?.toLowerCase().includes('dry hop')) && (
                  <li>{t('Dry Hop Addition')}</li>
                )}
              </ul>
            </div>
          )}

          <div className="brew-session-setup__card">
            <h2 className="brew-session-setup__card-title">{t('Dynamic Specifications')}</h2>
            <div className="brew-session-setup__spec-list">
              <div className="brew-session-setup__spec-row"><span className="brew-session-setup__spec-label">{t('Target Style')}</span><strong className="brew-session-setup__spec-value">{t(currentRecipe.targetStyle || '')}</strong></div>
              <div className="brew-session-setup__spec-row"><span className="brew-session-setup__spec-label">{t('Estimated OG')}</span><strong className="brew-session-setup__spec-value">{(sessionDetails.og || 1.000).toFixed(3)}</strong></div>
              <div className="brew-session-setup__spec-row"><span className="brew-session-setup__spec-label">{t('Target FG')}</span><strong className="brew-session-setup__spec-value">{(sessionDetails.fg || 1.000).toFixed(3)}</strong></div>
              <div className="brew-session-setup__spec-row"><span className="brew-session-setup__spec-label">{t('Estimated ABV')}</span><strong className="brew-session-setup__spec-value brew-session-setup__spec-value--accent">{(sessionDetails.abv || 0).toFixed(1)}%</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrewSessionSetup;