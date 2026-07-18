// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaArrowRight, FaPlayCircle } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';
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

const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeBrewery, activeBreweryId } = useBreweryStore();
  const { recipes, fetchRecipes, isLoading: isRecipesLoading } = useRecipeStore();
  const { sessions, fetchSessions, isLoading: isSessionsLoading } = useSessionStore();
  
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeBreweryId) {
      fetchRecipes(activeBreweryId);
      fetchSessions(activeBreweryId);
    }
  }, [activeBreweryId, fetchRecipes, fetchSessions]);

  const recentRecipes = (recipes || []).slice(0, 3);
  
  const activeSessions = (sessions || []).filter(s => 
    ['Brew Day', 'Fermentation', 'Conditioning'].includes(s?.status || '')
  );

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

  return (
    <div className="home">
      <header className="home__header">
        <h1 className="home__title">{t('Dashboard')}</h1>
        {activeBrewery ? (
          <p className="home__subtitle">
            {t('Active Workspace')}: <strong className="home__workspace">{activeBrewery.name}</strong>
          </p>
        ) : (
          <p className="home__subtitle">{t('No active workspace selected')}</p>
        )}
      </header>

      <div className="home__grid">
        <section className="home-card">
          <div className="home-card__header">
            <h2 className="home-card__title">{t('Active Brews')}</h2>
            <Link to="/brew" className="home-card__link">
              {t('View All')} <FaArrowRight />
            </Link>
          </div>
          
          {isSessionsLoading ? (
             <div className="home-card__loading">{t('Loading...')}</div>
          ) : activeSessions.length > 0 ? (
            <div className="home-card__list">
              {activeSessions.map(session => {
                const activeStep = session.sessionSteps?.find((s: any) => s.isActive);
                const rawStatus = session.status || 'Brew Day';
                
                return (
                  <div 
                    key={session.id} 
                    className={`brew-item ${activeStep ? 'brew-item--active' : ''}`}
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
                    <div className="brew-item__header">
                      <h3 className="brew-item__title">{session.recipeName}</h3>
                      <span className="brew-item__badge" data-status={getLegacyStatusKey(rawStatus)}>
                        {t(`constants.status.${rawStatus.toLowerCase().replace(' ', '_')}`, rawStatus) as string}
                      </span>
                    </div>
                    
                    <div className="brew-item__details">
                      <span className="brew-item__detail-text">{session.batchSizeLiters} {t('L')}</span>
                      <span className="brew-item__detail-text">•</span>
                      <span className="brew-item__detail-text">{t('Started')}: {new Date(session.startDate).toLocaleDateString()}</span>
                    </div>
                    
                    {activeStep && (
                      <div className="brew-item__active-step">
                        <div className="brew-item__step-header">
                          <span className="brew-item__step-indicator">
                            <FaPlayCircle className="brew-item__pulse-icon" /> {t('Active Step')}
                          </span>
                          <span className="brew-item__step-timer">
                            {formatTime(getStepDuration(activeStep))}
                          </span>
                        </div>
                        <strong className="brew-item__step-name">{activeStep.title}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="home-card__empty">
              <p>{t('No active brews in this workspace yet.')}</p>
              <button type="button" className="btn-primary" onClick={() => navigate('/recipes')}>
                {t('Start a new brew')}
              </button>
            </div>
          )}
        </section>
        
        <section className="home-card">
          <div className="home-card__header">
            <h2 className="home-card__title">{t('Recent Recipes')}</h2>
            <Link to="/recipes" className="home-card__link">
              {t('View All')} <FaArrowRight />
            </Link>
          </div>
          
          {isRecipesLoading ? (
            <div className="home-card__loading">{t('Loading...')}</div>
          ) : recentRecipes.length > 0 ? (
            <div className="home-card__list">
              {recentRecipes.map(recipe => (
                <Link 
                  key={recipe.id} 
                  to={`/recipes/${recipe.id}`} 
                  className="recipe-item"
                >
                  <h3 className="recipe-item__title">{recipe.name}</h3>
                  <div className="recipe-item__meta">
                    <span className="recipe-item__style">{t(recipe.targetStyle)}</span>
                    <span className="recipe-item__abv">{(recipe.targetAbv || 0).toFixed(1)}% ABV</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-card__empty">
              <p>{t('Your latest recipes will appear here.')}</p>
              <button type="button" className="btn-secondary" onClick={() => navigate('/recipes')}>
                {t('Create Recipe')}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Home;