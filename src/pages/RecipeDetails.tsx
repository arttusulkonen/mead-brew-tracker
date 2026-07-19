// src/pages/RecipeDetails.tsx
import { calculateOneThirdSugarBreak, calculateTosna } from '@mead-tracker/math';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { RecipeCostWidget } from '../components/recipe-components/RecipeCostWidget';
import { RecipePerformanceWidget } from '../components/recipe-components/RecipePerformanceWidget';
import { useRecipeStore } from '../store/useRecipeStore';
import type { Recipe } from '../types/recipe';

// Расширяем тип Recipe для безопасного маппинга динамических полей аналитики
type ExtendedRecipeStats = Recipe & {
  totalBrews?: number;
  completedBrews?: number;
  avgAiScore?: number | null;
  avgUserRating?: number | null;
  totalUserRatings?: number;
  currentUserRating?: number | null;
};

const RecipeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentRecipe, fetchRecipeById, clearCurrentRecipe, isLoading, deleteRecipe, recipes, rateRecipe } = useRecipeStore();
  
  useEffect(() => {
    fetchRecipeById(id);
    return () => clearCurrentRecipe();
  }, [id, fetchRecipeById, clearCurrentRecipe]);

  const activeRecipeStats = useMemo(() => {
    if (!id) return null;
    if (currentRecipe && currentRecipe.id === id) {
      return currentRecipe as ExtendedRecipeStats;
    }
    const found = recipes.find(r => r.id === id);
    return found as ExtendedRecipeStats | null;
  }, [id, recipes, currentRecipe]);

  const selectedRecipeTosna = useMemo(() => {
    if (!currentRecipe || currentRecipe.beverageType !== 'Mead') return null;

    let yeastAddedGrams = 0;
    let yeastNitrogenDemand: 'Low' | 'Medium' | 'High' | 'Very High' | undefined;
    let customNutrientName = '';

    (currentRecipe.ingredients || []).forEach(ing => {
      if (!ing) return;
      const item = ing as any;
      if (item.category === 'Yeast') {
        yeastAddedGrams += item.quantity || 0;
        if (item.nitrogenDemand) yeastNitrogenDemand = item.nitrogenDemand;
      } else if (item.category === 'Additive') {
        if (item.additiveType === 'Nutrient' && item.nutrientRole === 'Fermentation' && !customNutrientName) {
          customNutrientName = item.name;
        } else if ((item.dosagePer10Liters || item.dosagePerGramYeast) && !customNutrientName) {
          customNutrientName = item.name;
        }
      }
    });

    if (yeastAddedGrams > 0 && currentRecipe.targetOriginalGravity > 1.000) {
      let nFactor = 0.90;
      if (yeastNitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeastNitrogenDemand === 'High' || yeastNitrogenDemand === 'Very High') nFactor = 1.25;

      return {
        ...calculateTosna(Number(currentRecipe.expectedBatchSizeLiters || 0), Number(currentRecipe.targetOriginalGravity || 1.000), nFactor),
        yeastAdded: yeastAddedGrams,
        customNutrientName: customNutrientName || 'Fermaid-O'
      };
    }
    return null;
  }, [currentRecipe]);

  const handleEdit = () => {
    if (!currentRecipe) return;
    navigate('/recipes', { state: { editRecipe: currentRecipe } });
  };

  const handleDelete = async () => {
    if (!currentRecipe || !currentRecipe.id) return;
    if (window.confirm(t('Are you sure you want to delete this recipe?', 'Вы уверены, что хотите удалить этот рецепт?'))) {
      try {
        await deleteRecipe(currentRecipe.id);
        navigate('/recipes');
      } catch {
        alert(t('Failed to delete recipe. Check your permissions.', 'Не удалось удалить рецепт.'));
      }
    }
  };

  if (isLoading) {
    return <div className="recipe-details__loading"><div className="spinner"></div></div>;
  }

  if (!currentRecipe) {
    return (
      <div className="recipe-details recipe-details--empty">
        <h2 className="recipe-details__empty-title">{t('Recipe not found')}</h2>
        <button type="button" className="btn-secondary" onClick={() => navigate('/recipes')}>
          {t('Back to list')}
        </button>
      </div>
    );
  }

  return (
    <div className="recipe-details">
      <header className="recipe-details__header">
        <div className="recipe-details__title-block">
          <h1 className="recipe-details__title">{currentRecipe.name}</h1>
          <span className="recipe-details__subtitle">
            {t(`constants.beverage_types.${currentRecipe.beverageType?.toLowerCase() || 'other'}`, currentRecipe.beverageType || 'Other') as string} &bull; {currentRecipe.targetStyle}
          </span>
        </div>
        <div className="recipe-details__actions">
          <button type="button" className="btn-secondary" onClick={handleEdit}>{t('Edit')}</button>
          <button type="button" className="btn-danger" onClick={handleDelete}>{t('Delete')}</button>
          <button type="button" className="btn-primary" onClick={() => navigate(`/brew/setup/${currentRecipe.id}`)}>{t('Start Brew')}</button>
        </div>
      </header>

      <div className="recipe-details__layout">
        <main className="recipe-details__main">
          
          <section className="recipe-details__section">
            <h2 className="recipe-details__section-title">{t('Ingredients')}</h2>
            <ul className="recipe-details__ingredient-list">
              {(currentRecipe.ingredients || []).map(ing => {
                const item = ing as any;
                const roleKey = item.nutrientRole ? `constants.nutrient_roles.${item.nutrientRole.toLowerCase()}` : '';
                return (
                  <li key={ing.id} className="recipe-details__ingredient-item">
                    <div className="recipe-details__ingredient-info">
                      <span className="recipe-details__badge">
                        {t(`constants.categories.${ing.category?.toLowerCase().replace(' ', '_') || 'other'}`, ing.category) as string}
                      </span>
                      <strong className="recipe-details__ingredient-name">{ing.name}</strong>
                      {item.nutrientRole && (
                        <span className="recipe-details__badge recipe-details__badge--outline">
                          {t(roleKey, item.nutrientRole) as string}
                        </span>
                      )}
                      {item.additionStage && (
                        <span className="recipe-details__badge recipe-details__badge--outline">{item.additionStage}</span>
                      )}
                    </div>
                    <span className="recipe-details__ingredient-quantity">{ing.quantity || 0} {t('g')}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {(currentRecipe as any).forks && (currentRecipe as any).forks.length > 0 && (
            <section className="recipe-details__section">
              <h2 className="recipe-details__section-title">
                {t('Recipe Variations')} 
                <span className="badge badge--primary" style={{ marginLeft: '8px' }}>
                  {(currentRecipe as any).forks.length}
                </span>
              </h2>
              <p className="recipe-details__empty-text" style={{ marginBottom: '16px', fontSize: '14px' }}>
                {t('These recipes were created as split batches or modifications of this original recipe.')}
              </p>
              <div className="recipes-grid">
                {(currentRecipe as any).forks.map((fork: any) => (
                  <div 
                    key={fork.id} 
                    className="recipe-card recipe-card--interactive" 
                    onClick={() => {
                      navigate(`/recipes/${fork.id}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="recipe-card__header">
                      <h3 className="recipe-card__title" style={{ fontSize: '16px' }}>{fork.name}</h3>
                      <span className="recipe-card__style">{fork.target_style}</span>
                    </div>
                    <div className="recipe-card__stats">
                      <div className="recipe-card__stat">
                        <span className="recipe-card__stat-label">{t('ABV')}</span>
                        <span className="recipe-card__stat-value">{Number(fork.target_abv || 0).toFixed(1)}%</span>
                      </div>
                      <div className="recipe-card__stat">
                        <span className="recipe-card__stat-label">{t('OG')}</span>
                        <span className="recipe-card__stat-value">{Number(fork.target_original_gravity || 0).toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="recipe-details__section">
            <h2 className="recipe-details__section-title">{t('Brewing Steps')}</h2>
            <ol className="recipe-details__step-list">
              {(currentRecipe.steps || []).map((step) => (
                <li key={step.id} className="recipe-details__step-item">
                  <div className="recipe-details__step-header">
                    <strong className="recipe-details__step-title">{step.title}</strong>
                    <span className="recipe-details__badge recipe-details__badge--outline">
                      {t(`constants.step_phases.${step.phase?.toLowerCase() || 'preparation'}`, step.phase || 'Preparation') as string}
                    </span>
                  </div>
                  
                  {/* ИЗМЕНЕНИЕ ЗДЕСЬ: Добавлено style={{ whiteSpace: 'pre-wrap' }} чтобы включить абзацы */}
                  <div 
                    className="recipe-details__step-desc" 
                    style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--text-secondary)' }}
                  >
                    {step.description}
                  </div>
                  
                  <div className="recipe-details__step-meta">
                    <span className="recipe-details__step-duration">
                      {step.durationValue || 0} {t(`constants.units.${step.durationUnit?.toLowerCase() || 'minutes'}`, step.durationUnit) as string}
                    </span>
                    {step.targetTempC != null && <span className="recipe-details__step-temp">{step.targetTempC} °C</span>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

        </main>

        <aside className="recipe-details__sidebar">
          <RecipeCostWidget
            ingredients={currentRecipe.ingredients || []}
            batchSizeLiters={currentRecipe.expectedBatchSizeLiters || 0}
          />
          <RecipePerformanceWidget 
            totalBrews={activeRecipeStats?.totalBrews} 
            completedBrews={activeRecipeStats?.completedBrews} 
            avgAiScore={activeRecipeStats?.avgAiScore} 
            avgUserRating={activeRecipeStats?.avgUserRating}
            totalUserRatings={activeRecipeStats?.totalUserRatings}
            currentUserRating={activeRecipeStats?.currentUserRating}
            onRateRecipe={async (score) => {
              if (currentRecipe?.id) {
                 await rateRecipe(currentRecipe.id, score);
              }
            }}
          />
          
          <div className="stat-panel">
            <h3 className="stat-panel__title">{t('Specifications')}</h3>
            <ul className="stat-panel__list">
              <li className="stat-panel__item">
                <span className="stat-panel__label">{t('Batch Size')}</span>
                <span className="stat-panel__value">{currentRecipe.expectedBatchSizeLiters || 0} {t('L')}</span>
              </li>
              <li className="stat-panel__item">
                <span className="stat-panel__label">{t('Estimated ABV')}</span>
                <span className="stat-panel__value stat-panel__value--highlight">{(currentRecipe.targetAbv || 0).toFixed(1)}%</span>
              </li>
              <li className="stat-panel__item">
                <span className="stat-panel__label">{t('OG / FG')}</span>
                <span className="stat-panel__value">{(currentRecipe.targetOriginalGravity || 0).toFixed(3)} / {(currentRecipe.targetFinalGravity || 0).toFixed(3)}</span>
              </li>
              {currentRecipe.beverageType === 'Beer' && (
                <>
                  <li className="stat-panel__item">
                    <span className="stat-panel__label">{t('Target IBU')}</span>
                    <span className="stat-panel__value">{(currentRecipe.targetIbu || 0).toFixed(1)}</span>
                  </li>
                  <li className="stat-panel__item">
                    <span className="stat-panel__label">{t('Target Color (EBC)')}</span>
                    <span className="stat-panel__value">{(currentRecipe.targetColorEbc || 0).toFixed(1)}</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {selectedRecipeTosna && (() => {
            const isSession = (currentRecipe.targetOriginalGravity || 1.000) < 1.050;
            const totalFermaid = selectedRecipeTosna.totalFermaidOGrams || 0;
            const dose = isSession ? (totalFermaid / 2).toFixed(1) : (totalFermaid / 4).toFixed(1);

            return (
              <div className="stat-panel">
                <h3 className="stat-panel__title">{t('TOSNA 3.0 Schedule')}</h3>
                <ul className="stat-panel__list stat-panel__list--stacked">
                  {isSession ? (
                    <>
                      <li className="stat-panel__item stat-panel__item--row">
                        <span className="stat-panel__label">{t('Initial Feed', 'Стартовое питание')} ({t('0h')})</span>
                        <span className="stat-panel__value">{dose}g</span>
                      </li>
                      <li className="stat-panel__item stat-panel__item--row">
                        <span className="stat-panel__label">{t('Final Feed', 'Финальное питание')} ({t('24h')})</span>
                        <span className="stat-panel__value">{dose}g</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="stat-panel__item stat-panel__item--row">
                        <span className="stat-panel__label">{t('Addition 1')} ({t('24h')})</span>
                        <span className="stat-panel__value">{dose}g</span>
                      </li>
                      <li className="stat-panel__item stat-panel__item--row">
                        <span className="stat-panel__label">{t('Addition 2')} ({t('48h')})</span>
                        <span className="stat-panel__value">{dose}g</span>
                      </li>
                      <li className="stat-panel__item stat-panel__item--row">
                        <span className="stat-panel__label">{t('Addition 3')} ({t('72h')})</span>
                        <span className="stat-panel__value">{dose}g</span>
                      </li>
                      <li className="stat-panel__item stat-panel__item--row">
                        <span className="stat-panel__label">{t('Addition 4')} ({t('1/3 Sugar Break')})</span>
                        <span className="stat-panel__value">{dose}g</span>
                      </li>
                    </>
                  )}
                </ul>
                {!isSession && (
                  <div className="stat-panel__footer">
                    <span className="stat-panel__subtext">
                      {t('Target SG for final addition')}: <strong>{calculateOneThirdSugarBreak(currentRecipe.targetOriginalGravity || 1.000, currentRecipe.targetFinalGravity || 1.000).toFixed(3)}</strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </aside>
      </div>
    </div>
  );
};

export default RecipeDetails;