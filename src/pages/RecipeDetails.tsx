import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlay } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/config';
import { useRecipeStore } from '../store/useRecipeStore';
import type { BaseIngredient, YeastIngredient } from '../types/ingredient';
import { calculateTosna } from '../utils/calculations';

const RecipeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentRecipe, fetchRecipeById, clearCurrentRecipe, isLoading } = useRecipeStore();
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

  const selectedRecipeTosna = useMemo(() => {
    if (!currentRecipe || globalCatalog.length === 0) return null;
    let selectedYeastTemplate = null;
    let yeastAddedGrams = 0;
    
    currentRecipe.ingredients.forEach(item => {
      if (item.category === 'Yeast') {
        yeastAddedGrams += item.quantity;
        selectedYeastTemplate = globalCatalog.find(t => t.id === item.globalIngredientId);
      }
    });

    if (selectedYeastTemplate && currentRecipe.targetOriginalGravity > 1.000) {
      const yeast = selectedYeastTemplate as unknown as YeastIngredient;
      let nFactor = 0.90;
      if (yeast.nitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeast.nitrogenDemand === 'High' || yeast.nitrogenDemand === 'Very High') nFactor = 1.25;
      
      return {
        ...calculateTosna(currentRecipe.expectedBatchSizeLiters, currentRecipe.targetOriginalGravity, nFactor),
        yeastAdded: yeastAddedGrams
      };
    }
    return null;
  }, [currentRecipe, globalCatalog]);

  const startBrewSession = () => {
    alert(t('Live Brew Session feature is coming in the next module!'));
  };

  if (isLoading || !currentRecipe) {
    return <div className="loading-text" style={{ padding: '2rem' }}>{t('Loading recipe...')}</div>;
  }

  return (
    <div className="recipes-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ margin: 0 }}>{currentRecipe.name}</h1>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>{currentRecipe.targetStyle}</span>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/recipes')}>
          {t('Back to list')}
        </button>
      </header>

      <div className="recipe-grid" style={{ display: 'grid', gap: '24px', gridTemplateColumns: '2fr 1fr', alignItems: 'start', marginTop: '24px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>{t('Ingredients')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentRecipe.ingredients.map(ing => (
                <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                  <div>
                    <span className="category-tag" data-category={ing.category} style={{ marginRight: '12px', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#eef' }}>{t(ing.category)}</span>
                    <strong style={{ fontSize: '0.95rem' }}>{ing.name}</strong>
                    {ing.note && <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>{ing.note}</div>}
                  </div>
                  <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{ing.quantity} {t('g')}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>{t('Brewing Steps')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {currentRecipe.steps.map((step, idx) => (
                <div key={step.id} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '1rem' }}>{step.title}</strong>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={startBrewSession}
          >
            <FaPlay /> {t('Start Brew Session')}
          </button>

          <div className="card stat-card primary">
            <h3 style={{ margin: '0 0 16px 0' }}>{t('Specifications')}</h3>
            <div className="stat-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span style={{ color: '#666' }}>{t('Batch Size')}</span>
                <span style={{ fontWeight: 'bold' }}>{currentRecipe.expectedBatchSizeLiters} {t('L')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span style={{ color: '#666' }}>{t('Estimated ABV')}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{currentRecipe.targetAbv?.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                <span style={{ color: '#666' }}>{t('Original Gravity')}</span>
                <span style={{ fontWeight: 'bold' }}>{currentRecipe.targetOriginalGravity?.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>{t('Final Gravity')}</span>
                <span style={{ fontWeight: 'bold' }}>{currentRecipe.targetFinalGravity?.toFixed(3)}</span>
              </div>
            </div>
          </div>

          <div className="card stat-card secondary">
            <h3 style={{ margin: '0 0 16px 0' }}>{t('TOSNA 3.0 Guide')}</h3>
            {!selectedRecipeTosna ? (
              <div className="empty-text">{t('No yeast added')}</div>
            ) : (
              <>
                <div className="tosna-grid" style={{ marginBottom: '16px' }}>
                  <div className="tosna-row">
                    <span>{t('Required Yeast')}</span>
                    <div style={{ textAlign: 'right' }}>
                      <strong>{selectedRecipeTosna.totalYeastGrams} g</strong>
                      {selectedRecipeTosna.yeastAdded > 0 && <div style={{ fontSize: '0.75rem', color: '#666' }}>({t('Added')}: {selectedRecipeTosna.yeastAdded}g)</div>}
                    </div>
                  </div>
                  <div className="tosna-row"><span>{t('Go-Ferm (Rehydration)')}</span><strong>{selectedRecipeTosna.goFermGrams} g</strong></div>
                  <div className="tosna-row"><span>{t('Total Fermaid-O')}</span><strong>{selectedRecipeTosna.totalFermaidOGrams} g</strong></div>
                </div>

                <div style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>{t('Feeding Schedule')}</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#444', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>
                      <strong>{t('Addition 1')}</strong> ({t('24h')}): <strong style={{ color: 'var(--color-primary)' }}>{selectedRecipeTosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li>
                      <strong>{t('Addition 2')}</strong> ({t('48h')}): <strong style={{ color: 'var(--color-primary)' }}>{selectedRecipeTosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li>
                      <strong>{t('Addition 3')}</strong> ({t('72h')}): <strong style={{ color: 'var(--color-primary)' }}>{selectedRecipeTosna.dosePerAdditionGrams} g</strong>
                    </li>
                    <li>
                      <strong>{t('Addition 4')}</strong> ({t('1/3 Sugar Break')}): <strong style={{ color: 'var(--color-primary)' }}>{selectedRecipeTosna.dosePerAdditionGrams} g</strong><br/>
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>
                        {t('Target SG for final addition')}: {(currentRecipe.targetOriginalGravity - ((currentRecipe.targetOriginalGravity - 1.000) / 3)).toFixed(3)}
                      </span>
                    </li>
                  </ul>
                </div>

                {currentRecipe.targetStyle === 'Session (4-6%)' && (
                  <div style={{ marginTop: '16px', fontSize: '0.85rem', color: '#666', borderLeft: '3px solid var(--color-primary)', paddingLeft: '8px' }}>
                    {t('💡 For Session Meads, the 1/3 sugar break occurs rapidly. Monitor gravity closely from Day 2 to avoid missing nutrient additions.')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetails;