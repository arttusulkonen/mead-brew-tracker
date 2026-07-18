// src/components/recipe-components/RecipeListView.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaBookOpen, FaPlus, FaStar } from 'react-icons/fa';
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
        <div className="recipe-lab__loading"><div className="spinner"></div></div>
      ) : (recipes || []).length === 0 ? (
        <div className="recipe-lab__empty-state">
          <FaBookOpen className="recipe-lab__empty-icon" />
          <p className="recipe-lab__empty-text">{t('No recipes found. Create your first recipe!')}</p>
          <button type="button" className="recipe-lab__btn-secondary" onClick={onCreate}>
            {t('Get Started')}
          </button>
        </div>
      ) : (
        <ul className="recipe-list">
          {(recipes || []).map(recipe => {
            // Расширяем тип на лету для получения доступа к полям аналитики
            const extendedRecipe = recipe as Recipe & { 
              totalBrews?: number; 
              avgAiScore?: number | null;
              avgUserRating?: number | null;
              totalUserRatings?: number;
            };
            
            return (
              <li
                key={recipe.id}
                className="recipe-card"
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
                <div className="recipe-card__main">
                  <div className="recipe-card__header">
                    <h3 className="recipe-card__title">{recipe.name}</h3>
                    <span className="recipe-card__badge">
                      {t(`constants.beverage_types.${recipe.beverageType?.toLowerCase() || 'mead'}`, recipe.beverageType || 'Mead') as string}
                    </span>
                  </div>
                  
                  {/* Блок мета-данных со строгими BEM классами */}
                  <div className="recipe-card__meta">
                    <span className="recipe-card__meta-item">{recipe.targetStyle}</span>
                    <span className="recipe-card__meta-divider">•</span>
                    <span className="recipe-card__meta-item">{recipe.expectedBatchSizeLiters} {t('L')}</span>
                    
                    {extendedRecipe.totalBrews ? (
                      <>
                        <span className="recipe-card__meta-divider">•</span>
                        <span className="recipe-card__meta-item">
                          📊 {t('Brews', 'Варок')}: <strong>{extendedRecipe.totalBrews}</strong>
                        </span>
                      </>
                    ) : null}

                    {/* Пользовательский рейтинг */}
                    {extendedRecipe.avgUserRating !== null && extendedRecipe.avgUserRating !== undefined && (
                      <>
                        <span className="recipe-card__meta-divider">•</span>
                        <span className="recipe-card__meta-item recipe-card__meta-item--user-rating">
                          <FaStar className="recipe-card__star-icon" /> {extendedRecipe.avgUserRating.toFixed(1)}
                          <span className="recipe-card__meta-count">
                            ({extendedRecipe.totalUserRatings || 0})
                          </span>
                        </span>
                      </>
                    )}
                    
                    {/* ИИ Рейтинг */}
                    {extendedRecipe.avgAiScore !== null && extendedRecipe.avgAiScore !== undefined && (
                      <>
                        <span className="recipe-card__meta-divider">•</span>
                        <span className="recipe-card__meta-item recipe-card__meta-item--ai-rating">
                          ✨ ИИ: {extendedRecipe.avgAiScore}/100
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="recipe-card__stats">
                  <div className="recipe-card__stat">
                    <span className="recipe-card__stat-label">{t('ABV')}</span>
                    <span className="recipe-card__stat-value recipe-card__stat-value--highlight">
                      {(recipe.targetAbv || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="recipe-card__stat">
                    <span className="recipe-card__stat-label">{t('Size')}</span>
                    <span className="recipe-card__stat-value">
                      {recipe.expectedBatchSizeLiters || 0} {t('L')}
                    </span>
                  </div>
                  <div className="recipe-card__stat">
                    <span className="recipe-card__stat-label">{t('OG')}</span>
                    <span className="recipe-card__stat-value">
                      {(recipe.targetOriginalGravity || 1.000).toFixed(3)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};