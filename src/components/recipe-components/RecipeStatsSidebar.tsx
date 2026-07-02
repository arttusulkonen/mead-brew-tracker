// src/components/recipe-components/RecipeStatsSidebar.tsx
import type { TosnaRequirements } from '@mead-tracker/math';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle } from 'react-icons/fa';
import type { BeverageType } from '../../types/recipe';
import type { BjcpStyle, StyleValidationResult } from '../../utils/bjcpMatchEngine';
import type { RecipeIngredientEntry } from './types';

interface DynamicAdditive {
  id: string;
  name: string;
  totalGrams: number;
  rule: string;
}

export interface RecipeDetailsStats {
  og: number;
  abv: number;
  ibu: number;
  ebc: number;
  tosna: TosnaRequirements | null;
  yeastAdded: number;
  dynamicAdditives: DynamicAdditive[];
}

interface RecipeStatsSidebarProps {
  validation: StyleValidationResult;
  currentSelectedStyle: BjcpStyle | null;
  targetFg: number;
  recipeDetails: RecipeDetailsStats;
  beverageType: BeverageType;
  isAbvMismatch: boolean;
  targetStyle: string;
  updateIngredient: (id: string, updates: Partial<RecipeIngredientEntry>) => void;
  handleSaveRecipe: () => void;
  isSaving: boolean;
  recipeName: string;
  recipeIngredientsLength: number;
  editingRecipeId: string | null;
}

export const RecipeStatsSidebar: React.FC<RecipeStatsSidebarProps> = ({
  validation,
  currentSelectedStyle,
  targetFg,
  recipeDetails,
  beverageType,
  isAbvMismatch,
  targetStyle,
  updateIngredient,
  handleSaveRecipe,
  isSaving,
  recipeName,
  recipeIngredientsLength,
  editingRecipeId
}) => {
  const { t } = useTranslation();

  return (
    <aside className="builder-sidebar">
      <div className="stat-panel">
        <h3 className="stat-panel__title">{t('Estimated Specifications')}</h3>
        <ul className="stat-panel__list">
          <li className={`stat-panel__item ${!validation.isOgValid ? 'stat-panel__item--warning' : ''}`}>
            <span className="stat-panel__label">{t('OG')}</span>
            <span className="stat-panel__value">{recipeDetails.og.toFixed(3)}</span>
            {!validation.isOgValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.ogMin?.toFixed(3)}-{currentSelectedStyle.ogMax?.toFixed(3)})</span>}
          </li>
          <li className={`stat-panel__item ${!validation.isFgValid ? 'stat-panel__item--warning' : ''}`}>
            <span className="stat-panel__label">{t('FG')}</span>
            <span className="stat-panel__value">{targetFg.toFixed(3)}</span>
            {!validation.isFgValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.fgMin?.toFixed(3)}-{currentSelectedStyle.fgMax?.toFixed(3)})</span>}
          </li>
          <li className={`stat-panel__item ${!validation.isAbvValid || isAbvMismatch ? 'stat-panel__item--warning' : ''}`}>
            <span className="stat-panel__label">{t('ABV')}</span>
            <span className="stat-panel__value stat-panel__value--highlight">{recipeDetails.abv.toFixed(1)}%</span>
            {!validation.isAbvValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.abvMin}-{currentSelectedStyle.abvMax}%)</span>}
          </li>
          {beverageType === 'Beer' && (
            <>
              <li className={`stat-panel__item ${!validation.isIbuValid ? 'stat-panel__item--warning' : ''}`}>
                <span className="stat-panel__label">{t('IBU')}</span>
                <span className="stat-panel__value">{recipeDetails.ibu.toFixed(1)}</span>
                {!validation.isIbuValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.ibuMin}-{currentSelectedStyle.ibuMax})</span>}
              </li>
              <li className={`stat-panel__item ${!validation.isColorValid ? 'stat-panel__item--warning' : ''}`}>
                <span className="stat-panel__label">{t('EBC')}</span>
                <span className="stat-panel__value">{recipeDetails.ebc.toFixed(1)}</span>
              </li>
            </>
          )}
        </ul>
        {!validation.isValidOverall && beverageType === 'Beer' && (
          <div className="style-alert">
            <FaExclamationTriangle />
            <p className="style-alert__text">{t('Recipe configuration parameters are outside the selected BJCP style boundaries.')}</p>
          </div>
        )}
        {isAbvMismatch && beverageType === 'Mead' && targetStyle !== 'Custom' && (
          <div className="style-alert">
            <FaExclamationTriangle />
            <p className="style-alert__text">{t('The calculated ABV does not match your selected Target Style. Adjust honey amount.')}</p>
          </div>
        )}
      </div>

      {recipeDetails.dynamicAdditives.length > 0 && (
        <div className="stat-panel">
          <h3 className="stat-panel__title">{t('Smart Additive Calculator')}</h3>
          <ul className="stat-panel__list stat-panel__list--stacked">
            {recipeDetails.dynamicAdditives.map((add) => (
              <li className="stat-panel__item stat-panel__item--row" key={add.id}>
                <div className="stat-panel__info" style={{display: 'flex', flexDirection: 'column'}}>
                  <span className="stat-panel__label">{add.name}</span>
                  <span className="stat-panel__subtext">{add.rule}</span>
                </div>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <strong className="stat-panel__value" style={{color: 'var(--color-primary)'}}>{add.totalGrams.toFixed(1)} g</strong>
                  <button
                    type="button"
                    className="stat-panel__btn-apply"
                    onClick={() => updateIngredient(add.id, { quantity: parseFloat(add.totalGrams.toFixed(1)) })}
                  >
                    {t('Apply')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="recipe-lab__btn-primary recipe-lab__btn-primary--large mt-md full-width"
        onClick={handleSaveRecipe}
        disabled={!recipeName || recipeIngredientsLength === 0 || isSaving}
        style={{marginTop: '1.5rem', width: '100%', display: 'flex', justifyContent: 'center'}}
      >
        {isSaving ? t('Saving...') : editingRecipeId ? t('Update Recipe') : t('Save Recipe')}
      </button>
    </aside>
  );
};