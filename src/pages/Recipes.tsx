import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaChevronUp, FaExclamationTriangle, FaMagic, FaPlay, FaPlus, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/config';
import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';
import type { BaseIngredient, HoneyIngredient, IngredientCategory, YeastIngredient } from '../types/ingredient';
import type { MeadStyleTarget, StepPhase, TimeUnit } from '../types/recipe';
import { calculateAbvCrouch, calculateTosna, estimateOG } from '../utils/calculations';

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

const Recipes: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeBreweryId } = useBreweryStore();
  const { recipes, fetchRecipes, isLoading: isRecipesLoading } = useRecipeStore();

  const [view, setView] = useState<'list' | 'builder'>('list');

  const [recipeName, setRecipeName] = useState('');
  const [batchSizeLiters, setBatchSizeLiters] = useState<number>(10);
  const [targetStyle, setTargetStyle] = useState<MeadStyleTarget>('Session (4-6%)');
  
  // Новое состояние для умного калькулятора
  const [targetAutoAbv, setTargetAutoAbv] = useState<number>(5.0);

  const [globalCatalog, setGlobalCatalog] = useState<BaseIngredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientEntry[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        if (!db) return;
        const querySnapshot = await getDocs(collection(db, 'ingredients'));
        const catalogData = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as BaseIngredient[];
        setGlobalCatalog(catalogData);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (activeBreweryId) {
      fetchRecipes(activeBreweryId);
    }
  }, [activeBreweryId, fetchRecipes]);

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

  // 🪄 Умный калькулятор: Алгоритм бинарного поиска для идеального веса мёда
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

    // Бинарный поиск: ищем вес от 100 г до 20 000 г
    let minGrams = 100;
    let maxGrams = 20000;
    let bestGrams = 1000;
    let iterations = 0;

    while (minGrams <= maxGrams && iterations < 50) {
      const midGrams = Math.floor((minGrams + maxGrams) / 2);
      const testOG = estimateOG(batchSizeLiters, midGrams, brix);
      const testABV = calculateAbvCrouch(testOG, 1.000);

      if (Math.abs(testABV - targetAutoAbv) < 0.05) {
        bestGrams = midGrams;
        break; // Нашли идеальное значение
      }

      if (testABV < targetAutoAbv) {
        minGrams = midGrams + 1; // Нужно больше мёда
      } else {
        maxGrams = midGrams - 1; // Нужно меньше мёда
      }
      bestGrams = midGrams;
      iterations++;
    }

    // Округляем до десятков грамм для реалистичности
    const roundedGrams = Math.round(bestGrams / 10) * 10;
    updateIngredient(honeyEntry.id, { quantity: roundedGrams });
  };

  const recipeDetails = useMemo(() => {
    let totalHoneyGrams = 0;
    let averageBrix = 80;
    let selectedYeast: YeastIngredient | null = null;
    let yeastAddedGrams = 0;
    let totalWeightedBrix = 0;

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
    const estimatedAbv = calculateAbvCrouch(estimatedOg, 1.000);

    let tosnaData = null;
    if (selectedYeast && estimatedOg > 1.000) {
      const yeast = selectedYeast as YeastIngredient;
      let nFactor = 0.90;
      if (yeast.nitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeast.nitrogenDemand === 'High' || yeast.nitrogenDemand === 'Very High') nFactor = 1.25;
      tosnaData = calculateTosna(batchSizeLiters, estimatedOg, nFactor);
    }

    return { og: estimatedOg, abv: estimatedAbv, tosna: tosnaData, yeastAdded: yeastAddedGrams };
  }, [recipeIngredients, batchSizeLiters, globalCatalog]);

  const isAbvMismatch = useMemo(() => {
    if (targetStyle === 'Session (4-6%)' && recipeDetails.abv > 6.5) return true;
    if (targetStyle === 'Standard (7-10%)' && (recipeDetails.abv < 6.5 || recipeDetails.abv > 10.5)) return true;
    if (targetStyle === 'Wine/Sack (11%+)' && recipeDetails.abv < 10.5) return true;
    return false;
  }, [targetStyle, recipeDetails.abv]);

  const handleSaveRecipe = async () => {
    if (!activeBreweryId || !recipeName || recipeIngredients.length === 0 || !db || !auth?.currentUser) return;

    setIsSaving(true);
    try {
      const recipeId = crypto.randomUUID();
      const recipeRef = doc(db, 'recipes', recipeId);
      
      const cleanIngredients = recipeIngredients.map(item => ({
        id: item.id,
        globalIngredientId: item.globalIngredientId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        note: item.note
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

      const newRecipe = {
        id: recipeId,
        breweryId: activeBreweryId,
        name: recipeName,
        targetStyle,
        expectedBatchSizeLiters: batchSizeLiters,
        targetOriginalGravity: recipeDetails.og,
        targetFinalGravity: 1.000,
        targetAbv: recipeDetails.abv,
        ingredients: cleanIngredients,
        steps: cleanSteps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
      };

      await setDoc(recipeRef, newRecipe);
      
      setRecipeName('');
      setRecipeIngredients([]);
      setRecipeSteps([]);
      
      await fetchRecipes(activeBreweryId);
      setView('list');
    } catch (error) {
      console.error(error);
      alert(t('Error saving recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeBreweryId) return null;

  if (view === 'list') {
    return (
      <div className="recipes-page">
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>{t('Recipes')}</h1>
          <button className="btn-primary" onClick={() => setView('builder')}>
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
          <div className="recipes-grid" style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', marginTop: '24px' }}>
            {recipes.map(recipe => (
              <div 
                key={recipe.id} 
                className="card recipe-card" 
                role="button"
                tabIndex={0}
                style={{ padding: '20px', border: '1px solid #eee', borderRadius: '12px', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/recipes/${recipe.id}`);
                  }
                }}
              >
                <h3 style={{ margin: '0 0 12px 0' }}>{recipe.name}</h3>
                <div className="recipe-meta" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#666' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold' }}>{recipe.targetStyle}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{recipe.targetAbv?.toFixed(1)}% ABV</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('Batch Size')}</span>
                    <span>{recipe.expectedBatchSizeLiters} {t('L')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{t('Recipe Builder')}</h1>
        <button className="btn-secondary" onClick={() => setView('list')}>
          {t('Cancel')}
        </button>
      </header>

      <div className="recipe-grid">
        <div className="recipe-form-section">
          
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
            <div className="form-row">
              <div className="form-group">
                <label>{t('Target Style')}</label>
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
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{t('Ingredients')}</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f0f4f8', padding: '6px 12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#444' }}>{t('Target ABV')}:</span>
                <input 
                  type="number" 
                  step="0.1"
                  min="1"
                  max="20"
                  value={targetAutoAbv} 
                  onChange={(e) => setTargetAutoAbv(parseFloat(e.target.value) || 5.0)}
                  style={{ width: '60px', padding: '4px', fontSize: '0.85rem' }}
                />
                <button 
                  className="btn-text-small" 
                  onClick={handleAutoCalculateHoney}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)' }}
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
              <button className="btn-primary" onClick={handleAddIngredient} disabled={!selectedIngredientId || isSaving}>
                <FaPlus /> {t('Add')}
              </button>
            </div>

            <div className="ingredients-list">
              {recipeIngredients.map(item => (
                <div key={item.id} className="ingredient-row">
                  <div className="ingredient-main-row">
                    <div className="ingredient-info">
                      <span className="category-tag" data-category={item.category}>{t(item.category)}</span>
                      <span className="name">{item.name}</span>
                    </div>
                    <div className="ingredient-controls">
                      <button 
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
                </div>
              ))}
              {recipeIngredients.length === 0 && (
                <div className="empty-text">{t('No ingredients added yet.')}</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3>{t('Brewing Steps')}</h3>
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
                    <div className="step-header-right">
                    <button 
                      className="btn-icon transparent" 
                      onClick={() => updateStep(step.id, { isExpanded: !step.isExpanded })}
                      aria-expanded={step.isExpanded}
                      aria-label={step.isExpanded ? t('Collapse step') : t('Expand step')}
                    >
                      {step.isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                    <button 
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
                      
                      <div className="step-metrics-grid">
                        <div className="metric-group">
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
                        <div className="metric-group">
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
                <button className="btn-secondary" onClick={() => handleAddStep('Preparation')} disabled={isSaving}>
                  <FaPlus /> {t('Add Step')}
                </button>
              </div>
            </div>
          </div>

        </div>

        <div className="recipe-stats-section">
          <div className="card stat-card primary">
            <h3>{t('Estimated Specifications')}</h3>
            <div className="stat-grid">
              <div className="stat-box">
                <span className="label">{t('Original Gravity (OG)')}</span>
                <span className="value">{recipeDetails.og.toFixed(3)}</span>
              </div>
              <div className="stat-box">
                <span className="label">{t('Target Final Gravity')}</span>
                <span className="value">1.000</span>
              </div>
              <div className="stat-box">
                <span className="label">{t('Estimated ABV')}</span>
                <span className={`value ${isAbvMismatch ? 'text-warning' : ''}`}>
                  {recipeDetails.abv.toFixed(1)}%
                </span>
              </div>
            </div>
            {isAbvMismatch && targetStyle !== 'Custom' && (
              <div className="abv-warning-msg" style={{ marginTop: '16px', color: '#d9534f', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaExclamationTriangle /> {t('The calculated ABV does not match your selected Target Style. Adjust honey amount.')}
              </div>
            )}
          </div>

          <div className="card stat-card secondary">
            <h3>{t('TOSNA 3.0 Guide')}</h3>
            {!recipeDetails.tosna ? (
              <div className="empty-text">{t('Add honey & yeast')}</div>
            ) : (
              <>
                <div className="tosna-grid">
                  <div className="tosna-row">
                    <span>{t('Required Yeast')}</span>
                    <div style={{ textAlign: 'right' }}>
                      <strong>{recipeDetails.tosna.totalYeastGrams} g</strong>
                      {recipeDetails.yeastAdded > 0 && <div style={{ fontSize: '0.75rem', color: '#666' }}>({t('Added')}: {recipeDetails.yeastAdded}g)</div>}
                    </div>
                  </div>
                  <div className="tosna-row"><span>{t('Go-Ferm')}</span><strong>{recipeDetails.tosna.goFermGrams} g</strong></div>
                  <div className="tosna-row"><span>{t('Fermaid-O')}</span><strong>{recipeDetails.tosna.totalFermaidOGrams} g</strong></div>
                  <div className="tosna-row highlight"><span>{t('Per Addition (x4)')}</span><strong>{recipeDetails.tosna.dosePerAdditionGrams} g</strong></div>
                </div>
                {targetStyle === 'Session (4-6%)' && (
                  <div style={{ marginTop: '16px', fontSize: '0.85rem', color: '#666' }}>
                    {t('💡 For Session Meads, the 1/3 sugar break occurs rapidly. Monitor gravity closely from Day 2.')}
                  </div>
                )}
              </>
            )}
          </div>

          <button 
            className="btn-primary full-width" 
            onClick={handleSaveRecipe}
            disabled={!recipeName || recipeIngredients.length === 0 || isSaving}
          >
            {isSaving ? t('Saving...') : t('Save Recipe')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Recipes;