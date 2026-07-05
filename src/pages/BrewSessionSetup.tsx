// src/pages/BrewSessionSetup.tsx
import { calculateAbvCrouch, calculateOneThirdSugarBreak, calculateTosna, estimateOG } from '@mead-tracker/math';
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

const generateSmartSteps = (baseSteps: RecipeStep[], beverageType: string, ingredients: any[], tosna: any | null, estimatedOg: number, t: any): RecipeStep[] => {
  const result = [...baseSteps];

  if (beverageType === 'Mead' && tosna) {
    const nutrientIng = ingredients.find(i => i.category === 'Additive' && i.additiveType === 'Nutrient' && !i.name?.toLowerCase().includes('go-ferm'));
    const nutrientName = nutrientIng?.name || 'Fermaid-O';

    const tosnaSteps: RecipeStep[] = [
      { id: crypto.randomUUID(), stepNumber: 0, phase: 'Fermentation', title: `${t('constants.actions.tosna')} 1 (24h)`, description: t('Add {{amount}}g of {{nutrient}}. Rehydrate in ~50ml of must, stir gently to degas before adding.', { amount: tosna.dosePerAdditionGrams, nutrient: nutrientName }), durationValue: 1, durationUnit: 'days', targetTempC: null },
      { id: crypto.randomUUID(), stepNumber: 0, phase: 'Fermentation', title: `${t('constants.actions.tosna')} 2 (48h)`, description: t('Add {{amount}}g of {{nutrient}}. Degas before and after addition.', { amount: tosna.dosePerAdditionGrams, nutrient: nutrientName }), durationValue: 1, durationUnit: 'days', targetTempC: null },
      { id: crypto.randomUUID(), stepNumber: 0, phase: 'Fermentation', title: `${t('constants.actions.tosna')} 3 (72h)`, description: t('Add {{amount}}g of {{nutrient}}. Continue degassing daily.', { amount: tosna.dosePerAdditionGrams, nutrient: nutrientName }), durationValue: 1, durationUnit: 'days', targetTempC: null },
      { id: crypto.randomUUID(), stepNumber: 0, phase: 'Fermentation', title: `${t('constants.actions.tosna')} 4 (1/3 Sugar Break)`, description: t('Add {{amount}}g of {{nutrient}} when gravity reaches {{sg}}. This is the final nutrient addition.', { amount: tosna.dosePerAdditionGrams, nutrient: nutrientName, sg: calculateOneThirdSugarBreak(estimatedOg).toFixed(3) }), durationValue: 1, durationUnit: 'days', targetTempC: null }
    ];
    result.push(...tosnaSteps);
  }

  if (beverageType === 'Beer') {
    const dryHopIngs = ingredients.filter(i => i.category === 'Hops' && typeof i.additionStage === 'string' && i.additionStage.toLowerCase().includes('dry hop'));
    if (dryHopIngs.length > 0) {
      const hopList = dryHopIngs.map(h => `${h.quantity}g ${h.name}`).join(', ');
      result.push({ id: crypto.randomUUID(), stepNumber: 0, phase: 'Fermentation', title: t('Dry Hop Addition'), description: t('Add {{hops}}. Transfer to secondary or add directly to fermenter after primary fermentation is 80% complete. Leave for 3-5 days.', { hops: hopList }), durationValue: 4, durationUnit: 'days', targetTempC: null });
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
  const { consumeIngredients } = useInventoryStore();
  
  const [actualVolume, setActualVolume] = useState<number>(10);
  const [preBoilVolume, setPreBoilVolume] = useState<number>(10);
  const [sessionIngredients, setSessionIngredients] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    fetchRecipeById(id);
  }, [id, fetchRecipeById]);

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
      } else if (item.category === 'Yeast') {
        hasYeast = true;
        if (item.nitrogenDemand) nitrogenDemand = item.nitrogenDemand;
      }
    });

    const avgBrix = totalFermentableGrams > 0 ? totalWeightedBrix / totalFermentableGrams : 80;
    const estimatedOg = estimateOG(actualVolume, totalFermentableGrams, avgBrix);
    const targetFg = currentRecipe?.targetFinalGravity || 1.000;
    const estimatedAbv = calculateAbvCrouch(estimatedOg, targetFg);

    let tosnaData = null;
    if (hasYeast && estimatedOg > 1.000) {
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
      const mapped = sessionIngredients.map(i => ({ globalIngredientId: i.globalIngredientId, quantity: i.quantity }));
      const consumed = await consumeIngredients(activeBreweryId, mapped);
      if (!consumed) throw new Error('Inventory consumption failed');

      const smartSteps = generateSmartSteps(currentRecipe.steps, currentRecipe.beverageType, sessionIngredients, sessionDetails.tosna, sessionDetails.og, t);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      
      // Возвращаем старые названия колонок и статус, чтобы избежать ошибки PGRST204
      const { data: sessionData, error } = await supabase
        .from('brew_sessions')
        .insert([{
          recipe_id: currentRecipe.id,
          brewery_id: activeBreweryId,
          recipe_name: currentRecipe.name,
          beverage_type: currentRecipe.beverageType,
          status: 'planned', 
          batch_size_liters: actualVolume,
          target_og: sessionDetails.og,
          target_fg: sessionDetails.fg,
          session_ingredients: sessionIngredients,
          session_steps: smartSteps,
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
  if (!currentRecipe) return <div>{t('Recipe not found')}</div>;

  const boilOffAmount = Math.max(0, preBoilVolume - actualVolume).toFixed(1);

  return (
    <div className="home">
      <header className="home__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="home__title">{t('Brew Day Setup')}</h1>
          <p className="home__subtitle">{t('Recipe')}: {currentRecipe.name}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate(`/recipes/${currentRecipe.id}`)}>{t('Cancel')}</button>
      </header>

      <div className="home__grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="home-card">
            <div className="home-card__header">
              <h2 className="home-card__title"><FaSlidersH style={{ marginRight: '8px' }}/> {t('Volume & Scaling')}</h2>
            </div>
            <div className="home-card__list">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{t('Target Fermenter Volume (L)')}</label>
                <input type="number" step="0.5" value={actualVolume || ''} onChange={(e) => handleScaleVolume(parseFloat(e.target.value) || 0)} disabled={isStarting} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}><FaWater style={{ color: 'var(--color-primary)' }}/> {t('Pre-boil Volume (L)')}</label>
                <input type="number" step="0.5" value={preBoilVolume || ''} onChange={(e) => setPreBoilVolume(parseFloat(e.target.value) || 0)} disabled={isStarting} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('Estimated boil-off')}: {boilOffAmount} {t('L')}</span>
              </div>
            </div>
          </div>

          <div className="home-card">
            <div className="home-card__header">
              <h2 className="home-card__title">{t('Review Ingredients')}</h2>
            </div>
            <div className="home-card__list">
              {sessionIngredients.map(ing => (
                <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block' }}>{t(`constants.categories.${ing.category.toLowerCase().replace(' ', '_')}`)}</span>
                    <strong>{ing.name}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="number" value={ing.quantity} onChange={(e) => handleIngredientChange(ing.id, parseFloat(e.target.value) || 0)} disabled={isStarting} style={{ width: '80px', padding: '4px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                    <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{t('constants.units.g')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <button type="button" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleStartSession} disabled={isStarting}>
            <FaPlay style={{ marginRight: '8px' }} /> {isStarting ? t('Starting...') : t('Start Brew Day')}
          </button>

          {(sessionDetails.tosna || sessionIngredients.some(i => i.category === 'Hops' && i.additionStage?.toLowerCase().includes('dry hop'))) && (
            <div className="home-card" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <div className="home-card__header" style={{ backgroundColor: 'transparent', borderBottom: 'none', paddingBottom: '0' }}>
                <h2 className="home-card__title" style={{ color: 'var(--color-success)' }}>✨ {t('Smart Steps will be added')}</h2>
              </div>
              <div className="home-card__list" style={{ fontSize: '0.9rem' }}>
                <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-secondary)' }}>
                  {sessionDetails.tosna && (
                    <>
                      <li>{t('constants.actions.tosna')} 1 — 24h</li>
                      <li>{t('constants.actions.tosna')} 2 — 48h</li>
                      <li>{t('constants.actions.tosna')} 3 — 72h</li>
                      <li>{t('constants.actions.tosna')} 4 — 1/3 Sugar Break</li>
                    </>
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
            <div className="home-card__list" style={{ gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Target Style')}</span><strong>{t(currentRecipe.targetStyle || '')}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Estimated OG')}</span><strong>{sessionDetails.og.toFixed(3)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Target FG')}</span><strong>{sessionDetails.fg.toFixed(3)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('Estimated ABV')}</span><strong style={{ color: 'var(--color-primary)' }}>{sessionDetails.abv.toFixed(1)}%</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrewSessionSetup;