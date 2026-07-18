import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaMagic } from 'react-icons/fa';

interface IngredientFormulationSectionProps {
  targetAutoAbv: number;
  setTargetAutoAbv: (v: number) => void;
  handleAutoCalculateHoney: () => void;
  children: React.ReactNode;
}

export const IngredientFormulationSection: React.FC<IngredientFormulationSectionProps> = ({
  targetAutoAbv,
  setTargetAutoAbv,
  handleAutoCalculateHoney,
  children
}) => {
  const { t } = useTranslation();

  return (
    <section className="builder-section">
      <div className="builder-section__header builder-section__header--flex">
        <h2 className="builder-section__title">{t('Ingredients Formulation')}</h2>
        <div className="builder-auto-calc">
          <span className="builder-auto-calc__label">{t('Target ABV')}:</span>
          <input
            className="builder-auto-calc__input"
            type="number"
            step="0.1"
            min="1"
            max="20"
            value={targetAutoAbv || 5.0}
            onChange={(e) => setTargetAutoAbv(parseFloat(e.target.value) || 5.0)}
          />
          <button
            type="button"
            className="builder-auto-calc__btn"
            onClick={handleAutoCalculateHoney}
            title={t('Auto-calculate fermentable grams needed for this ABV')}
          >
            <FaMagic /> {t('Auto-Scale')}
          </button>
        </div>
      </div>

      <div className="builder-section__body builder-section__body--spaced">
        {children}
      </div>
    </section>
  );
};