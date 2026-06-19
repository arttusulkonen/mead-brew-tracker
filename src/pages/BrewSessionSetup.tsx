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
import { calculateAbvCrouch, calculateTosna, estimateOG } from '../utils/calculations';

const BrewSessionSetup: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { currentRecipe, fetchRecipeById, isLoading } = useRecipeStore();
  const { consumeIngredients } = useInventoryStore();
  
  const [globalCatalog, setGlobalCatalog] = useState<BaseIngredient[]>([]);
  
  const [actualVolume, setActualVolume] = useState<number>(10);
  const [preBoilVolume, setPreBoilVolume] = useState<number>(12);
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
        // Ошибка молча обрабатывается по правилам линтера (отсутствие заглушек и логов, если не запрошено)
      }
    };
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (currentRecipe) {
      setActualVolume(currentRecipe.expectedBatchSizeLiters);
      setPreBoilVolume(currentRecipe.expectedBatchSizeLiters * 1.2); 
      setSessionIngredients(currentRecipe.ingredients);
    }
  }, [currentRecipe]);

  const handleScaleVolume = (newVolume: number) => {
    if (!currentRecipe || newVolume <= 0) return;
    
    const scaleFactor = newVolume / currentRecipe.expectedBatchSizeLiters;
    
    setActualVolume(newVolume);
    setPreBoilVolume(Math.round(newVolume * 1.2 * 10) / 10);
    
    const scaledIngredients = currentRecipe.ingredients.map(ing => ({
      ...ing,
      quantity: Math.round(ing.quantity * scaleFactor * 100) / 100
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

    return { og: estimatedOg, abv: estimatedAbv, tosna: tosnaData };
  }, [sessionIngredients, actualVolume, globalCatalog, currentRecipe]);

  const handleStartSession = async () => {
    if (!currentRecipe || !db || !activeBreweryId || !auth.currentUser) return;
    
    setIsStarting(true);
    try {
      // 1. Атомарное списание ингредиентов со склада пивоварни
      await consumeIngredients(activeBreweryId, sessionIngredients);

      // 2. Создание документа сессии с глубоким копированием шагов и ингредиентов
      const sessionId = crypto.randomUUID();
      const newSession: BrewSession = {
        id: sessionId,
        breweryId: activeBreweryId,
        recipeId: currentRecipe.id,
        recipeName: currentRecipe.name,
        status: 'planned',
        startDate: new Date().toISOString(),
        completedDate: null,
        batchSizeLiters: actualVolume,
        targetOg: currentRecipe.targetOriginalGravity,
        targetFg: currentRecipe.targetFinalGravity,
        
        // Flight Recorder Snapshot
        sessionIngredients: sessionIngredients.map(ing => ({ ...ing })),
        sessionSteps: currentRecipe.steps.map(step => ({ ...step })),
        
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
      };

      // Сохраняем сессию по новому безопасному пути в базе данных
      const sessionRef = doc(db, `breweries/${activeBreweryId}/brew_sessions`, sessionId);
      await setDoc(sessionRef, newSession);
      navigate(`/brew/${sessionId}`);
      
    } catch {
      alert(t('Failed to start session'));
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
      return <div className="loading-text" style={{ padding: '2rem' }}>{t('Preparing session...')}</div>;
    }

  if (!currentRecipe) {
    return (
      <div className="recipes-page" style={{ padding: '20px', textAlign: 'center' }}>
        <h2>{t('Recipe not found')}</h2>
        <button className="btn-secondary" onClick={() => navigate('/recipes')} style={{ marginTop: '16px' }}>
          {t('Back to list')}
        </button>
      </div>
    );
  }

  const boilOffAmount = Math.max(0, preBoilVolume - actualVolume).toFixed(1);

  return (
    <div className="recipes-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ margin: 0 }}>{t('Brew Day Setup')}</h1>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>{t('Recipe')}: {currentRecipe.name}</span>
        </div>
        <button className="btn-secondary" onClick={() => navigate(`/recipes/${currentRecipe.id}`)}>
          {t('Cancel')}
        </button>
      </header>

      <div className="recipe-grid" style={{ display: 'grid', gap: '24px', gridTemplateColumns: '2fr 1fr', alignItems: 'start', marginTop: '24px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ backgroundColor: '#f0f7ff', border: '1px solid #cce0ff' }}>
            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaSlidersH /> {t('Volume & Scaling')}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ fontWeight: 'bold' }}>{t('Target Fermenter Volume (L)')}</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={actualVolume || ''} 
                  onChange={(e) => handleScaleVolume(parseFloat(e.target.value) || 0)}
                  style={{ border: '2px solid var(--color-primary)' }}
                  disabled={isStarting}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                  {t('Changing this will auto-scale all ingredients below.')}
                </small>
              </div>
              
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                  <FaWater color="#0066cc" /> {t('Pre-boil Volume (L)')}
                </label>
                <input 
                  type="number" 
                  step="0.5"
                  value={preBoilVolume || ''} 
                  onChange={(e) => setPreBoilVolume(parseFloat(e.target.value) || 0)}
                  disabled={isStarting}
                />
                <small style={{ color: '#0066cc', display: 'block', marginTop: '4px', fontWeight: '500' }}>
                  {t('Estimated boil-off')}: {boilOffAmount} {t('L')}
                </small>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>{t('Review Ingredients')}</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '16px' }}>
              {t('You can manually adjust the scaled quantities based on what you actually have on hand.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessionIngredients.map(ing => (
                <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee' }}>
                  <div>
                    <span className="category-tag" data-category={ing.category} style={{ marginRight: '12px', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#eef' }}>{t(ing.category)}</span>
                    <strong style={{ fontSize: '0.95rem' }}>{ing.name}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="number"
                      value={ing.quantity}
                      onChange={(e) => handleIngredientChange(ing.id, parseFloat(e.target.value) || 0)}
                      style={{ width: '80px', padding: '6px', textAlign: 'right' }}
                      disabled={isStarting}
                    />
                    <span style={{ fontWeight: 'bold', color: '#666' }}>{t('g')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#28a745' }}
            onClick={handleStartSession}
            disabled={isStarting}
          >
            <FaPlay /> {isStarting ? t('Starting...') : t('Start Brew Day')}
          </button>

          <div className="card stat-card primary">
            <h3 style={{ margin: '0 0 16px 0' }}>{t('Dynamic Specifications')}</h3>
            <div className="stat-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span style={{ color: '#666' }}>{t('Target Style')}</span>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{currentRecipe.targetStyle}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span style={{ color: '#666' }}>{t('Estimated OG')}</span>
                <span style={{ fontWeight: 'bold' }}>{sessionDetails.og.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>{t('Estimated ABV')}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{sessionDetails.abv.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="card stat-card secondary">
            <h3 style={{ margin: '0 0 16px 0' }}>{t('TOSNA 3.0 Guide')}</h3>
            {!sessionDetails.tosna ? (
              <div className="empty-text">{t('No yeast added')}</div>
            ) : (
              <div className="tosna-grid">
                <div className="tosna-row"><span>{t('Required Yeast')}</span><strong>{sessionDetails.tosna.totalYeastGrams} g</strong></div>
                <div className="tosna-row"><span>{t('Go-Ferm')}</span><strong>{sessionDetails.tosna.goFermGrams} g</strong></div>
                <div className="tosna-row"><span>{t('Total Fermaid-O')}</span><strong>{sessionDetails.tosna.totalFermaidOGrams} g</strong></div>
                <div className="tosna-row highlight"><span>{t('Per Addition (x4)')}</span><strong>{sessionDetails.tosna.dosePerAdditionGrams} g</strong></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrewSessionSetup;