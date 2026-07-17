// src/components/MeasurementBottomSheet.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSave, FaTimes } from 'react-icons/fa';
import { ACTION_CHIPS } from '../utils/meadConstants';

interface MeasurementBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { sg: number | null; ph: number | null; tempC: number | null; actionTaken: string; notes: string }) => Promise<void>;
  activeStepTitle?: string;
}

export const MeasurementBottomSheet: React.FC<MeasurementBottomSheetProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  activeStepTitle 
}) => {
  const { t } = useTranslation();
  const [sgInput, setSgInput] = useState<string>('');
  const [phInput, setPhInput] = useState<string>('');
  const [tempInput, setTempInput] = useState<string>('');
  const [actionInput, setActionInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSgInput('');
      setPhInput('');
      setTempInput('');
      setActionInput('');
      setNotesInput('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sgInput && !phInput && !tempInput && !actionInput && !notesInput) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        sg: sgInput ? parseFloat(sgInput) : null,
        ph: phInput ? parseFloat(phInput) : null,
        tempC: tempInput ? parseFloat(tempInput) : null,
        // ИСПРАВЛЕНИЕ: Отправляем стабильный ключ в БД (без лишних пробелов)
        actionTaken: actionInput.trim(), 
        notes: notesInput.trim()
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChipClick = (chipKey: string) => {
    // ИСПРАВЛЕНИЕ: Сравниваем и сохраняем оригинальный ключ из базы (chip.name), а не его перевод
    setActionInput(prev => prev === chipKey ? '' : chipKey);
  };

  const isValid = Boolean(sgInput || phInput || tempInput || actionInput || notesInput);

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet__header">
          <h3 className="bottom-sheet__title">{t('New Measurement')}</h3>
          <button type="button" className="bottom-sheet__close" onClick={onClose} disabled={isSubmitting}>
            <FaTimes />
          </button>
        </div>

        {activeStepTitle && (
          <div className="bottom-sheet__context">
            {t('Active step')}: <strong>{activeStepTitle}</strong>
          </div>
        )}

        <form className="bottom-sheet__form" onSubmit={handleSubmit}>
          <div className="bottom-sheet__grid">
            <div className="bottom-sheet__group">
              <label className="bottom-sheet__label">{t('Gravity (SG)')}</label>
              <input 
                className="bottom-sheet__input bottom-sheet__input--large" 
                type="number" 
                inputMode="decimal"
                step="0.001" 
                min="0.990" 
                max="1.200" 
                value={sgInput} 
                onChange={(e) => setSgInput(e.target.value)} 
                placeholder="1.000" 
                disabled={isSubmitting} 
              />
            </div>
            
            <div className="bottom-sheet__group">
              <label className="bottom-sheet__label">{t('Temp (°C)')}</label>
              <input 
                className="bottom-sheet__input bottom-sheet__input--large" 
                type="number" 
                inputMode="decimal"
                step="0.1" 
                value={tempInput} 
                onChange={(e) => setTempInput(e.target.value)} 
                placeholder="20.0" 
                disabled={isSubmitting} 
              />
            </div>

            <div className="bottom-sheet__group bottom-sheet__group--full">
              <label className="bottom-sheet__label">{t('Acidity (pH)')}</label>
              <input 
                className="bottom-sheet__input bottom-sheet__input--large" 
                type="number" 
                inputMode="decimal"
                step="0.01" 
                min="2.0" 
                max="7.0" 
                value={phInput} 
                onChange={(e) => setPhInput(e.target.value)} 
                placeholder="3.80" 
                disabled={isSubmitting} 
              />
            </div>
          </div>

          <div className="bottom-sheet__group">
            <label className="bottom-sheet__label">{t('Quick Actions')}</label>
            <div className="bottom-sheet__chips">
              {(ACTION_CHIPS || []).map(chip => (
                <button
                  key={chip.id}
                  type="button"
                  // ИСПРАВЛЕНИЕ: Проверяем стабильный ключ
                  className={`bottom-sheet__chip ${actionInput === chip.name ? 'bottom-sheet__chip--active' : ''}`}
                  onClick={() => handleChipClick(chip.name)}
                  disabled={isSubmitting}
                >
                  {/* ИСПРАВЛЕНИЕ: Переводим только визуальную часть */}
                  {t(chip.name, chip.name) as string}
                </button>
              ))}
            </div>
          </div>

          <div className="bottom-sheet__group">
            <label className="bottom-sheet__label">{t('Notes')}</label>
            <textarea 
              className="bottom-sheet__input bottom-sheet__textarea" 
              value={notesInput} 
              onChange={(e) => setNotesInput(e.target.value)} 
              placeholder={t('Observations...')} 
              rows={2} 
              disabled={isSubmitting} 
            />
          </div>

          <button 
            type="submit" 
            className="bottom-sheet__submit" 
            disabled={isSubmitting || !isValid}
          >
            <FaSave /> {isSubmitting ? t('Saving...') : t('Save Log')}
          </button>
        </form>
      </div>
    </div>
  );
};