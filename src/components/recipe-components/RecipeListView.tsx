// src/components/recipe-components/RecipeListView.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import type { Recipe } from '../../types/recipe';

interface RecipeListViewProps {
  recipes: Recipe[];
  isLoading: boolean;
  onCreate: () => void;
}

export const RecipeListView: React.FC<RecipeListViewProps> = ({ recipes, isLoading, onCreate }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="recipe-lab">
      <header className="recipe-lab__header">
        <div className="recipe-lab__title-block">
          <h1 className="recipe-lab__title">{t('Recipes')}</h1>
        </div>
        <button type="button" className="recipe-lab__btn-primary" onClick={onCreate}>
          <FaPlus /> {t('Create Recipe')}
        </button>
      </header>

      {isLoading ? (
        <div className="recipe-lab__loading">{t('Loading recipes...')}</div>
      ) : recipes.length === 0 ? (
        <div className="recipe-lab__empty-state">
          <p className="recipe-lab__empty-text">{t('No recipes found. Create your first recipe!')}</p>
        </div>
      ) : (
        <ul className="recipe-list">
          {recipes.map(recipe => (
            <li
              key={recipe.id}
              className="recipe-card recipe-card--interactive"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/recipes/${recipe.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/recipes/${recipe.id}`);
                }
              }}
            >
              <div className="recipe-card__header">
                <span className="recipe-card__badge">{t(`constants.beverage_types.${recipe.beverageType?.toLowerCase() || 'mead'}`, recipe.beverageType || 'Mead')}</span>
                <h3 className="recipe-card__title">{recipe.name}</h3>
              </div>
              <div className="recipe-card__meta-stack">
                <div className="recipe-card__meta-row">
                  <span className="recipe-card__style">{recipe.targetStyle}</span>
                  <span className="recipe-card__abv">{recipe.targetAbv?.toFixed(1)}% ABV</span>
                </div>
                <div className="recipe-card__meta-row">
                  <span>{t('Batch Size')}</span>
                  <span>{recipe.expectedBatchSizeLiters} {t('L')}</span>
                </div>
                <div className="recipe-card__meta-row">
                  <span>{t('Original Gravity')}</span>
                  <span>{recipe.targetOriginalGravity?.toFixed(3)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};