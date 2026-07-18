// src/components/recipe-components/IngredientGroup.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaMagic, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import type { IngredientCategory } from '../../types/ingredient';
import type { BeverageType } from '../../types/recipe';
import type { AiIngredientProposal, RecipeIngredientEntry } from './types';

interface IngredientGroupProps {
  category: IngredientCategory;
  title: string;
  beverageType: BeverageType;
  recipeIngredients: RecipeIngredientEntry[];
  aiProposedIngredients: AiIngredientProposal[];
  isSaving: boolean;
  onOpenModal: (category: IngredientCategory) => void;
  onUpdateIngredient: (id: string, updates: Partial<RecipeIngredientEntry>) => void;
  onRemoveIngredient: (id: string) => void;
  onAcceptProposal: (proposal: AiIngredientProposal) => void;
  onRejectProposal: (ingredientId: string) => void;
}

const formatRange = (min: number | undefined, max: number | undefined) => {
  return min && min !== max ? `${min}-${max}` : `${max || 0}`;
};

export const IngredientGroup: React.FC<IngredientGroupProps> = ({
  category,
  title,
  beverageType,
  recipeIngredients,
  aiProposedIngredients,
  isSaving,
  onOpenModal,
  onUpdateIngredient,
  onRemoveIngredient,
  onAcceptProposal,
  onRejectProposal
}) => {
  const { t } = useTranslation();

  const items = (recipeIngredients || []).filter(i =>
    category === 'Additive' ? (i.category === 'Additive' || i.category === 'Water Profile') : i.category === category
  );

  return (
    <div className="ingredient-group">
      <div className="ingredient-group__header">
        <h3 className="ingredient-group__title">
          {title}{items.length > 0 && <span className="ingredient-group__count"> ({items.length})</span>}
        </h3>
        <button type="button" className="btn-secondary btn-secondary--small" onClick={() => onOpenModal(category)}>
          <FaPlus /> {t('Add')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="ingredient-group__empty-text">{t('Not added yet')}</div>
      ) : (
        <div className="ingredient-list ingredient-list--spaced">
          {items.map(item => {
            const aiProposal = (aiProposedIngredients || []).find(p => p.ingredientId === item.id);

            return (
              <div key={item.id} className="recipe-ingredient">
                <div className="recipe-ingredient__main">
                  <div className="recipe-ingredient__info recipe-ingredient__info-col">
                    <span className="recipe-ingredient__name">{item.name}</span>
                    <span className="recipe-ingredient__meta recipe-ingredient__meta-text">
                      {item.category === 'Hops' && `${t('Alpha')}: ${formatRange(item.alphaAcidPctMin, item.alphaAcidPct)}%`}
                      {item.category === 'Fermentable' && `${t('Yield')}: ${item.yieldPpg ?? 0} PPG | ${t('Color')}: ${item.colorEbc ?? 0} EBC`}
                      {item.category === 'Honey' && `${t('Sugar Content')}: ${item.sugarContentBrix ?? 0} Brix | ${t('Moisture')}: ${item.moistureContentPct ?? 0}%`}
                      {item.category === 'Yeast' && `${t('Tolerance')}: ${formatRange(item.alcoholTolerancePctMin, item.alcoholTolerancePct)}% | ${t('Attenuation')}: ${formatRange(item.attenuationPctMin, item.attenuationPct)}%`}
                      {(item.category === 'Additive' || item.category === 'Water Profile') && [
                        item.additiveType ? t(`constants.additive_types.${item.additiveType.toLowerCase()}`, item.additiveType) : '',
                        item.nutrientRole ? t(`constants.nutrient_roles.${item.nutrientRole.toLowerCase()}`, item.nutrientRole) : '',
                        item.additionStage
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="recipe-ingredient__controls">
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => onUpdateIngredient(item.id, { showNote: !item.showNote })}
                      disabled={isSaving}
                    >
                      {item.showNote ? t('- Note') : t('+ Note')}
                    </button>

                    {beverageType === 'Beer' && item.category === 'Hops' && (
                      <div className="recipe-ingredient__hop-boil">
                        <input
                          className="form-field__input form-field__input--small"
                          type="number"
                          min="0"
                          value={item.boilTimeMinutes === 0 ? '' : (item.boilTimeMinutes || '')}
                          onChange={(e) => onUpdateIngredient(item.id, { boilTimeMinutes: parseFloat(e.target.value) || 0 })}
                          placeholder={t('min')}
                          disabled={isSaving}
                        />
                        <span className="recipe-ingredient__unit">{t('min')}</span>
                      </div>
                    )}

                    <input
                      className="form-field__input form-field__input--small"
                      type="number"
                      min="0"
                      value={item.quantity === 0 ? '' : (item.quantity || '')}
                      onChange={(e) => onUpdateIngredient(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      disabled={isSaving}
                    />
                    <span className="recipe-ingredient__unit">{t('g')}</span>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => onRemoveIngredient(item.id)}
                      disabled={isSaving}
                      aria-label={t('Remove')}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                {item.showNote && (
                  <div className="recipe-ingredient__note">
                    <textarea
                      value={item.note || ''}
                      onChange={(e) => onUpdateIngredient(item.id, { note: e.target.value })}
                      placeholder={t('Add detailed notes for this ingredient...')}
                      className="form-field__textarea"
                      rows={2}
                      disabled={isSaving}
                    />
                  </div>
                )}
                {aiProposal && (
                  <div className="ai-diff-box recipe-ingredient__ai-adjust">
                    <h4><FaMagic /> {t('AI Proposed Adjustment')}</h4>
                    <div>
                      <strong>{t('Suggested Quantity')}:</strong> {aiProposal.suggestedQuantityGrams || 0} {t('g')} <br />
                      {aiProposal.aiNote && <span><strong>{t('Note')}:</strong> {aiProposal.aiNote}</span>}
                    </div>
                    <div className="diff-actions">
                      <button type="button" className="btn-accept" onClick={() => onAcceptProposal(aiProposal)}>
                        <FaCheck /> {t('Accept')}
                      </button>
                      <button type="button" className="btn-reject" onClick={() => onRejectProposal(item.id)}>
                        <FaTimes /> {t('Reject')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};