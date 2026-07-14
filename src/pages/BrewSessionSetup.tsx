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
  const result = [...baseSteps];

  if (beverageType === 'Beer') {
    const dryHopIngs = ingredients.filter(i => i.category === 'Hops' && typeof i.additionStage === 'string' && i.additionStage.toLowerCase().includes('dry hop'));
    if (dryHopIngs.length > 0) {
      const hopList = dryHopIngs.map(h => `${h.quantity}g ${h.name}`).join(', ');
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
      setActualVolume(currentRecipe.expectedBatchSizeLiters);
      const rAny = currentRecipe as any;
      const baseStyle = rAny.baseStyle || 'traditional';
      const styleDef = MEAD_STYLES.find(s => s.id === baseStyle);
      const isBoil = styleDef?.boilProtocol?.includes('Boil');
      setPreBoilVolume(isBoil ? Math.round(currentRecipe.expectedBatchSizeLiters * 1.15 * 10) / 10 : currentRecipe.expectedBatchSizeLiters);
      setSessionIngredients(currentRecipe.ingredients);
    }
  }, [currentRecipe]);

  const handleScaleVolume = (newVolume: number) => {
    if (!currentRecipe || newVolume <= 0) return;
    const scaleFactor = newVolume / currentRecipe.expectedBatchSizeLiters;
    setActualVolume(newVolume);
    const rAny = currentRecipe as any;
    const baseStyle = rAny.baseStyle || 'traditional';
    const styleDef = MEAD_STYLES.find(s => s.id === baseStyle);
    const isBoil = styleDef?.boilProtocol?.includes('Boil');
    setPreBoilVolume(Math.round(newVolume * (isBoil ? 1.15 : 1) * 10) / 10);
    setSessionIngredients(currentRecipe.ingredients.map(ing => ({ ...ing, quantity: Math.round(ing.quantity * scaleFactor * 10) / 10 })));
  };

  const handleIngredientChange = (ingredientId: string, newQuantity: number) => {
    setSessionIngredients(prev => prev.map(ing => ing.id === ingredientId ? { ...ing, quantity: newQuantity } : ing));
  };

  const sessionDetails = useMemo(() => {
    let totalFermentableGrams = 0;
    let totalWeightedBrix = 0;
    let nitrogenDemand: string = 'Medium';
    let hasYeast = false;

    sessionIngredients.forEach(item => {
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
    const estimatedOg = estimateOG(actualVolume, totalFermentableGrams, avgBrix);
    const targetFg = currentRecipe?.targetFinalGravity || 1.000;
    const estimatedAbv = calculateAbvCrouch(estimatedOg, targetFg);

    let tosnaData = null;
    if (hasYeast && estimatedOg > 1.000 && currentRecipe?.beverageType === 'Mead') {
      let nFactor = 0.90;
      if (nitrogenDemand === 'Low') nFactor = 0.75;
      else if (nitrogenDemand === 'High' || nitrogenDemand === 'Very High') nFactor = 1.25;
      tosnaData = calculateTosna(actualVolume, estimatedOg, nFactor);
    }

    return { og: estimatedOg, abv: estimatedAbv, fg: targetFg, tosna: tosnaData };
  }, [sessionIngredients, actualVolume, currentRecipe]);

  const handleStartSession = async () => {
    if (!currentRecipe || !activeBreweryId) return;
    setIsStarting(true);
    try {
      const mapped = sessionIngredients.map(i => {
        const invMatch = inventory.find(inv => inv.ingredientId === i.globalIngredientId);
        return {
          globalIngredientId: i.globalIngredientId,
          inventoryItemId: invMatch ? invMatch.id : undefined,
          quantity: i.quantity
        };
      });

      const consumed = await consumeIngredients(activeBreweryId, mapped);
      if (!consumed) throw new Error('Inventory consumption failed.');

      const smartSteps = generateSmartSteps(currentRecipe.steps, currentRecipe.beverageType, sessionIngredients, t);
      
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
          recipe_name: currentRecipe.name,
          beverage_type: currentRecipe.beverageType,
          status: 'Brew Day', 
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
      navigate(`/brew/${sessionData.id}`);
    } catch (err) {
      console.error(err);
      alert(t('Failed to start session. Check your stock.'));
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) return <div className="global-loader"><div className="spinner"></div></div>;
  if (!currentRecipe) return <div className="home-empty">{t('Recipe not found')}</div>;

  const boilOffAmount = Math.max(0, preBoilVolume - actualVolume).toFixed(1);

  return (
    <div className="home">
      <header className="home__header brew-setup__header">
        <div className="brew-setup__title-block">
          <h1 className="home__title">{t('Brew Day Setup')}</h1>
          <p className="home__subtitle">{t('Recipe')}: {currentRecipe.name}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate(`/recipes/${currentRecipe.id}`)}>{t('Cancel')}</button>
      </header>

      <div className="home__grid brew-setup__grid">
        <div className="brew-setup__column">
          
          <div className="home-card">
            <div className="home-card__header">
              <h2 className="home-card__title"><FaSlidersH className="brew-setup__icon" /> {t('Volume & Scaling')}</h2>
            </div>
            <div className="home-card__list">
              <div className="setup-form-group">
                <label className="setup-form-label">{t('Target Fermenter Volume (L)')}</label>
                <input type="number" step="0.5" className="setup-form-input" value={actualVolume || ''} onChange={(e) => handleScaleVolume(parseFloat(e.target.value) || 0)} disabled={isStarting} />
              </div>
              <div className="setup-form-group">
                <label className="setup-form-label"><FaWater className="brew-setup__icon-water" /> {t('Pre-boil Volume (L)')}</label>
                <input type="number" step="0.5" className="setup-form-input" value={preBoilVolume || ''} onChange={(e) => setPreBoilVolume(parseFloat(e.target.value) || 0)} disabled={isStarting} />
                <span className="setup-form-hint">{t('Estimated boil-off')}: {boilOffAmount} {t('L')}</span>
              </div>
            </div>
          </div>

          <div className="home-card">
            <div className="home-card__header">
              <h2 className="home-card__title">{t('Review Ingredients')}</h2>
            </div>
            <div className="home-card__list">
              {sessionIngredients.map(ing => (
                <div key={ing.id} className="setup-ingredient-row">
                  <div className="setup-ingredient-info">
                    <span className="setup-ingredient-category">{t(`constants.categories.${ing.category.toLowerCase().replace(' ', '_')}`)}</span>
                    <strong className="setup-ingredient-name">{ing.name}</strong>
                  </div>
                  <div className="setup-ingredient-actions">
                    <input type="number" className="setup-form-input setup-form-input--small" value={ing.quantity} onChange={(e) => handleIngredientChange(ing.id, parseFloat(e.target.value) || 0)} disabled={isStarting} />
                    <span className="setup-ingredient-unit">{t('constants.units.g')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="brew-setup__column">
          <button type="button" className="btn-primary brew-setup__btn-start" onClick={handleStartSession} disabled={isStarting}>
            <FaPlay className="brew-setup__icon" /> {isStarting ? t('Starting...') : t('Start Brew Day')}
          </button>

          {(sessionDetails.tosna || sessionIngredients.some(i => i.category === 'Hops' && i.additionStage?.toLowerCase().includes('dry hop'))) && (
            <div className="home-card home-card--success">
              <div className="home-card__header home-card__header--transparent">
                <h2 className="home-card__title home-card__title--success">✨ {t('Smart Tracker Activated')}</h2>
              </div>
              <div className="home-card__list">
                <ul className="setup-smart-list">
                  {sessionDetails.tosna && (
                    <li>{t('TOSNA 3.0 tracker will activate during Fermentation.')}</li>
                  )}
                  {sessionIngredients.some(i => i.category === 'Hops' && i.additionStage?.toLowerCase().includes('dry hop')) && (
                    <li>{t('Dry Hop Addition')}</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <div className="home-card">
            <div className="home-card__header"><h2 className="home-card__title">{t('Dynamic Specifications')}</h2></div>
            <div className="home-card__list brew-setup__specs">
              <div className="setup-spec-row"><span className="setup-spec-label">{t('Target Style')}</span><strong className="setup-spec-value">{t(currentRecipe.targetStyle || '')}</strong></div>
              <div className="setup-spec-row"><span className="setup-spec-label">{t('Estimated OG')}</span><strong className="setup-spec-value">{sessionDetails.og.toFixed(3)}</strong></div>
              <div className="setup-spec-row"><span className="setup-spec-label">{t('Target FG')}</span><strong className="setup-spec-value">{sessionDetails.fg.toFixed(3)}</strong></div>
              <div className="setup-spec-row"><span className="setup-spec-label">{t('Estimated ABV')}</span><strong className="setup-spec-value setup-spec-value--highlight">{sessionDetails.abv.toFixed(1)}%</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrewSessionSetup;