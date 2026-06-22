import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlay, FaSlidersH, FaWater } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase/config';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useRecipeStore } from '../store/useRecipeStore';
import type { BaseIngredient, HoneyIngredient, YeastIngredient } from '../types/ingredient';
import type { BrewSession } from '../types/session';
import { calculateAbvCrouch, calculateOneThirdSugarBreak, calculateTosna, estimateOG } from '../utils/calculations';
import { MEAD_STYLES } from '../utils/meadConstants';

const BrewSessionSetup: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { currentRecipe, fetchRecipeById, isLoading } = useRecipeStore();
  const { consumeIngredients } = useInventoryStore();
  
  const [globalCatalog, setGlobalCatalog] = useState<BaseIngredient[]>([]);
  
  const [actualVolume, setActualVolume] = useState<number>(10);
  const [preBoilVolume, setPreBoilVolume] = useState<number>(10);
  const [sessionIngredients, setSessionIngredients] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    fetchRecipeById(id);
  }, [id, fetchRecipeById]);

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
        console.error('Failed to fetch global ingredient catalog');
      }
    };
    fetchCatalog();
  }, []);

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
    
    const scaledIngredients = currentRecipe.ingredients.map(ing => ({
      ...ing,
      quantity: Math.round(ing.quantity * scaleFactor * 10) / 10
    }));
    
    setSessionIngredients(scaledIngredients);
  };

  const handleIngredientChange = (ingredientId: string, newQuantity: number) => {
    setSessionIngredients(prev => 
      prev.map(ing => ing.id === ingredientId ? { ...ing, quantity: newQuantity } : ing)
    );
  };

  const sessionDetails = useMemo(() => {
    let totalHoneyGrams = 0;
    let averageBrix = 80;
    let selectedYeast: YeastIngredient | null = null;
    let totalWeightedBrix = 0;

    sessionIngredients.forEach(item => {
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
      }
    });

    if (totalHoneyGrams > 0) {
      averageBrix = totalWeightedBrix / totalHoneyGrams;
    }

    const estimatedOg = estimateOG(actualVolume, totalHoneyGrams, averageBrix);
    const targetFg = currentRecipe?.targetFinalGravity || 1.000;
    const estimatedAbv = calculateAbvCrouch(estimatedOg, targetFg);

    let tosnaData = null;
    if (selectedYeast && estimatedOg > 1.000) {
      const yeast = selectedYeast as YeastIngredient;
      let nFactor = 0.90;
      if (yeast.nitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeast.nitrogenDemand === 'High' || yeast.nitrogenDemand === 'Very High') nFactor = 1.25;

      tosnaData = calculateTosna(actualVolume, estimatedOg, nFactor);
    }

    return { og: estimatedOg, abv: estimatedAbv, fg: targetFg, tosna: tosnaData };
  }, [sessionIngredients, actualVolume, globalCatalog, currentRecipe]);

  const handleStartSession = async () => {
    if (!currentRecipe || !db || !activeBreweryId || !auth.currentUser) return;
    
    setIsStarting(true);
    try {
      const mappedIngredients = sessionIngredients.map(i => ({
        globalIngredientId: i.globalIngredientId,
        quantity: i.quantity
      }));
      const success = await consumeIngredients(activeBreweryId, mappedIngredients);

      if (!success) {
        throw new Error('Inventory consumption failed');
      }

      const sessionId = crypto.randomUUID();
      const newSession: BrewSession = {
        id: sessionId,
        recipeId: currentRecipe.id,
        breweryId: activeBreweryId,
        recipeName: currentRecipe.name,
        status: 'planned',
        startDate: new Date().toISOString(),
        completedDate: null,
        batchSizeLiters: actualVolume,
        targetOg: currentRecipe.targetOriginalGravity,
        targetFg: currentRecipe.targetFinalGravity,
        
        sessionIngredients: sessionIngredients.map(ing => ({ ...ing })),
        sessionSteps: currentRecipe.steps.map(step => ({ ...step })),
        
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
      };

      const sessionRef = doc(db, `breweries/${activeBreweryId}/brew_sessions`, sessionId);
      await setDoc(sessionRef, newSession);
      navigate(`/brew/${sessionId}`);
      
    } catch {
      alert(t('Failed to start session. Check your stock.'));
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return <div className="brew-session-setup__loading">{t('Preparing session...')}</div>;
  }

  if (!currentRecipe) {
    return (
      <div className="brew-session-setup brew-session-setup--empty">
        <h2 className="brew-session-setup__header-title">{t('Recipe not found')}</h2>
        <button type="button" className="brew-session-setup__btn brew-session-setup__btn--secondary" onClick={() => navigate('/recipes')}>
          {t('Back to list')}
        </button>
      </div>
    );
  }

  const boilOffAmount = Math.max(0, preBoilVolume - actualVolume).toFixed(1);

  return (
    <div className="brew-session-setup">
      <header className="brew-session-setup__header">
        <div>
          <h1 className="brew-session-setup__header-title">{t('Brew Day Setup')}</h1>
          <span className="brew-session-setup__header-subtitle">{t('Recipe')}: {currentRecipe.name}</span>
        </div>
        <button type="button" className="brew-session-setup__btn brew-session-setup__btn--secondary" onClick={() => navigate(`/recipes/${currentRecipe.id}`)}>
          {t('Cancel')}
        </button>
      </header>

      <div className="brew-session-setup__grid">
        <div className="brew-session-setup__main-column">
          
          <div className="brew-session-setup__card brew-session-setup__card--volume">
            <h3 className="brew-session-setup__card-title">
              <FaSlidersH /> {t('Volume & Scaling')}
            </h3>
            
            <div className="brew-session-setup__form-row">
              <div className="brew-session-setup__form-group">
                <label className="brew-session-setup__label">{t('Target Fermenter Volume (L)')}</label>
                <input 
                  type="number" 
                  step="0.5"
                  className="brew-session-setup__input brew-session-setup__input--primary"
                  value={actualVolume || ''} 
                  onChange={(e) => handleScaleVolume(parseFloat(e.target.value) || 0)}
                  disabled={isStarting}
                />
                <span className="brew-session-setup__hint">
                  {t('Changing this will auto-scale all ingredients below.')}
                </span>
              </div>
              
              <div className="brew-session-setup__form-group">
                <label className="brew-session-setup__label">
                  <FaWater className="brew-session-setup__icon--water" /> {t('Pre-boil Volume (L)')}
                </label>
                <input 
                  type="number" 
                  step="0.5"
                  className="brew-session-setup__input"
                  value={preBoilVolume || ''} 
                  onChange={(e) => setPreBoilVolume(parseFloat(e.target.value) || 0)}
                  disabled={isStarting}
                />
                <span className="brew-session-setup__hint brew-session-setup__hint--highlight">
                  {t('Estimated boil-off')}: {boilOffAmount} {t('L')}
                </span>
              </div>
            </div>
          </div>

          <div className="brew-session-setup__card">
            <div className="brew-session-setup__card-title brew-session-setup__card-title--static">
              <h3 className="brew-session-setup__header-title">{t('Review Ingredients')}</h3>
            </div>
            <p className="brew-session-setup__card-subtitle">
              {t('You can manually adjust the scaled quantities based on what you actually have on hand.')}
            </p>
            
            <div className="brew-session-setup__ingredients-list">
              {sessionIngredients.map(ing => (
                <div key={ing.id} className="brew-session-setup__ingredient-item">
                  <div>
                    <span className="brew-session-setup__category" data-category={ing.category}>
                      {t(ing.category)}
                    </span>
                    <strong>{ing.name}</strong>
                  </div>
                  <div className="brew-session-setup__ingredient-controls">
                    <input 
                      type="number"
                      className="brew-session-setup__quantity-input"
                      value={ing.quantity}
                      onChange={(e) => handleIngredientChange(ing.id, parseFloat(e.target.value) || 0)}
                      disabled={isStarting}
                    />
                    <span className="brew-session-setup__unit">{t('g')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="brew-session-setup__side-column">
          
          <button 
            type="button"
            className="brew-session-setup__btn brew-session-setup__btn--action" 
            onClick={handleStartSession}
            disabled={isStarting}
          >
            <FaPlay /> {isStarting ? t('Starting...') : t('Start Brew Day')}
          </button>

          <div className="brew-session-setup__card">
            <h3 className="brew-session-setup__card-title">{t('Dynamic Specifications')}</h3>
            <div className="brew-session-setup__spec-list">
              <div className="brew-session-setup__spec-row">
                <span className="brew-session-setup__spec-label">{t('Target Style')}</span>
                <span className="brew-session-setup__spec-value">{t(currentRecipe.targetStyle)}</span>
              </div>
              <div className="brew-session-setup__spec-row">
                <span className="brew-session-setup__spec-label">{t('Estimated OG')}</span>
                <span className="brew-session-setup__spec-value">{sessionDetails.og.toFixed(3)}</span>
              </div>
              <div className="brew-session-setup__spec-row">
                <span className="brew-session-setup__spec-label">{t('Target Final Gravity')}</span>
                <span className="brew-session-setup__spec-value">{sessionDetails.fg.toFixed(3)}</span>
              </div>
              <div className="brew-session-setup__spec-row">
                <span className="brew-session-setup__spec-label">{t('Estimated ABV')}</span>
                <span className="brew-session-setup__spec-value brew-session-setup__spec-value--accent">{sessionDetails.abv.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="brew-session-setup__card">
            <h3 className="brew-session-setup__card-title">{t('TOSNA 3.0 Guide')}</h3>
            {!sessionDetails.tosna ? (
              <div className="brew-session-setup__empty-text">{t('No yeast added')}</div>
            ) : (
              <>
                <div className="brew-session-setup__tosna-summary">
                  <div className="brew-session-setup__tosna-row">
                    <span className="brew-session-setup__spec-label">{t('Required Yeast')}</span>
                    <strong className="brew-session-setup__spec-value">{sessionDetails.tosna.totalYeastGrams} g</strong>
                  </div>
                  <div className="brew-session-setup__tosna-row">
                    <span className="brew-session-setup__spec-label">{t('Go-Ferm')}</span>
                    <strong className="brew-session-setup__spec-value">{sessionDetails.tosna.goFermGrams} g</strong>
                  </div>
                  <div className="brew-session-setup__tosna-row">
                    <span className="brew-session-setup__spec-label">{t('Total Fermaid-O')}</span>
                    <strong className="brew-session-setup__spec-value">{sessionDetails.tosna.totalFermaidOGrams} g</strong>
                  </div>
                </div>

                <div className="brew-session-setup__schedule">
                  <h4 className="brew-session-setup__schedule-title">{t('Feeding Schedule')}</h4>
                  <ul className="brew-session-setup__schedule-list">
                    <li className="brew-session-setup__schedule-item">
                      <span>{t('Addition 1')} ({t('24h')}):</span>
                      <strong className="brew-session-setup__step-value">{sessionDetails.tosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li className="brew-session-setup__schedule-item">
                      <span>{t('Addition 2')} ({t('48h')}):</span>
                      <strong className="brew-session-setup__step-value">{sessionDetails.tosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li className="brew-session-setup__schedule-item">
                      <span>{t('Addition 3')} ({t('72h')}):</span>
                      <strong className="brew-session-setup__step-value">{sessionDetails.tosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li className="brew-session-setup__schedule-item">
                      <span>{t('Addition 4')} ({t('1/3 Sugar Break')}):</span>
                      <strong className="brew-session-setup__step-value">{sessionDetails.tosna.dosePerAdditionGrams} g</strong>
                      <span className="brew-session-setup__step-hint">
                        {t('Target SG for final addition')}: {calculateOneThirdSugarBreak(sessionDetails.og).toFixed(3)}
                      </span>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrewSessionSetup;