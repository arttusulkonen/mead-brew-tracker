// src/pages/Brew.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlayCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useBreweryStore } from '../store/useBreweryStore';
import { useSessionStore } from '../store/useSessionStore';

const Brew: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeBreweryId } = useBreweryStore();
  const { sessions, fetchSessions, isLoading } = useSessionStore();
  const [, setTick] = useState(0);

  // Глобальный таймер для обновления UI каждую секунду
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

  // Откатили статусы для совместимости с типом BrewSessionStage
  const plannedSessions = sessions.filter(s => s.status === 'planned');
  const activeSessions = sessions.filter(s => s.status === 'fermenting' || s.status === 'aging');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  const getStepDuration = (step: any) => {
    let total = step.accumulatedSeconds || 0;
    if (step.isActive && step.startedAt) {
      total += Math.floor((Date.now() - new Date(step.startedAt).getTime()) / 1000);
    }
    return total;
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const renderSessionCard = (session: any) => {
    const activeStep = session.sessionSteps?.find((s: any) => s.isActive);

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
          <h3 className="brew-dashboard__card-title">{session.recipeName}</h3>
          <span className="brew-dashboard__badge" data-status={session.status}>
            {t(session.status.charAt(0).toUpperCase() + session.status.slice(1))}
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
            <strong className="brew-dashboard__active-title">{activeStep.title}</strong>
          </div>
        )}

        <div className="brew-dashboard__card-meta">
          <div className="brew-dashboard__meta-row">
            <span className="brew-dashboard__meta-label">{t('Batch Size')}</span>
            <span className="brew-dashboard__meta-value">{session.batchSizeLiters} {t('L')}</span>
          </div>
          <div className="brew-dashboard__meta-row">
            <span className="brew-dashboard__meta-label">{t('Target Final Gravity')}</span>
            <span className="brew-dashboard__meta-value">{session.targetFg?.toFixed(3)}</span>
          </div>
          <div className="brew-dashboard__meta-row">
            <span className="brew-dashboard__meta-label">{t('Started')}</span>
            <span className="brew-dashboard__meta-value">{new Date(session.startDate).toLocaleDateString()}</span>
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
      ) : sessions.length === 0 ? (
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