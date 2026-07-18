import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle } from 'react-icons/fa';
import type { BaseIngredient, IngredientCategory } from '../../types/ingredient';
import type { BjcpStyle } from '../../utils/bjcpMatchEngine';

interface BeerSuggestionsSectionProps {
  currentSelectedStyle: BjcpStyle | null;
  suggestions: { hops?: BaseIngredient[]; yeasts?: BaseIngredient[] };
  openIngredientModal: (category: IngredientCategory, search?: string) => void;
}

export const BeerSuggestionsSection: React.FC<BeerSuggestionsSectionProps> = ({
  currentSelectedStyle,
  suggestions,
  openIngredientModal
}) => {
  const { t } = useTranslation();

  if (!(suggestions?.hops?.length) && !(suggestions?.yeasts?.length)) return null;

  return (
    <section className="builder-section builder-section--suggestions">
      <h3 className="builder-section__title">
        <FaInfoCircle /> {t('Suggested for')} {currentSelectedStyle?.name || t('Selected Style')}
      </h3>
      <div className="suggestions-box">
        {suggestions?.yeasts && suggestions.yeasts.length > 0 && (
          <div className="suggestions-box__group">
            <h4>{t('Yeasts')}</h4>
            {suggestions.yeasts.map(y => (
              <button type="button" key={y.id} className="suggestion-tag" onClick={() => openIngredientModal('Yeast', y.name)}>{y.name}</button>
            ))}
          </div>
        )}
        {suggestions?.hops && suggestions.hops.length > 0 && (
          <div className="suggestions-box__group">
            <h4>{t('Hops')}</h4>
            {suggestions.hops.map(h => (
              <button type="button" key={h.id} className="suggestion-tag" onClick={() => openIngredientModal('Hops', h.name)}>{h.name}</button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};