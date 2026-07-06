// src/components/recipe-components/CoreParametersSection.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BeverageType } from '../../types/recipe';
import type { BjcpStyle } from '../../utils/bjcpMatchEngine';

interface CoreParametersSectionProps {
  beverageType: BeverageType;
  setBeverageType: (v: BeverageType) => void;
  currentSelectedStyle: BjcpStyle | null;
  onOpenStyleModal: () => void;
  recipeName: string;
  setRecipeName: (v: string) => void;
  targetStyle: string;
  setTargetStyle: (v: string) => void;
  batchSizeLiters: number;
  setBatchSizeLiters: (v: number) => void;
  targetFg: number;
  setTargetFg: (v: number) => void;
}

export const CoreParametersSection: React.FC<CoreParametersSectionProps> = ({
  beverageType, setBeverageType,
  currentSelectedStyle, onOpenStyleModal,
  recipeName, setRecipeName,
  targetStyle, setTargetStyle,
  batchSizeLiters, setBatchSizeLiters,
  targetFg, setTargetFg
}) => {
  const { t } = useTranslation();

  return (
    <section className="builder-section">
      <div className="builder-section__header">
        <h2 className="builder-section__title">{t('Core Parameters')}</h2>
      </div>
      <div className="builder-section__body">
        <div className="form-field">
          <label className="form-field__label">{t('Beverage Type')}</label>
          <select className="form-field__select" value={beverageType} onChange={(e) => setBeverageType(e.target.value as BeverageType)}>
            <option value="Beer">{t('constants.beverage_types.beer', 'Beer')}</option>
            <option value="Mead">{t('constants.beverage_types.mead', 'Mead')}</option>
            <option value="Cider">{t('constants.beverage_types.cider', 'Cider')}</option>
          </select>
        </div>

        {beverageType === 'Beer' && (
          <div className="form-field">
            <label className="form-field__label">{t('BJCP Target Style')}</label>
            <div className="form-field__fake-input" onClick={onOpenStyleModal}>
              {currentSelectedStyle ? `[${currentSelectedStyle.style_id}] ${currentSelectedStyle.name}` : t('Select target style...')}
            </div>
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">{t('Recipe Name')}</label>
          <input
            className="form-field__input"
            type="text"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            placeholder={t('e.g. Traditional Wildflower Mead')}
          />
        </div>

        <div className="builder-row">
          {beverageType === 'Mead' && (
            <div className="form-field builder-row__item">
              <label className="form-field__label">{t('Target ABV Tier')}</label>
              <select
                className="form-field__select"
                value={targetStyle}
                onChange={(e) => setTargetStyle(e.target.value)}
              >
                <option value="Session (4-6%)">{t('Session (4-6%) - Light & Drinkable')}</option>
                <option value="Standard (7-10%)">{t('Standard (7-10%) - Traditional')}</option>
                <option value="Wine/Sack (11%+)">{t('Wine/Sack (11%+) - Strong & Sweet')}</option>
                <option value="Custom">{t('Custom')}</option>
              </select>
            </div>
          )}
          <div className="form-field builder-row__item">
            <label className="form-field__label">{t('Batch Size (Liters)')}</label>
            <input
              className="form-field__input"
              type="number"
              min="1"
              value={batchSizeLiters || ''}
              onChange={(e) => setBatchSizeLiters(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-field builder-row__item">
            <label className="form-field__label">{t('Target FG')}</label>
            <input
              className="form-field__input"
              type="number"
              step="0.001"
              min="0.990"
              max="1.150"
              value={targetFg || ''}
              onChange={(e) => setTargetFg(parseFloat(e.target.value) || 1.000)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};