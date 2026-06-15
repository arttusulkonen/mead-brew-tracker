import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle, FaPlus, FaTrash } from 'react-icons/fa';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { HoneyIngredient, YeastIngredient } from '../types/ingredient';
import { calculateAbvCrouch, calculateTosna, estimateOG } from '../utils/calculations';

interface RecipeIngredientEntry {
  id: string;
  globalIngredientId: string;
  name: string;
  category: string;
  quantity: number;
  note: string;
}

interface RecipeStep {
  id: string;
  stepNumber: number;
  description: string;
  durationMinutes: number;
  targetTempC: number | null;
}

const Recipes: React.FC = () => {
  const { t } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { inventory, fetchInventory } = useInventoryStore();

  const [recipeName, setRecipeName] = useState('');
  const [batchSizeLiters, setBatchSizeLiters] = useState<number>(10);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientEntry[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([]);

  useEffect(() => {
    if (activeBreweryId) {
      fetchInventory(activeBreweryId);
    }
  }, [activeBreweryId, fetchInventory]);

  const availableTemplates = useMemo(() => {
    const templates = new Map();
    inventory?.forEach(item => {
      if (item?.ingredient && !templates.has(item.ingredient.id)) {
        templates.set(item.ingredient.id, item.ingredient);
      }
    });
    return Array.from(templates.values());
  }, [inventory]);

  const handleAddIngredient = () => {
    if (!selectedIngredientId) return;
    const template = availableTemplates.find(i => i.id === selectedIngredientId);
    if (!template) return;

    setRecipeIngredients(prev => [
      ...prev,
      { 
        id: crypto.randomUUID(), 
        globalIngredientId: template.id, 
        name: template.name,
        category: template.category,
        quantity: 0,
        note: '' 
      }
    ]);
    setSelectedIngredientId('');
  };

  const handleRemoveIngredient = (id: string) => {
    setRecipeIngredients(prev => prev.filter(item => item.id !== id));
  };

  const handleQuantityChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRecipeIngredients(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: numValue } : item
    ));
  };

  const handleNoteChange = (id: string, value: string) => {
    setRecipeIngredients(prev => prev.map(item => 
      item.id === id ? { ...item, note: value } : item
    ));
  };

  const handleAddStep = () => {
    setRecipeSteps(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        stepNumber: prev.length + 1,
        description: '',
        durationMinutes: 0,
        targetTempC: null
      }
    ]);
  };

  const handleRemoveStep = (id: string) => {
    setRecipeSteps(prev => {
      const filtered = prev.filter(step => step.id !== id);
      return filtered.map((step, index) => ({ ...step, stepNumber: index + 1 }));
    });
  };

  const handleStepChange = (id: string, field: keyof RecipeStep, value: string | number | null) => {
    setRecipeSteps(prev => prev.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  const recipeDetails = useMemo(() => {
    let totalHoneyGrams = 0;
    let averageBrix = 80;
    let selectedYeast: YeastIngredient | null = null;
    let honeyCount = 0;
    let totalBrix = 0;

    recipeIngredients?.forEach(item => {
      const template = availableTemplates.find(t => t.id === item.globalIngredientId);
      if (!template) return;

      if (template.category === 'Honey') {
        const honey = template as HoneyIngredient;
        totalHoneyGrams += item.quantity;
        totalBrix += (honey.sugarContentBrix || 80);
        honeyCount++;
      } else if (template.category === 'Yeast') {
        selectedYeast = template as YeastIngredient;
      }
    });

    if (honeyCount > 0) averageBrix = totalBrix / honeyCount;

    const estimatedOg = estimateOG(batchSizeLiters, totalHoneyGrams, averageBrix);
    const estimatedAbv = calculateAbvCrouch(estimatedOg, 1.000);

    let tosnaData = null;
    if (selectedYeast && estimatedOg > 1.000) {
      let nFactor = 0.90;
      if (selectedYeast.nitrogenDemand === 'Low') nFactor = 0.75;
      else if (selectedYeast.nitrogenDemand === 'High' || selectedYeast.nitrogenDemand === 'Very High') nFactor = 1.25;
      tosnaData = calculateTosna(batchSizeLiters, estimatedOg, nFactor);
    }

    return { og: estimatedOg, abv: estimatedAbv, tosna: tosnaData };
  }, [recipeIngredients, batchSizeLiters, availableTemplates]);

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
                <option value="" disabled>{t('Select ingredient template...')}</option>
                {availableTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({t(template.category)})
                  </option>
                ))}
              </select>
              <button className="btn-primary" onClick={handleAddIngredient} disabled={!selectedIngredientId}>
                <FaPlus /> {t('Add')}
              </button>
            </div>

            <div className="ingredients-list">
              {recipeIngredients.map(item => {
                const stockItems = inventory?.filter(inv => inv.ingredientId === item.globalIngredientId) || [];
                const totalInStock = stockItems.reduce((sum, inv) => sum + inv.quantityOnHand, 0);
                const isShortage = item.quantity > totalInStock;

                return (
                  <div key={item.id} className="ingredient-row">
                    <div className="ingredient-main-row">
                      <div className="ingredient-info">
                        <span className="category-tag" data-category={item.category}>{t(item.category)}</span>
                        <span className="name">{item.name}</span>
                        {isShortage && item.quantity > 0 && (
                          <span className="warning-text" title={t('Not enough in stock')}>
                            <FaExclamationTriangle /> {t('Stock:')} {totalInStock}
                          </span>
                        )}
                      </div>
                      <div className="ingredient-controls">
                        <input 
                          type="number" 
                          min="0" 
                          value={item.quantity || ''} 
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          placeholder="0"
                        />
                        <span className="unit">{t('g')}</span>
                        <button className="btn-icon danger" onClick={() => handleRemoveIngredient(item.id)}>
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                    <div className="ingredient-note">
                      <input 
                        type="text" 
                        value={item.note}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        placeholder={t('Add a note (e.g., boil for 5 mins, dry hop)...')}
                        className="note-input"
                      />
                    </div>
                  </div>
                );
              })}
              {recipeIngredients.length === 0 && (
                <div className="empty-text">{t('No ingredients added yet.')}</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3>{t('Brewing Steps')}</h3>
            <div className="steps-list">
              {recipeSteps.map((step) => (
                <div key={step.id} className="step-row">
                  <div className="step-number">{step.stepNumber}</div>
                  <div className="step-content">
                    <input 
                      type="text" 
                      value={step.description}
                      onChange={(e) => handleStepChange(step.id, 'description', e.target.value)}
                      placeholder={t('Step description (e.g., Boil honey and water)')}
                      className="step-desc-input"
                    />
                    <div className="step-metrics">
                      <div className="metric-input">
                        <label>{t('Time (min)')}</label>
                        <input 
                          type="number" 
                          min="0"
                          value={step.durationMinutes || ''}
                          onChange={(e) => handleStepChange(step.id, 'durationMinutes', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="metric-input">
                        <label>{t('Target °C')}</label>
                        <input 
                          type="number" 
                          value={step.targetTempC || ''}
                          onChange={(e) => handleStepChange(step.id, 'targetTempC', parseFloat(e.target.value) || null)}
                          placeholder="—"
                        />
                      </div>
                    </div>
                  </div>
                  <button className="btn-icon danger" onClick={() => handleRemoveStep(step.id)}>
                    <FaTrash />
                  </button>
                </div>
              ))}
              <button className="btn-secondary" onClick={handleAddStep}>
                <FaPlus /> {t('Add Step')}
              </button>
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
            <h3>{t('TOSNA 3.0 Requirements')}</h3>
            {!recipeDetails.tosna ? (
              <div className="empty-text">{t('Add honey and yeast to calculate nutrients.')}</div>
            ) : (
              <div className="tosna-grid">
                <div className="tosna-row">
                  <span>{t('Total Yeast Needed')}</span>
                  <strong>{recipeDetails.tosna.totalYeastGrams} {t('g')}</strong>
                </div>
                <div className="tosna-row">
                  <span>{t('Go-Ferm Protect')}</span>
                  <strong>{recipeDetails.tosna.goFermGrams} {t('g')}</strong>
                </div>
                <div className="tosna-row">
                  <span>{t('Total Fermaid-O')}</span>
                  <strong>{recipeDetails.tosna.totalFermaidOGrams} {t('g')}</strong>
                </div>
                <div className="tosna-row highlight">
                  <span>{t('Per Addition (x4)')}</span>
                  <strong>{recipeDetails.tosna.dosePerAdditionGrams} {t('g')}</strong>
                </div>
              </div>
            )}
          </div>

          <button className="btn-primary full-width" disabled={!recipeName || recipeIngredients.length === 0}>
            {t('Save Recipe')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Recipes;