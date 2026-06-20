import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { useSessionStore } from '../store/useSessionStore';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeBrewery, activeBreweryId } = useBreweryStore();
  const { recipes, fetchRecipes, isLoading: isRecipesLoading } = useRecipeStore();
  const { sessions, fetchSessions, isLoading: isSessionsLoading } = useSessionStore();

  useEffect(() => {
    fetchRecipes(activeBreweryId);
    fetchSessions(activeBreweryId);
  }, [activeBreweryId, fetchRecipes, fetchSessions]);

  const recentRecipes = recipes.slice(0, 3);
  const activeSessions = sessions.filter(s => ['planned', 'fermenting', 'aging'].includes(s.status));

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>{t('Dashboard')}</h1>
        {activeBrewery ? (
          <p>{t('Active Workspace')}: <strong>{activeBrewery.name}</strong></p>
        ) : (
          <p>{t('No active workspace selected')}</p>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header-flex">
            <h3>{t('Active Brews')}</h3>
          </div>
          
          {isSessionsLoading ? (
             <p className="loading-text">{t('Loading...')}</p>
          ) : activeSessions.length > 0 ? (
            <div className="dashboard-list">
              {activeSessions.map(session => (
                <div 
                  key={session.id} 
                  className="dashboard-list-item interactive"
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
                  <div className="item-title">{session.recipeName}</div>
                  <div className="item-meta">
                    <span>{t(session.status.charAt(0).toUpperCase() + session.status.slice(1))}</span>
                    <span className="text-primary-bold">{session.batchSizeLiters} {t('L')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-text-sm">{t('No active brews in this workspace yet.')}</p>
          )}
        </div>
        
        <div className="dashboard-card">
          <div className="card-header-flex">
            <h3>{t('Recent Recipes')}</h3>
            <Link to="/recipes" className="view-all-link">
              {t('View All')}
            </Link>
          </div>
          
          {isRecipesLoading ? (
            <p className="loading-text">{t('Loading...')}</p>
          ) : recentRecipes.length > 0 ? (
            <div className="dashboard-list">
              {recentRecipes.map(recipe => (
                <Link 
                  key={recipe.id} 
                  to={`/recipes/${recipe.id}`} 
                  className="dashboard-list-item link"
                >
                  <div className="item-title">{recipe.name}</div>
                  <div className="item-meta">
                    <span>{t(recipe.targetStyle)}</span>
                    <span className="text-primary-bold">{recipe.targetAbv?.toFixed(1)}% ABV</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-text-sm">{t('Your latest recipes will appear here.')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;