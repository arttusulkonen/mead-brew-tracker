import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { activeBrewery, activeBreweryId } = useBreweryStore();
  const { recipes, fetchRecipes, isLoading } = useRecipeStore();

  useEffect(() => {
    fetchRecipes(activeBreweryId);
  }, [activeBreweryId, fetchRecipes]);

  const recentRecipes = recipes.slice(0, 3);

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
          <h3>{t('Active Brews')}</h3>
          <p>{t('No active brews in this workspace yet.')}</p>
        </div>
        
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>{t('Recent Recipes')}</h3>
            <Link to="/recipes" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 'bold' }}>
              {t('View All')}
            </Link>
          </div>
          
          {isLoading ? (
            <p className="loading-text">{t('Loading...')}</p>
          ) : recentRecipes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentRecipes.map(recipe => (
                <Link 
                  key={recipe.id} 
                  to={`/recipes/${recipe.id}`} 
                  style={{ 
                    display: 'block', 
                    padding: '12px', 
                    border: '1px solid #eee', 
                    borderRadius: '8px', 
                    textDecoration: 'none', 
                    color: 'inherit' 
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{recipe.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{recipe.targetStyle}</span>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{recipe.targetAbv?.toFixed(1)}% ABV</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666', fontSize: '0.9rem' }}>{t('Your latest recipes will appear here.')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;