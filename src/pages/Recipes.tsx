import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaChevronUp, FaPlus, FaTrash } from 'react-icons/fa';
import { auth, db } from '../firebase/config';
import { useBreweryStore } from '../store/useBreweryStore';
import type { BaseIngredient, HoneyIngredient, IngredientCategory, YeastIngredient } from '../types/ingredient';
import type { StepPhase, TimeUnit } from '../types/recipe';
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
  const { activeBreweryId } = useBreweryStore();

  const [recipeName, setRecipeName] = useState('');
  const [batchSizeLiters, setBatchSizeLiters] = useState<number>(10);
  
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

  const recipeDetails = useMemo(() => {
    let totalHoneyGrams = 0;
    let averageBrix = 80;
    let selectedYeast: YeastIngredient | null = null;
    let honeyCount = 0;
    let totalBrix = 0;

    recipeIngredients.forEach(item => {
      const template = globalCatalog.find(t => t.id === item.globalIngredientId);
      if (!template) return;

      if (template.category === 'Honey') {
        const honey = template as unknown as HoneyIngredient;
        totalHoneyGrams += item.quantity;
        totalBrix += (honey.sugarContentBrix || 80);
        honeyCount++;
      } else if (template.category === 'Yeast') {
        selectedYeast = template as unknown as YeastIngredient;
      }
    });

    if (honeyCount > 0) averageBrix = totalBrix / honeyCount;

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

    return { og: estimatedOg, abv: estimatedAbv, tosna: tosnaData };
  }, [recipeIngredients, batchSizeLiters, globalCatalog]);

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
      alert(t('Recipe saved successfully!'));
    } catch (error) {
      console.error(error);
      alert(t('Error saving recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeBreweryId) return null;

  return (
    <div className="recipes-page">
      <header className="page-header">
        <h1>{t('Recipe Builder')}</h1>
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
            <div className="form-group">
              <label>{t('Target Batch Size (Liters)')}</label>
              <input 
                type="number" 
                min="1" 
                value={batchSizeLiters || ''} 
                onChange={(e) => setBatchSizeLiters(parseFloat(e.target.value) || 0)} 
              />
            </div>
          </div>

          <div className="card">
            <h3>{t('Ingredients')}</h3>
            
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
                <span className="value">{recipeDetails.abv.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="card stat-card secondary">
            <h3>{t('TOSNA 3.0')}</h3>
            {!recipeDetails.tosna ? (
              <div className="empty-text">{t('Add honey & yeast')}</div>
            ) : (
              <div className="tosna-grid">
                <div className="tosna-row"><span>{t('Total Yeast')}</span><strong>{recipeDetails.tosna.totalYeastGrams} g</strong></div>
                <div className="tosna-row"><span>{t('Go-Ferm')}</span><strong>{recipeDetails.tosna.goFermGrams} g</strong></div>
                <div className="tosna-row"><span>{t('Fermaid-O')}</span><strong>{recipeDetails.tosna.totalFermaidOGrams} g</strong></div>
                <div className="tosna-row highlight"><span>{t('Per Addition (x4)')}</span><strong>{recipeDetails.tosna.dosePerAdditionGrams} g</strong></div>
              </div>
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