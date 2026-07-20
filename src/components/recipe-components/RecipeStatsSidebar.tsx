// src/components/recipe-components/RecipeStatsSidebar.tsx
import type { TosnaRequirements } from '@mead-tracker/math';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import type { BeverageType } from '../../types/recipe';
import type { BjcpStyle, StyleValidationResult } from '../../utils/bjcpMatchEngine';
import type { RecipeIngredientEntry } from './types';

interface DynamicAdditive {
  id: string;
  name: string;
  totalGrams: number;
  rule: string;
  type: 'Yeast' | 'Nutrient' | 'Additive';
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
  onAddVirtualIngredient: (id: string, name: string, quantity: number, type: string) => void; // НОВЫЙ ПРОПС
  handleSaveRecipe: () => void;
  isSaving: boolean;
  recipeName: string;
  recipeIngredientsLength: number;
  editingRecipeId: string | null;
  recipeIngredients: RecipeIngredientEntry[];
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
  onAddVirtualIngredient,
  handleSaveRecipe,
  isSaving,
  recipeName,
  recipeIngredientsLength,
  editingRecipeId,
  recipeIngredients
}) => {
  const { t } = useTranslation();

  return (
    <aside className="builder-sidebar">
      <div className="stat-panel">
        <h3 className="stat-panel__title">{t('Estimated Specifications')}</h3>
        <ul className="stat-panel__list">
          <li className={`stat-panel__item ${!validation?.isOgValid ? 'stat-panel__item--warning' : ''}`}>
            <span className="stat-panel__label">{t('OG')}</span>
            <span className="stat-panel__value">{(recipeDetails?.og || 1.000).toFixed(3)}</span>
            {!validation?.isOgValid && currentSelectedStyle && <span className="stat-panel__range-hint">({(currentSelectedStyle.ogMin || 1.000).toFixed(3)}-{(currentSelectedStyle.ogMax || 1.000).toFixed(3)})</span>}
          </li>
          <li className={`stat-panel__item ${!validation?.isFgValid ? 'stat-panel__item--warning' : ''}`}>
            <span className="stat-panel__label">{t('FG')}</span>
            <span className="stat-panel__value">{(targetFg || 1.000).toFixed(3)}</span>
            {!validation?.isFgValid && currentSelectedStyle && <span className="stat-panel__range-hint">({(currentSelectedStyle.fgMin || 1.000).toFixed(3)}-{(currentSelectedStyle.fgMax || 1.000).toFixed(3)})</span>}
          </li>
          <li className={`stat-panel__item ${!validation?.isAbvValid || isAbvMismatch ? 'stat-panel__item--warning' : ''}`}>
            <span className="stat-panel__label">{t('ABV')}</span>
            <span className="stat-panel__value stat-panel__value--highlight">{(recipeDetails?.abv || 0).toFixed(1)}%</span>
            {!validation?.isAbvValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.abvMin || 0}-{currentSelectedStyle.abvMax || 0}%)</span>}
          </li>
          {beverageType === 'Beer' && (
            <>
              <li className={`stat-panel__item ${!validation?.isIbuValid ? 'stat-panel__item--warning' : ''}`}>
                <span className="stat-panel__label">{t('IBU')}</span>
                <span className="stat-panel__value">{(recipeDetails?.ibu || 0).toFixed(1)}</span>
                {!validation?.isIbuValid && currentSelectedStyle && <span className="stat-panel__range-hint">({currentSelectedStyle.ibuMin || 0}-{currentSelectedStyle.ibuMax || 0})</span>}
              </li>
              <li className={`stat-panel__item ${!validation?.isColorValid ? 'stat-panel__item--warning' : ''}`}>
                <span className="stat-panel__label">{t('EBC')}</span>
                <span className="stat-panel__value">{(recipeDetails?.ebc || 0).toFixed(1)}</span>
              </li>
            </>
          )}
        </ul>
        {!validation?.isValidOverall && beverageType === 'Beer' && (
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

      {(recipeDetails?.dynamicAdditives || []).length > 0 && (
        <div className="stat-panel">
          <h3 className="stat-panel__title">{t('Smart Scaling Calculator')}</h3>
          <ul className="stat-panel__list stat-panel__list--stacked">
            {(recipeDetails?.dynamicAdditives || []).map((add) => {
              const targetGrams = parseFloat((add?.totalGrams || 0).toFixed(1));
              const currentIng = (recipeIngredients || []).find(ing => ing?.id === add?.id);
              const isApplied = currentIng && Math.abs((currentIng.quantity || 0) - targetGrams) < 0.01;

              const isRehydration = add?.rule?.includes('Rehydration');
              const isSession = (recipeDetails?.abv || 0) < 6.5;

              let hintText: string;
              let isHintSuccess = false;

              if (add.id === 'virtual-erythritol' || add.name.toLowerCase().includes('эритрит')) {
                hintText = t('Adds body and safe sweetness without restarting fermentation.');
                isHintSuccess = true;
              } else if (add.id === 'virtual-dextrose' || add.name.toLowerCase().includes('декстроза')) {
                hintText = t('Boil into a syrup, cool down, and add before bottling.');
                isHintSuccess = true;
              } else if (add.type === 'Yeast') {
                hintText = t('Pitch Rate', 'Pitch Rate: ') + add.rule;
              } else if (isRehydration) {
                hintText = t('constants.nutrient_roles.rehydration_hint');
                isHintSuccess = true;
              } else {
                hintText = isSession
                  ? t('constants.nutrient_roles.fermentation_2step')
                  : t('constants.nutrient_roles.fermentation_4step');
              }

              return (
                <li className="stat-panel__item stat-panel__item--row" key={add.id}>
                  <div className="stat-panel__info stat-panel__info-col">
                    <span className="stat-panel__label stat-panel__label--bold">{add.name}</span>
                    <span className={`stat-panel__subtext stat-panel__subtext--flex ${isHintSuccess ? 'stat-panel__subtext--success' : 'stat-panel__subtext--muted'}`}>
                      <FaInfoCircle />
                      {hintText}
                    </span>
                  </div>
                  <div className="stat-panel__apply-group">
                    <strong className="stat-panel__value stat-panel__value--primary">{targetGrams} {t('g')}</strong>
                    <button
                      type="button"
                      className={`stat-panel__btn-apply ${isApplied ? 'stat-panel__btn-apply--applied' : ''}`}
                      onClick={() => {
                        if (currentIng) {
                          updateIngredient(add.id, { quantity: targetGrams });
                        } else {
                          onAddVirtualIngredient(add.id, add.name, targetGrams, add.type);
                        }
                      }}
                      disabled={isApplied}
                    >
                      {isApplied ? t('Applied', 'Applied') : t('Apply')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="recipe-lab__btn-primary recipe-lab__btn-primary--large mt-lg full-width"
        onClick={handleSaveRecipe}
        disabled={!recipeName || recipeIngredientsLength === 0 || isSaving}
      >
        {isSaving ? t('Saving...') : editingRecipeId ? t('Update Recipe') : t('Save Recipe')}
      </button>
    </aside>
  );
};