// src/components/recipe-components/MeadWizardSection.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle, FaMagic } from 'react-icons/fa';
import type { AdditiveType, BaseIngredient, IngredientCategory } from '../../types/ingredient';
import { HONEY_TERROIR, MEAD_STYLES, SWEETNESS_LEVELS } from '../../utils/meadConstants';

interface MeadWizardSectionProps {
  wizardStyle: string;
  setWizardStyle: (v: string) => void;
  wizardSweetness: string;
  setWizardSweetness: (v: string) => void;
  setTargetFg: (v: number) => void;
  wizardHoney: string;
  setWizardHoney: (v: string) => void;
  meadIngredientHint: { category: IngredientCategory; additiveType?: AdditiveType; label: string } | null;
  meadYeastSuggestions: BaseIngredient[];
  openIngredientModal: (category: IngredientCategory, search?: string, additiveType?: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const MeadWizardSection: React.FC<MeadWizardSectionProps> = ({
  wizardStyle, setWizardStyle,
  wizardSweetness, setWizardSweetness, setTargetFg,
  wizardHoney, setWizardHoney,
  meadIngredientHint,
  meadYeastSuggestions,
  openIngredientModal,
  isGenerating,
  onGenerate
}) => {
  const { t } = useTranslation();

  return (
    <section className="builder-section">
      <div className="builder-section__header">
        <h2 className="builder-section__title"><FaMagic /> {t('Smart Recipe Wizard')}</h2>
      </div>
      <div className="builder-section__body">
        <div className="builder-row">
          <div className="form-field builder-row__item">
            <label className="form-field__label">{t('Base Style')}</label>
            <select className="form-field__select" value={wizardStyle} onChange={e => setWizardStyle(e.target.value)}>
              {MEAD_STYLES.map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
            </select>
          </div>
          <div className="form-field builder-row__item">
            <label className="form-field__label">{t('Sweetness / FG')}</label>
            <select className="form-field__select" value={wizardSweetness} onChange={e => {
              setWizardSweetness(e.target.value);
              const selected = SWEETNESS_LEVELS.find(lvl => lvl.id === e.target.value);
              if (selected) {
                setTargetFg(selected.minFg);
              }
            }}>
              {SWEETNESS_LEVELS.map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
            </select>
          </div>
          <div className="form-field builder-row__item">
            <label className="form-field__label">{t('Honey Terroir')}</label>
            <select className="form-field__select" value={wizardHoney} onChange={e => setWizardHoney(e.target.value)}>
              {HONEY_TERROIR.map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
            </select>
          </div>
        </div>

        {(meadIngredientHint || meadYeastSuggestions.length > 0) && (
          <div className="suggestions-box" style={{ marginTop: '1rem' }}>
            {meadIngredientHint && (
              <div className="suggestions-box__group">
                <h4><FaInfoCircle /> {t('Typically used for this mead style', 'Обычно используют для этого стиля мёда')}</h4>
                <button
                  type="button"
                  className="suggestion-tag"
                  onClick={() => openIngredientModal(meadIngredientHint.category, '', meadIngredientHint.additiveType || '')}
                >
                  {meadIngredientHint.label}
                </button>
              </div>
            )}
            {meadYeastSuggestions.length > 0 && (
              <div className="suggestions-box__group">
                <h4>{t('Suggested Yeasts for this ABV tier', 'Подходящие дрожжи для этого уровня ABV')}</h4>
                {meadYeastSuggestions.map(y => (
                  <button type="button" key={y.id} className="suggestion-tag" onClick={() => openIngredientModal('Yeast', y.name)}>{y.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="recipe-lab__btn-secondary recipe-lab__btn-secondary--full"
          onClick={onGenerate}
          disabled={isGenerating}
          style={{ marginTop: '1rem' }}
        >
          <FaMagic /> {isGenerating ? t('AI is thinking...') : t('Generate / Review Steps with AI')}
        </button>
      </div>
    </section>
  );
};