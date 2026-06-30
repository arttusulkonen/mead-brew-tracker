// src/pages/RecipeDetails.tsx
import { calculateOneThirdSugarBreak, calculateTosna } from '@mead-tracker/math';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useRecipeStore } from '../store/useRecipeStore';

const RecipeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentRecipe, fetchRecipeById, clearCurrentRecipe, isLoading, deleteRecipe } = useRecipeStore();

  useEffect(() => {
    fetchRecipeById(id);
    return () => clearCurrentRecipe();
  }, [id, fetchRecipeById, clearCurrentRecipe]);

  // Раньше тут был отдельный fetch каталога ингредиентов из Supabase, и nFactor
  // для TOSNA считался по template.nitrogenDemand, найденному в этом каталоге.
  // Но raw-строки Supabase отдают snake_case (nitrogen_demand), а не camelCase,
  // поэтому совпадение никогда не находилось и nFactor всегда был дефолтным (0.90).
  // Теперь каждый ингредиент в рецепте хранит собственный snapshot характеристик
  // (см. Recipes.tsx), включая nitrogenDemand для дрожжей — читаем его прямо
  // оттуда, без лишнего похода в базу.
  const selectedRecipeTosna = useMemo(() => {
    if (!currentRecipe || currentRecipe.beverageType !== 'Mead') return null;

    let yeastAddedGrams = 0;
    let yeastNitrogenDemand: 'Low' | 'Medium' | 'High' | 'Very High' | undefined;
    let customNutrientName = '';

    currentRecipe.ingredients.forEach(ing => {
      const item = ing as any;
      if (item.category === 'Yeast') {
        yeastAddedGrams += item.quantity || 0;
        if (item.nitrogenDemand) yeastNitrogenDemand = item.nitrogenDemand;
      } else if (item.category === 'Additive') {
        if ((item.dosagePer10Liters || item.dosagePerGramYeast) && !customNutrientName) {
          customNutrientName = item.name;
        }
      }
    });

    if (yeastAddedGrams > 0 && currentRecipe.targetOriginalGravity > 1.000) {
      let nFactor = 0.90;
      if (yeastNitrogenDemand === 'Low') nFactor = 0.75;
      else if (yeastNitrogenDemand === 'High' || yeastNitrogenDemand === 'Very High') nFactor = 1.25;

      return {
        ...calculateTosna(currentRecipe.expectedBatchSizeLiters, currentRecipe.targetOriginalGravity, nFactor),
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

  /**
   * Handles the deletion of the current recipe.
   */
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
    return <div className="recipe-details__loading">{t('Loading recipe...')}</div>;
  }

  if (!currentRecipe) {
    return (
      <div className="recipe-details recipe-details--empty">
        <h2 className="recipe-details__empty-title">{t('Recipe not found')}</h2>
        <button type="button" className="recipe-details__btn-secondary" onClick={() => navigate('/recipes')}>
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
          <span className="recipe-details__subtitle">{t(`constants.beverage_types.${currentRecipe.beverageType.toLowerCase()}`, currentRecipe.beverageType)} &bull; {currentRecipe.targetStyle}</span>
        </div>
        <div className="recipe-details__actions">
          <button type="button" className="recipe-details__btn-secondary" onClick={handleEdit}>{t('Edit')}</button>
          <button type="button" className="recipe-details__btn-danger" onClick={handleDelete}>{t('Delete')}</button>
          <button type="button" className="recipe-details__btn-primary" onClick={() => navigate(`/brew/setup/${currentRecipe.id}`)}>{t('Start Brew')}</button>
        </div>
      </header>

      <div className="recipe-details__layout">
        <main className="recipe-details__main">
          
          <section className="recipe-details__section">
            <h2 className="recipe-details__section-title">{t('Ingredients')}</h2>
            <ul className="recipe-details__ingredient-list">
              {currentRecipe.ingredients.map(ing => {
                const item = ing as any;
                return (
                  <li key={ing.id} className="recipe-details__ingredient-item">
                    <div className="recipe-details__ingredient-info">
                      <span className="recipe-details__badge">{t(`constants.categories.${ing.category.toLowerCase().replace(' ', '_')}`, ing.category)}</span>
                      <strong className="recipe-details__ingredient-name">{ing.name}</strong>
                      {item.additionStage && (
                        <span className="recipe-details__badge recipe-details__badge--outline">{item.additionStage}</span>
                      )}
                    </div>
                    <span className="recipe-details__ingredient-quantity">{ing.quantity} {t('g')}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="recipe-details__section">
            <h2 className="recipe-details__section-title">{t('Brewing Steps')}</h2>
            <ol className="recipe-details__step-list">
              {currentRecipe.steps.map((step) => (
                <li key={step.id} className="recipe-details__step-item">
                  <div className="recipe-details__step-header">
                    <strong className="recipe-details__step-title">{step.title}</strong>
                    <span className="recipe-details__badge recipe-details__badge--outline">{t(`constants.step_phases.${step.phase.toLowerCase()}`, step.phase)}</span>
                  </div>
                  <p className="recipe-details__step-desc">{step.description}</p>
                  <div className="recipe-details__step-meta">
                    <span className="recipe-details__step-duration">{step.durationValue} {t(step.durationUnit, step.durationUnit)}</span>
                    {step.targetTempC && <span className="recipe-details__step-temp">{step.targetTempC} °C</span>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

        </main>

        <aside className="recipe-details__sidebar">
          <div className="stat-panel">
            <h3 className="stat-panel__title">{t('Specifications')}</h3>
            <ul className="stat-panel__list">
              <li className="stat-panel__item">
                <span className="stat-panel__label">{t('Batch Size')}</span>
                <span className="stat-panel__value">{currentRecipe.expectedBatchSizeLiters} {t('L')}</span>
              </li>
              <li className="stat-panel__item">
                <span className="stat-panel__label">{t('Estimated ABV')}</span>
                <span className="stat-panel__value stat-panel__value--highlight">{currentRecipe.targetAbv?.toFixed(1)}%</span>
              </li>
              <li className="stat-panel__item">
                <span className="stat-panel__label">{t('OG / FG')}</span>
                <span className="stat-panel__value">{currentRecipe.targetOriginalGravity?.toFixed(3)} / {currentRecipe.targetFinalGravity?.toFixed(3)}</span>
              </li>
              {currentRecipe.beverageType === 'Beer' && (
                <>
                  <li className="stat-panel__item">
                    <span className="stat-panel__label">{t('Target IBU')}</span>
                    <span className="stat-panel__value">{currentRecipe.targetIbu?.toFixed(1) || '0.0'}</span>
                  </li>
                  <li className="stat-panel__item">
                    <span className="stat-panel__label">{t('Target Color (EBC)')}</span>
                    <span className="stat-panel__value">{currentRecipe.targetColorEbc?.toFixed(1) || '0.0'}</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {selectedRecipeTosna && (
            <div className="stat-panel">
              <h3 className="stat-panel__title">{t('TOSNA 3.0 Schedule')}</h3>
              <ul className="stat-panel__list stat-panel__list--stacked">
                <li className="stat-panel__item stat-panel__item--row">
                  <span className="stat-panel__label">{t('Addition 1')} ({t('24h')})</span>
                  <span className="stat-panel__value">{selectedRecipeTosna.dosePerAdditionGrams}g</span>
                </li>
                <li className="stat-panel__item stat-panel__item--row">
                  <span className="stat-panel__label">{t('Addition 2')} ({t('48h')})</span>
                  <span className="stat-panel__value">{selectedRecipeTosna.dosePerAdditionGrams}g</span>
                </li>
                <li className="stat-panel__item stat-panel__item--row">
                  <span className="stat-panel__label">{t('Addition 3')} ({t('72h')})</span>
                  <span className="stat-panel__value">{selectedRecipeTosna.dosePerAdditionGrams}g</span>
                </li>
                <li className="stat-panel__item stat-panel__item--row">
                  <span className="stat-panel__label">{t('Addition 4')} ({t('1/3 Sugar Break')})</span>
                  <span className="stat-panel__value">{selectedRecipeTosna.dosePerAdditionGrams}g</span>
                </li>
              </ul>
              <div className="stat-panel__footer">
                 <span className="stat-panel__subtext">{t('Target SG for final addition')}: {calculateOneThirdSugarBreak(currentRecipe.targetOriginalGravity).toFixed(3)}</span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default RecipeDetails;