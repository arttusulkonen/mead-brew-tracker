import { calculateOneThirdSugarBreak } from '@mead-tracker/math';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

  const handleSave = async (additionId: string) => {
    setIsSubmitting(true);
    try {
      const parsedSg = parseFloat(inputSg);
      await onMarkAddition(additionId, tosna.dosePerAdditionGrams, {
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
          <span className="tosna-widget__time" style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {t('Elapsed')}: {Math.floor(currentHours)}h
          </span>
        )}
      </div>
      <div className="home-card__list tosna-widget__list">
        {!fermentationStart && (
          <p className="tosna-widget__hint" style={{ color: 'var(--text-disabled)', fontSize: '0.9rem' }}>
            {t('Tracker timer will start automatically when you press "Start Fermentation".')}
          </p>
        )}
        
        {tosna.additions.map((addition, index) => {
          const isOverdue = fermentationStart && !addition.isCompleted && !addition.isOneThirdBreak && currentHours >= (addition.targetHours || 0);
          const isExpanded = activeAdditionId === addition.id;
          
          return (
            <div key={addition.id} className={`tosna-widget__item ${isOverdue ? 'tosna-widget__item--overdue' : ''} ${addition.isCompleted ? 'tosna-widget__item--completed' : ''}`} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', marginBottom: '12px', backgroundColor: addition.isCompleted ? 'var(--bg-surface)' : 'var(--bg-surface-alt)' }}>
              
              <div className="tosna-widget__info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong className="tosna-widget__item-title" style={{ display: 'block', fontSize: '1.05rem', color: addition.isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                    {addition.isOneThirdBreak 
                      ? t('1/3 Sugar Break') 
                      : t('Addition {{num}} ({{hours}}h)', { num: index + 1, hours: addition.targetHours })}
                  </strong>
                  <span className="tosna-widget__desc" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {addition.isOneThirdBreak 
                      ? t('Target SG: {{sg}}', { sg: targetSgBreak.toFixed(3) }) 
                      : t('Add {{amount}}g of Fermaid-O', { amount: tosna.dosePerAdditionGrams })}
                  </span>
                  {isOverdue && <span className="badge badge--danger tosna-widget__badge-overdue" style={{ marginLeft: '8px' }}>{t('OVERDUE')}</span>}
                </div>

                {!addition.isCompleted && !isExpanded && fermentationStart && (
                  <button 
                    className="btn-primary btn-primary--small"
                    onClick={() => setActiveAdditionId(addition.id)}
                  >
                    {t('Record')}
                  </button>
                )}

                {addition.isCompleted && (
                  <span className="tosna-widget__done-text" style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>✔ {t('Done')}</span>
                )}
              </div>

              {isExpanded && !addition.isCompleted && (
                <div className="tosna-widget__form" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>{t('Specific Gravity (SG)')}</label>
                      <input 
                        type="number" 
                        step="0.001" 
                        placeholder="1.050" 
                        value={inputSg} 
                        onChange={e => setInputSg(e.target.value)} 
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', width: '100%', fontSize: '1rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>{t('Notes & Observations')}</label>
                      <textarea 
                        placeholder={t('Notes...')} 
                        value={inputNotes} 
                        onChange={e => setInputNotes(e.target.value)} 
                        rows={2}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', width: '100%', resize: 'vertical', fontSize: '0.95rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
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