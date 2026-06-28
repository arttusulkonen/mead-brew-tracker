import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes } from 'react-icons/fa';
import type { BjcpStyle } from '../utils/bjcpMatchEngine';

interface StyleSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (styleId: string) => void;
  styles: BjcpStyle[];
  beverageType: string;
}

export const StyleSearchModal: React.FC<StyleSearchModalProps> = ({ isOpen, onClose, onSelect, styles, beverageType }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStyles = useMemo(() => {
    return styles.filter(s => {
      const matchesType = s.beverage_type === beverageType;
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [styles, searchQuery, beverageType]);

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal__header">
          <h2>{t('Select Target Style')}</h2>
          <button type="button" className="search-modal__close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="search-modal__filters">
          <div className="search-modal__search-bar">
            <FaSearch className="search-modal__search-icon" />
            <input 
              type="text" 
              placeholder={t('Search by name or category...')} 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="search-modal__body">
          <ul className="search-modal__list">
            {filteredStyles.map(s => (
              <li key={s.style_id} className="search-modal__list-item" onClick={() => onSelect(s.style_id)}>
                <div className="search-modal__item-header">
                  <strong className="search-modal__item-title">{s.name}</strong>
                  <span className="search-modal__item-category">{s.category}</span>
                </div>
                <div className="search-modal__meta-grid search-modal__meta-grid--tight">
                  <div className="search-modal__meta-item"><span>{t('OG')}</span><strong>{s.ogMin || '-'} - {s.ogMax || '-'}</strong></div>
                  <div className="search-modal__meta-item"><span>{t('FG')}</span><strong>{s.fgMin || '-'} - {s.fgMax || '-'}</strong></div>
                  <div className="search-modal__meta-item"><span>{t('ABV')}</span><strong>{s.abvMin || '-'}% - {s.abvMax || '-'}%</strong></div>
                  <div className="search-modal__meta-item"><span>{t('IBU')}</span><strong>{s.ibuMin || '-'} - {s.ibuMax || '-'}</strong></div>
                </div>
              </li>
            ))}
            {filteredStyles.length === 0 && (
              <li className="search-modal__empty">{t('No styles found.')}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};