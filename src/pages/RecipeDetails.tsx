import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEdit, FaPlay, FaTrash } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/config';
import { useRecipeStore } from '../store/useRecipeStore';
import type { BaseIngredient, YeastIngredient } from '../types/ingredient';
import { calculateOneThirdSugarBreak, calculateTosna } from '../utils/calculations';

const RecipeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentRecipe, fetchRecipeById, clearCurrentRecipe, isLoading, deleteRecipe } = useRecipeStore();
  const [globalCatalog, setGlobalCatalog] = useState<BaseIngredient[]>([]);

  useEffect(() => {
    fetchRecipeById(id);
    return () => clearCurrentRecipe();
  }, [id, fetchRecipeById, clearCurrentRecipe]);

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
        console.assert(false, 'Failed to fetch global ingredient catalog');
      }
    };
    fetchCatalog();
  }, []);

  const selectedRecipeTosna = useMemo(() => {
    if (!currentRecipe || globalCatalog.length === 0) return null;
    let selectedYeastTemplate = null;
    let yeastAddedGrams = 0;
    let customNutrientName = '';

    currentRecipe.ingredients.forEach(item => {
      const template = globalCatalog.find(t => t.id === item.globalIngredientId);
      
      if (item.category === 'Yeast') {
        yeastAddedGrams += item.quantity;
        selectedYeastTemplate = template;
      } else if (item.category === 'Additive' && template) {
        const additive = template as any;
        if (additive.dosagePer10Liters && !customNutrientName) {
          customNutrientName = item.name;
        }
      }
    });

    if (selectedYeastTemplate && currentRecipe.targetOriginalGravity > 1.000) {
      const yeast = selectedYeastTemplate as unknown as YeastIngredient;
      let nFactor = 0.90;
      if (yeast.nitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeast.nitrogenDemand === 'High' || yeast.nitrogenDemand === 'Very High') nFactor = 1.25;

      return {
        ...calculateTosna(currentRecipe.expectedBatchSizeLiters, currentRecipe.targetOriginalGravity, nFactor),
        yeastAdded: yeastAddedGrams,
        customNutrientName: customNutrientName || 'Fermaid-O'
      };
    }
    return null;
  }, [currentRecipe, globalCatalog]);

  const startBrewSession = () => {
    if (!currentRecipe?.id) return;
    navigate(`/brew/setup/${currentRecipe.id}`);
  };

  const handleEdit = () => {
    if (!currentRecipe) return;
    navigate('/recipes', { state: { editRecipe: currentRecipe } });
  };

  const handleDelete = async () => {
    if (!currentRecipe || !currentRecipe.id) return;
    
    if (window.confirm(t('Are you sure you want to delete this recipe?'))) {
      try {
        await deleteRecipe(currentRecipe.id);
        navigate('/recipes');
      } catch {
        alert(t('Failed to delete recipe. Check your permissions.'));
      }
    }
  };

  if (isLoading) {
    return <div className="loading-text p-lg text-center">{t('Loading recipe...')}</div>;
  }

  if (!currentRecipe) {
    return (
      <div className="recipes-page text-center p-lg">
        <h2>{t('Recipe not found')}</h2>
        <button className="btn-secondary mt-md" onClick={() => navigate('/recipes')}>
          {t('Back to list')}
        </button>
      </div>
    );
  }

  return (
    <div className="recipes-page">
      <header className="page-header">
        <div className="flex-col gap-xs">
          <h1 className="m-0">{currentRecipe.name}</h1>
          <span className="text-sm text-muted">{currentRecipe.targetStyle}</span>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-icon outline" onClick={handleEdit} title={t('Edit Recipe')}>
            <FaEdit color="#666" />
          </button>
          <button className="btn-icon danger-outline" onClick={handleDelete} title={t('Delete Recipe')}>
            <FaTrash color="#dc3545" />
          </button>
          <button className="btn-secondary" onClick={() => navigate('/recipes')}>
            {t('Back to list')}
          </button>
        </div>
      </header>

      <div className="recipe-grid">
        <div className="flex-col gap-lg">
          <div className="card">
            <h3 className="mb-md" style={{ borderBottom: '1px solid #eee', paddingBottom: '12px' }}>{t('Ingredients')}</h3>
            <div className="flex-col gap-sm">
              {currentRecipe.ingredients.map(ing => (
                <div key={ing.id} className="ingredient-list-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                  <div>
                    <span className="category-tag" style={{ marginRight: '12px', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#eef' }} data-category={ing.category}>{t(ing.category)}</span>
                    <strong className="text-md">{ing.name}</strong>
                    {ing.note && <div className="text-sm text-muted mt-sm">{ing.note}</div>}
                  </div>
                  <div className="font-bold no-wrap">{ing.quantity} {t('g')}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-md" style={{ borderBottom: '1px solid #eee', paddingBottom: '12px' }}>{t('Brewing Steps')}</h3>
            <div className="flex-col gap-md">
              {currentRecipe.steps.map((step, idx) => (
                <div key={step.id} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong className="text-md">{step.title}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#666', backgroundColor: '#eee', padding: '2px 8px', borderRadius: '12px' }}>{step.phase}</span>
                    </div>
                    <p style={{ margin: '4px 0 8px 0', fontSize: '0.95rem', lineHeight: '1.4' }}>{step.description}</p>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: '#666' }}>
                      <span>⏱ {step.durationValue} {t(step.durationUnit)}</span>
                      {step.targetTempC && <span>🌡 {step.targetTempC} °C</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-col gap-lg">
          <button className="btn-primary full-width" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', fontSize: '1.1rem' }} onClick={startBrewSession}>
            <FaPlay /> {t('Start Brew Session')}
          </button>

          <div className="card stat-card">
            <h3 className="mb-md">{t('Specifications')}</h3>
            <div className="flex-col gap-sm">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span className="text-muted">{t('Batch Size')}</span>
                <span className="font-bold">{currentRecipe.expectedBatchSizeLiters} {t('L')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span className="text-muted">{t('Estimated ABV')}</span>
                <span className="text-primary-bold">{currentRecipe.targetAbv?.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span className="text-muted">{t('Original Gravity')}</span>
                <span className="font-bold">{currentRecipe.targetOriginalGravity?.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{t('Final Gravity')}</span>
                <span className="font-bold">{currentRecipe.targetFinalGravity?.toFixed(3)}</span>
              </div>
            </div>
          </div>

          <div className="card stat-card">
            <h3 className="mb-md">{t('TOSNA 3.0 Guide')}</h3>
            {!selectedRecipeTosna ? (
              <div className="empty-text text-center text-muted">{t('No yeast added')}</div>
            ) : (
              <>
                <div className="tosna-grid mb-md">
                  <div className="tosna-row">
                    <span>{t('Required Yeast')}</span>
                    <div className="text-right">
                      <strong>{selectedRecipeTosna.totalYeastGrams} g</strong>
                      {selectedRecipeTosna.yeastAdded > 0 && <div className="text-xs text-muted">({t('Added')}: {selectedRecipeTosna.yeastAdded}g)</div>}
                    </div>
                  </div>
                  <div className="tosna-row"><span>{t('Go-Ferm')}</span><strong>{selectedRecipeTosna.goFermGrams} g</strong></div>
                  <div className="tosna-row"><span>{t('Total')} {selectedRecipeTosna.customNutrientName}</span><strong>{selectedRecipeTosna.totalFermaidOGrams} g</strong></div>
                </div>

                <div style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>{t('Feeding Schedule')}</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#444', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>
                      <strong>{t('Addition 1')}</strong> ({t('24h')}): <strong className="text-primary">{selectedRecipeTosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li>
                      <strong>{t('Addition 2')}</strong> ({t('48h')}): <strong className="text-primary">{selectedRecipeTosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li>
                      <strong>{t('Addition 3')}</strong> ({t('72h')}): <strong className="text-primary">{selectedRecipeTosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li>
                      <strong>{t('Addition 4')}</strong> ({t('1/3 Sugar Break')}): <strong className="text-primary">{selectedRecipeTosna.dosePerAdditionGrams} g</strong><br />
                      <span className="text-xs text-muted">
                        {t('Target SG for final addition')}: {calculateOneThirdSugarBreak(currentRecipe.targetOriginalGravity).toFixed(3)}
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

export default RecipeDetails;