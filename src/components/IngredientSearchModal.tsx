// src/components/IngredientSearchModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes } from 'react-icons/fa';
import type { BaseIngredient, FermentableIngredient, HopsIngredient, YeastIngredient } from '../types/ingredient';

interface IngredientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ingredientId: string) => void;
  catalog: BaseIngredient[];
  initialCategory?: string;
  initialSearchQuery?: string;
}

export const IngredientSearchModal: React.FC<IngredientSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  catalog, 
  initialCategory = 'All', 
  initialSearchQuery = '' 
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);

  const categories = ['All', 'Fermentable', 'Hops', 'Yeast', 'Additive', 'Water Profile'];

  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialSearchQuery);
      setActiveCategory(initialCategory);
    }
  }, [isOpen, initialCategory, initialSearchQuery]);

  const filteredCatalog = useMemo(() => {
    return (catalog || []).filter(ing => {
      if (!ing) return false;
      const safeName = ing.name || '';
      const safeOrigin = ing.origin || '';
      const query = searchQuery.toLowerCase();
      
      const matchesSearch = safeName.toLowerCase().includes(query) || 
                            safeOrigin.toLowerCase().includes(query);
      const matchesCategory = activeCategory === 'All' || ing.category === activeCategory;
      
      return matchesSearch && matchesCategory;
    }).slice(0, 50); 
  }, [catalog, searchQuery, activeCategory]);

  if (!isOpen) return null;

  const renderDetails = (ing: BaseIngredient) => {
    if (ing.category === 'Hops') {
      const hop = ing as HopsIngredient;
      return (
        <div className="search-modal__meta-grid">
          <div className="search-modal__meta-item"><span>{t('Alpha')}</span><strong>{hop.alphaAcidPct || 0}%</strong></div>
          <div className="search-modal__meta-item"><span>{t('Form')}</span><strong>{t(`constants.hops_forms.${hop.form?.toLowerCase() || 'pellet'}`, hop.form || 'Pellet')}</strong></div>
          {hop.origin && <div className="search-modal__meta-item"><span>{t('Origin')}</span><strong>{hop.origin}</strong></div>}
        </div>
      );
    }
    if (ing.category === 'Yeast') {
      const yeast = ing as YeastIngredient;
      return (
        <div className="search-modal__meta-grid">
          <div className="search-modal__meta-item"><span>{t('Tolerance')}</span><strong>{yeast.alcoholTolerancePct || 0}%</strong></div>
          <div className="search-modal__meta-item"><span>{t('Temp')}</span><strong>{yeast.tempMinC || 0}-{yeast.tempMaxC || 0}°C</strong></div>
          <div className="search-modal__meta-item"><span>{t('Form')}</span><strong>{t(`constants.yeast_forms.${yeast.form?.toLowerCase() || 'dry'}`, yeast.form || 'Dry')}</strong></div>
          {yeast.producer && <div className="search-modal__meta-item"><span>{t('Producer')}</span><strong>{yeast.producer}</strong></div>}
        </div>
      );
    }
    if (ing.category === 'Fermentable') {
      const ferm = ing as FermentableIngredient;
      return (
        <div className="search-modal__meta-grid">
          <div className="search-modal__meta-item"><span>{t('Yield (PPG)')}</span><strong>{ferm.yieldPpg || 36}</strong></div>
          <div className="search-modal__meta-item"><span>{t('Color (EBC)')}</span><strong>{ferm.colorEbc || 5}</strong></div>
          <div className="search-modal__meta-item"><span>{t('Type')}</span><strong>{t(`constants.fermentable_types.${ferm.type?.toLowerCase() || 'grain'}`, ferm.type || 'Grain')}</strong></div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal__header">
          <h2>{t('Search Ingredients')}</h2>
          <button type="button" className="search-modal__close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="search-modal__filters">
          <div className="search-modal__search-bar">
            <FaSearch className="search-modal__search-icon" />
            <input 
              type="text" 
              placeholder={t('Type to search...')} 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="search-modal__category-tabs">
            {categories.map(cat => (
              <button 
                key={cat}
                type="button"
                className={`search-modal__tab ${activeCategory === cat ? 'search-modal__tab--active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'All' ? t('All') : t(`constants.categories.${cat.toLowerCase().replace(' ', '_')}`, cat)}
              </button>
            ))}
          </div>
        </div>
        <div className="search-modal__body">
          <ul className="search-modal__list">
            {filteredCatalog.map(ing => (
              <li key={ing.id} className="search-modal__list-item" onClick={() => onSelect(ing.id)}>
                <div className="search-modal__item-header">
                  <span className={`search-modal__badge search-modal__badge--${(ing.category || 'other').toLowerCase().replace(' ', '-')}`}>
                    {t(`constants.categories.${(ing.category || 'other').toLowerCase().replace(' ', '_')}`, ing.category || 'Other')}
                  </span>
                  <strong className="search-modal__item-title">{ing.name || t('Unknown')}</strong>
                </div>
                {renderDetails(ing)}
                {ing.notes && <p className="search-modal__item-desc">{ing.notes.substring(0, 120)}{ing.notes.length > 120 ? '...' : ''}</p>}
              </li>
            ))}
            {filteredCatalog.length === 0 && (
              <li className="search-modal__empty">{t('No ingredients found.')}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};