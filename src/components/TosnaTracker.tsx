// src/components/TosnaTracker.tsx
import { calculateOneThirdSugarBreak } from '@mead-tracker/math';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaLock, FaUnlock } from 'react-icons/fa';
import type { BrewSession } from '../types/session';

interface TosnaTrackerProps {
  session: BrewSession;
  onMarkAddition: (additionId: string, nutrientAmount: number, metrics: { sg: number | null, notes: string }) => Promise<void>;
}

export const TosnaTracker: React.FC<TosnaTrackerProps> = ({ session, onMarkAddition }) => {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [activeAdditionId, setActiveAdditionId] = useState<string | null>(null);
  const [inputSg, setInputSg] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const originalTosna = session?.tosnaSchedule;
  const fermentationStart = session?.pitchTimestamp;
  const isSessionEnded = session?.status === 'Completed' || session?.status === 'Conditioning';

  const tosna = useMemo(() => {
    if (!originalTosna) return null;

    const currentOg = Number(session?.actualOg || session?.targetOg || 1.000);
    
    if (currentOg >= 1.050) return originalTosna;

    const originalAdditions = originalTosna.additions || [];
    const totalFermaidGrams = originalTosna.totalFermaidOGrams || 0;
    const halfDose = parseFloat((totalFermaidGrams / 2).toFixed(1));

    const sessionAdditions = [
      {
        id: originalAdditions[0]?.id || 'session-pitch-step',
        targetHours: 0,
        isCompleted: originalAdditions[0]?.isCompleted || false,
        isOneThirdBreak: false
      },
      {
        id: originalAdditions[1]?.id || 'session-24h-step',
        targetHours: 24,
        isCompleted: originalAdditions[1]?.isCompleted || false,
        isOneThirdBreak: false
      }
    ];

    return {
      ...originalTosna,
      dosePerAdditionGrams: halfDose,
      additions: sessionAdditions
    };
  }, [originalTosna, session?.actualOg, session?.targetOg]);

  useEffect(() => {
    if (!fermentationStart) return;
    
    const updateTimer = () => {
      const startMs = new Date(fermentationStart).getTime();
      if (isNaN(startMs)) return; 
      
      const endMs = session?.completedDate ? new Date(session.completedDate).getTime() : Date.now();
      const refTime = (isSessionEnded && !isNaN(endMs)) ? endMs : Date.now();
      
      setElapsedSeconds(Math.max(0, Math.floor((refTime - startMs) / 1000)));
    };
    
    updateTimer(); 
    
    if (!isSessionEnded) {
      const interval = setInterval(updateTimer, 1000); 
      return () => clearInterval(interval);
    }
  }, [fermentationStart, isSessionEnded, session?.completedDate]);

  const formatExactTime = (totalSeconds: number) => {
    if (totalSeconds < 0) return '00:00:00';
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    if (d > 0) return `${d}d ${h}:${m}:${s}`;
    return `${h}:${m}:${s}`;
  };

  if (!tosna || !(tosna.additions || []).length) return null;

  const targetSgBreak = calculateOneThirdSugarBreak(
    session?.actualOg || session?.targetOg || 1.000, 
    session?.actualFg || session?.targetFg || 1.000
  );

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
            ⏱ {formatExactTime(elapsedSeconds)} {isSessionEnded ? t('(Stopped)') : ''}
          </span>
        )}
      </div>
      <div className="home-card__list tosna-widget__list">
        {!fermentationStart && (
          <p className="tosna-widget__hint tosna-widget__hint--disabled">
            {t('Tracker timer will start automatically when you press "Start Fermentation".')}
          </p>
        )}
        
        {(tosna.additions || []).map((addition, index) => {
          if (!addition) return null;
          
          const targetSeconds = (addition.targetHours || 0) * 3600;
          const isDue = elapsedSeconds >= targetSeconds;
          
          const GRACE_PERIOD_SEC = 12 * 3600; 
          const isOverdue = fermentationStart && !addition.isCompleted && !addition.isOneThirdBreak && elapsedSeconds > (targetSeconds + GRACE_PERIOD_SEC);
          
          const isExpanded = activeAdditionId === addition.id;
          
          let timeStatus = '';
          if (!addition.isCompleted && !addition.isOneThirdBreak && fermentationStart) {
            if (!isDue) {
              const remaining = targetSeconds - elapsedSeconds;
              const rh = Math.floor(remaining / 3600);
              const rm = Math.floor((remaining % 3600) / 60);
              timeStatus = t('Opens in {{h}}h {{m}}m', { h: rh, m: rm });
            }
          }

          let stepTitle: string | undefined;
          if (addition.isOneThirdBreak) {
            stepTitle = t('1/3 Sugar Break');
          } else if (addition.targetHours === 0) {
            stepTitle = t('Initial Feed (0h / Pitch)');
          } else if (addition.targetHours === 24 && (tosna.additions || []).length === 2 && !addition.isOneThirdBreak) {
            stepTitle = t('Final Feed (24h)');
          } else {
            stepTitle = t('Addition {{num}} ({{hours}}h)', { num: index + 1, hours: addition.targetHours || 0 });
          }
          
          return (
            <div 
              key={addition.id} 
              className={`tosna-widget__item ${isOverdue ? 'tosna-widget__item--overdue' : ''} ${addition.isCompleted ? 'tosna-widget__item--completed' : ''} ${isDue && !addition.isCompleted && !isOverdue ? 'tosna-widget__item--due-now' : ''}`}
            >
              <div className="tosna-widget__info tosna-widget__info--flex">
                <div className="tosna-widget__text-content">
                  <strong className={`tosna-widget__item-title ${addition.isCompleted ? 'tosna-widget__item-title--completed' : ''}`}>
                    {stepTitle}
                  </strong>
                  
                  <span className="tosna-widget__desc tosna-widget__desc--muted">
                    {addition.isOneThirdBreak 
                      ? t('Target SG: {{sg}}', { sg: (targetSgBreak || 1.000).toFixed(3) }) 
                      : t('Add {{amount}}g of Fermaid-O', { amount: tosna.dosePerAdditionGrams || 0 })}
                  </span>
                  
                  {timeStatus && !isDue && (
                    <div className="tosna-widget__time tosna-widget__time--locked">
                      <FaLock size={10} /> {timeStatus as string}
                    </div>
                  )}

                  {isOverdue && <span className="badge badge--danger tosna-widget__badge-overdue">{t('OVERDUE')}</span>}
                  
                  {isDue && !isOverdue && !addition.isCompleted && (
                    <span className="badge badge--primary tosna-widget__badge-due">{t('DUE NOW')}</span>
                  )}
                </div>

                {!addition.isCompleted && !isExpanded && fermentationStart && !isSessionEnded && (
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
                      <label className="tosna-widget__form-label">{t('Current Gravity (SG)')}</label>
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
                        rows={3}
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