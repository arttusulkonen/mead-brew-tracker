import { calculateOneThirdSugarBreak } from '@mead-tracker/math';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BrewSession } from '../types/session';

interface TosnaTrackerProps {
  session: BrewSession;
  onMarkAddition: (additionId: string, nutrientAmount: number) => Promise<void>;
}

export const TosnaTracker: React.FC<TosnaTrackerProps> = ({ session, onMarkAddition }) => {
  const { t } = useTranslation();
  const [currentHours, setCurrentHours] = useState<number>(0);

  const tosna = session.tosnaSchedule;
  const fermentationStep = session.sessionSteps.find(s => s.phase === 'Fermentation');
  const fermentationStart = fermentationStep?.startedAt;

  useEffect(() => {
    if (!fermentationStart) return;
    const interval = setInterval(() => {
      const ms = Date.now() - new Date(fermentationStart).getTime();
      setCurrentHours(ms / (1000 * 60 * 60));
    }, 60000);
    
    const initialMs = Date.now() - new Date(fermentationStart).getTime();
    setCurrentHours(initialMs / (1000 * 60 * 60));

    return () => clearInterval(interval);
  }, [fermentationStart]);

  if (!tosna || !tosna.additions || tosna.additions.length === 0) return null;

  const targetSgBreak = calculateOneThirdSugarBreak(session.actualOg || session.targetOg, session.actualFg || session.targetFg);

  return (
    <div className="home-card tosna-widget">
      <div className="home-card__header tosna-widget__header">
        <h2 className="home-card__title tosna-widget__title">{t('TOSNA 3.0 Schedule')}</h2>
        {fermentationStart && (
          <span className="tosna-widget__time">{t('Elapsed')}: {Math.floor(currentHours)}h</span>
        )}
      </div>
      <div className="home-card__list tosna-widget__list">
        {!fermentationStart && (
          <p className="tosna-widget__hint">{t('Tracker will start when Fermentation begins.')}</p>
        )}
        {fermentationStart && tosna.additions.map((addition, index) => {
          const isOverdue = !addition.isCompleted && !addition.isOneThirdBreak && currentHours >= (addition.targetHours || 0);
          
          return (
            <div key={addition.id} className={`tosna-widget__item ${isOverdue ? 'tosna-widget__item--overdue' : ''} ${addition.isCompleted ? 'tosna-widget__item--done' : ''}`}>
              <div className="tosna-widget__info">
                <strong className="tosna-widget__name">
                  {addition.isOneThirdBreak ? t('1/3 Sugar Break') : t('Addition {{num}} ({{hours}}h)', { num: index + 1, hours: addition.targetHours })}
                </strong>
                <span className="tosna-widget__desc">
                  {addition.isOneThirdBreak 
                    ? t('Target SG: {{sg}}', { sg: targetSgBreak.toFixed(3) }) 
                    : t('Add {{amount}}g of Fermaid-O', { amount: tosna.dosePerAdditionGrams })}
                </span>
                {isOverdue && <span className="badge badge--danger tosna-widget__badge-overdue">{t('OVERDUE')}</span>}
              </div>
              <div className="tosna-widget__action">
                {addition.isCompleted ? (
                  <span className="tosna-widget__done-text">✔ {t('Done')}</span>
                ) : (
                  <button 
                    className="btn-primary btn-primary--small tosna-widget__btn"
                    onClick={() => onMarkAddition(addition.id, tosna.dosePerAdditionGrams)}
                  >
                    {t('Mark Added')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};