// src/pages/Brew.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlayCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useBreweryStore } from '../store/useBreweryStore';
import { useSessionStore } from '../store/useSessionStore';

const getLegacyStatusKey = (status: string) => {
  const map: Record<string, string> = {
    'Brew Day': 'planned',
    'Fermentation': 'fermenting',
    'Conditioning': 'aging',
    'Bottled': 'completed',
    'Completed': 'completed'
  };
  return map[status] || 'planned';
};

const Brew: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeBreweryId } = useBreweryStore();
  const { sessions, fetchSessions, isLoading } = useSessionStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeBreweryId) {
      fetchSessions(activeBreweryId);
    }
  }, [activeBreweryId, fetchSessions]);

  if (!activeBreweryId) return null;

  const safeSessions = sessions || [];
  const plannedSessions = safeSessions.filter(s => s?.status === 'Brew Day');
  const activeSessions = safeSessions.filter(s => s?.status === 'Fermentation' || s?.status === 'Conditioning');
  const completedSessions = safeSessions.filter(s => s?.status === 'Bottled' || s?.status === 'Completed');

  const getStepDuration = (step: any) => {
    if (!step) return 0;
    let total = step.accumulatedSeconds || 0;
    if (step.isActive && step.startedAt) {
      total += Math.floor((Date.now() - new Date(step.startedAt).getTime()) / 1000);
    }
    return total;
  };

  const formatTime = (seconds: number) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const renderSessionCard = (session: any) => {
    if (!session) return null;
    const activeStep = (session.sessionSteps || []).find((s: any) => s?.isActive);
    const rawStatus = session.status || 'Brew Day';

    return (
      <div 
        key={session.id} 
        className={`brew-dashboard__card interactive ${activeStep ? 'brew-dashboard__card--active-step' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/brew/${session.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/brew/${session.id}`);
          }
        }}
      >
        <div className="brew-dashboard__card-header">
          <h3 className="brew-dashboard__card-title">{session.recipeName || t('Unknown Recipe')}</h3>
          <span className="brew-dashboard__badge" data-status={getLegacyStatusKey(rawStatus)}>
            {t(`constants.status.${rawStatus.toLowerCase().replace(' ', '_')}`, rawStatus)}
          </span>
        </div>

        {activeStep && (
          <div className="brew-dashboard__active-indicator">
            <div className="brew-dashboard__active-header">
              <span className="brew-dashboard__active-label">
                <FaPlayCircle /> {t('Active Step')}
              </span>
              <span className="brew-dashboard__active-time">
                {formatTime(getStepDuration(activeStep))}
              </span>
            </div>
            <strong className="brew-dashboard__active-title">{activeStep.title || ''}</strong>
          </div>
        )}

        <div className="brew-dashboard__card-meta">
          <div className="brew-dashboard__meta-row">
            <span className="brew-dashboard__meta-label">{t('Batch Size')}</span>
            <span className="brew-dashboard__meta-value">{session.batchSizeLiters || 0} {t('L')}</span>
          </div>
          <div className="brew-dashboard__meta-row">
            <span className="brew-dashboard__meta-label">{t('Target Final Gravity')}</span>
            <span className="brew-dashboard__meta-value">{(session.targetFg || 1.000).toFixed(3)}</span>
          </div>
          <div className="brew-dashboard__meta-row">
            <span className="brew-dashboard__meta-label">{t('Started')}</span>
            <span className="brew-dashboard__meta-value">{session.startDate ? new Date(session.startDate).toLocaleDateString() : '-'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="brew-dashboard">
      <header className="brew-dashboard__header">
        <h1 className="brew-dashboard__title">{t('Brew')}</h1>
      </header>

      {isLoading ? (
        <div className="brew-dashboard__loading">{t('Loading...')}</div>
      ) : safeSessions.length === 0 ? (
        <div className="brew-dashboard__empty">
          <p>{t('No active brews in this workspace yet.')}</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/recipes')}>
            {t('Go to Recipes')}
          </button>
        </div>
      ) : (
        <div className="brew-dashboard__sections">
          {activeSessions.length > 0 && (
            <section className="brew-dashboard__section">
              <h2 className="brew-dashboard__section-title">{t('Active Brews')}</h2>
              <div className="brew-dashboard__grid">
                {activeSessions.map(renderSessionCard)}
              </div>
            </section>
          )}

          {plannedSessions.length > 0 && (
            <section className="brew-dashboard__section">
              <h2 className="brew-dashboard__section-title">{t('Planned')}</h2>
              <div className="brew-dashboard__grid">
                {plannedSessions.map(renderSessionCard)}
              </div>
            </section>
          )}

          {completedSessions.length > 0 && (
            <section className="brew-dashboard__section">
              <h2 className="brew-dashboard__section-title">{t('Completed')}</h2>
              <div className="brew-dashboard__grid">
                {completedSessions.map(renderSessionCard)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default Brew;