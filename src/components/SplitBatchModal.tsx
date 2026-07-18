// src/components/SplitBatchModal.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTimes, FaTrash } from 'react-icons/fa';

interface SplitBatchModalProps {
  currentVolume: number;
  onClose: () => void;
  onSubmit: (splits: { volumeLiters: number; namePostfix: string }[]) => Promise<void>;
}

export const SplitBatchModal: React.FC<SplitBatchModalProps> = ({ currentVolume, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const safeVolume = currentVolume || 0;
  
  const [splits, setSplits] = useState<{ volumeLiters: number; namePostfix: string }[]>([
    { volumeLiters: Number((safeVolume / 2).toFixed(1)), namePostfix: 'Part 1' },
    { volumeLiters: Number((safeVolume / 2).toFixed(1)), namePostfix: 'Part 2' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSplitVolume = (splits || []).reduce((sum, split) => sum + (Number(split?.volumeLiters) || 0), 0);
  const isValid = totalSplitVolume > 0 && totalSplitVolume <= safeVolume && (splits || []).every(s => (s?.namePostfix || '').trim().length > 0 && (s?.volumeLiters || 0) > 0);

  const handleAddSplit = () => {
    setSplits([...(splits || []), { volumeLiters: 0, namePostfix: `Part ${(splits || []).length + 1}` }]);
  };

  const handleRemoveSplit = (index: number) => {
    setSplits((splits || []).filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: 'volumeLiters' | 'namePostfix', value: string | number) => {
    const newSplits = [...(splits || [])];
    if (!newSplits[index]) return;
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      await onSubmit?.(splits || []);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet__header">
          <h3 className="bottom-sheet__title">{t('Split Batch')}</h3>
          <button type="button" className="bottom-sheet__close" onClick={onClose} disabled={isSubmitting}>
            <FaTimes />
          </button>
        </div>

        <div className="bottom-sheet__context">
          {t('Current Volume')}: <strong>{safeVolume} {t('L')}</strong>
          <br />
          {t('Allocated')}: <strong className={totalSplitVolume > safeVolume ? 'bottom-sheet__allocated--error' : ''}>{totalSplitVolume.toFixed(1)} {t('L')}</strong>
        </div>

        <form className="bottom-sheet__form" onSubmit={handleSubmit}>
          <div className="timeline__list">
            {(splits || []).map((split, index) => (
              <div key={index} className="timeline__item timeline__item--active timeline__item--split">
                <div className="split-item__header">
                  <strong>{t('Split')} {index + 1}</strong>
                  {(splits || []).length > 2 && (
                    <button type="button" className="timeline__btn-icon timeline__btn-icon--danger" onClick={() => handleRemoveSplit(index)} disabled={isSubmitting}>
                      <FaTrash />
                    </button>
                  )}
                </div>
                <div className="bottom-sheet__grid">
                  <div className="bottom-sheet__group">
                    <label className="bottom-sheet__label">{t('Volume (L)')}</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max={safeVolume}
                      className="bottom-sheet__input"
                      value={split?.volumeLiters || ''}
                      onChange={e => handleChange(index, 'volumeLiters', parseFloat(e.target.value) || 0)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="bottom-sheet__group">
                    <label className="bottom-sheet__label">{t('Name Postfix')}</label>
                    <input
                      type="text"
                      className="bottom-sheet__input"
                      value={split?.namePostfix || ''}
                      onChange={e => handleChange(index, 'namePostfix', e.target.value)}
                      placeholder="e.g. Cherry"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn-secondary" onClick={handleAddSplit} disabled={isSubmitting || totalSplitVolume >= safeVolume}>
            <FaPlus /> {t('Add another split')}
          </button>

          <button type="submit" className="bottom-sheet__submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? t('Splitting...') : t('Confirm Split')}
          </button>
        </form>
      </div>
    </div>
  );
};