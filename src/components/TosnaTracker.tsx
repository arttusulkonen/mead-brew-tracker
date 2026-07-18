// src/components/TosnaTracker.tsx
import { calculateOneThirdSugarBreak } from '@mead-tracker/math';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaLock, FaUnlock } from 'react-icons/fa';
import type { BrewSession } from '../types/session';

interface TosnaTrackerProps {
  session: BrewSession;
  onMarkAddition: (additionId: string, nutrientAmount: number, metrics: { sg: number | null, notes: string }) => Promise<void>;
}

export const TosnaTracker: React.FC<TosnaTrackerProps> = ({ session, onMarkAddition }) => {
  const { t } = useTranslation();
  const [currentHours, setCurrentHours] = useState<number>(0);
  const [activeAdditionId, setActiveAdditionId] = useState<string | null>(null);
  const [inputSg, setInputSg] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tosna = session.tosnaSchedule;
  const fermentationStart = session.pitchTimestamp;

  useEffect(() => {
    if (!fermentationStart) return;
    
    const updateTimer = () => {
      const ms = Date.now() - new Date(fermentationStart).getTime();
      setCurrentHours(Math.max(0, ms / (1000 * 60 * 60)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [fermentationStart]);

  if (!tosna || !tosna.additions || tosna.additions.length === 0) return null;

  const targetSgBreak = calculateOneThirdSugarBreak(session.actualOg || session.targetOg || 1.000, session.actualFg || session.targetFg || 1.000);

  const handleSave = async (additionId: string) => {
    setIsSubmitting(true);
    try {
      const parsedSg = parseFloat(inputSg);
      await onMarkAddition(additionId, tosna.dosePerAdditionGrams || 0, {
        sg: isNaN(parsedSg) ? null : parsedSg,
        notes: inputNotes
      });
      setActiveAdditionId(null);
      setInputSg('');
      setInputNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="home-card tosna-widget">
      <div className="home-card__header tosna-widget__header">
        <h2 className="home-card__title tosna-widget__title">{t('TOSNA 3.0 Schedule')}</h2>
        {fermentationStart && (
          <span className="tosna-widget__time tosna-widget__time--highlight">
            {t('Elapsed')}: {Math.floor(currentHours)}h {Math.floor((currentHours % 1) * 60)}m
          </span>
        )}
      </div>
      <div className="home-card__list tosna-widget__list">
        {!fermentationStart && (
          <p className="tosna-widget__hint tosna-widget__hint--disabled">
            {t('Tracker timer will start automatically when you press "Start Fermentation".')}
          </p>
        )}
        
        {tosna.additions.map((addition, index) => {
          const targetHours = addition.targetHours || 0;
          const isDue = addition.isOneThirdBreak || currentHours >= targetHours;
          const isOverdue = fermentationStart && !addition.isCompleted && !addition.isOneThirdBreak && currentHours >= targetHours;
          const isExpanded = activeAdditionId === addition.id;
          
          let timeStatus = '';
          if (!addition.isCompleted && !addition.isOneThirdBreak && fermentationStart && !isDue) {
            const remainingHours = targetHours - currentHours;
            const rh = Math.floor(remainingHours);
            const rm = Math.floor((remainingHours - rh) * 60);
            timeStatus = t('Opens in {{h}}h {{m}}m', { h: rh, m: rm, defaultValue: `Opens in ${rh}h ${rm}m` });
          }
          
          return (
            <div 
              key={addition.id} 
              className={`tosna-widget__item ${isOverdue ? 'tosna-widget__item--overdue' : ''} ${addition.isCompleted ? 'tosna-widget__item--completed' : ''} ${isDue && !addition.isCompleted ? 'tosna-widget__item--due-now' : ''}`} 
            >
              <div className="tosna-widget__info tosna-widget__info--flex">
                <div className="tosna-widget__text-content">
                  <strong className={`tosna-widget__item-title ${addition.isCompleted ? 'tosna-widget__item-title--completed' : ''}`}>
                    {addition.isOneThirdBreak 
                      ? t('1/3 Sugar Break') 
                      : t('Addition {{num}} ({{hours}}h)', { num: index + 1, hours: targetHours })}
                  </strong>
                  
                  <span className="tosna-widget__desc tosna-widget__desc--muted">
                    {addition.isOneThirdBreak 
                      ? t('Target SG: {{sg}}', { sg: targetSgBreak.toFixed(3) }) 
                      : t('Add {{amount}}g of Fermaid-O', { amount: tosna.dosePerAdditionGrams })}
                  </span>

                  {timeStatus && (
                    <div className="tosna-widget__time tosna-widget__time--locked">
                      <FaLock size={10} /> {timeStatus as string}
                    </div>
                  )}

                  {isOverdue && <span className="badge badge--danger tosna-widget__badge-overdue">{t('OVERDUE')}</span>}
                </div>

                {!addition.isCompleted && !isExpanded && fermentationStart && (
                  <button 
                    className={`btn-primary btn-primary--small tosna-widget__btn-record ${!isDue ? 'btn-disabled' : ''}`}
                    onClick={() => isDue && setActiveAdditionId(addition.id)}
                    disabled={!isDue}
                  >
                    {isDue ? <><FaUnlock className="tosna-widget__btn-icon"/> {t('Record')}</> : <><FaLock className="tosna-widget__btn-icon"/> {t('Locked')}</>}
                  </button>
                )}

                {addition.isCompleted && (
                  <span className="tosna-widget__done-text">✔ {t('Done')}</span>
                )}
              </div>

              {isExpanded && !addition.isCompleted && (
                <div className="tosna-widget__form tosna-widget__form--expanded">
                  <div className="tosna-widget__form-layout">
                    <div>
                      <label className="tosna-widget__form-label">{t('Specific Gravity (SG)')}</label>
                      <input 
                        className="tosna-widget__form-input"
                        type="number" 
                        step="0.001" 
                        placeholder="1.050" 
                        value={inputSg} 
                        onChange={e => setInputSg(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="tosna-widget__form-label">{t('Notes & Observations')}</label>
                      <textarea 
                        className="tosna-widget__form-textarea"
                        placeholder={t('Notes...')} 
                        value={inputNotes} 
                        onChange={e => setInputNotes(e.target.value)} 
                        rows={2}
                      />
                    </div>
                    <div className="tosna-widget__form-actions">
                      <button className="btn-secondary" onClick={() => setActiveAdditionId(null)} disabled={isSubmitting}>{t('Cancel')}</button>
                      <button className="btn-primary" onClick={() => handleSave(addition.id)} disabled={isSubmitting}>
                        {isSubmitting ? t('Saving...') : t('Save Addition')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};