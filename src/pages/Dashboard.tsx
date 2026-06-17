import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useBreweryStore } from '../store/useBreweryStore';
import { useRecipeStore } from '../store/useRecipeStore';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { activeBreweryId, activeBrewery } = useBreweryStore();
  const { recipes, fetchRecipes, isLoading } = useRecipeStore();

  useEffect(() => {
    if (activeBreweryId) {
      fetchRecipes(activeBreweryId);
    }
  }, [activeBreweryId, fetchRecipes]);

  const latestRecipes = recipes.slice(0, 3);

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <h1>{t('Dashboard')}</h1>
        <p>{activeBrewery?.name}</p>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>{t('Latest Recipes')}</h2>
            <Link to="/recipes" className="link-view-all" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 'bold' }}>{t('View All')}</Link>
          </div>
          
          {isLoading ? (
            <div className="loading-text">{t('Loading...')}</div>
          ) : latestRecipes.length > 0 ? (
            <div className="recipes-grid" style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {latestRecipes.map(recipe => (
                <div key={recipe.id} className="card recipe-card" style={{ padding: '20px', border: '1px solid #eee', borderRadius: '12px' }}>
                  <h3 style={{ margin: '0 0 12px 0' }}>{recipe.name}</h3>
                  <div className="recipe-meta" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#666' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>{recipe.targetStyle}</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{recipe.targetAbv?.toFixed(1)}% ABV</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t('Batch Size')}</span>
                        <span>{recipe.expectedBatchSizeLiters} {t('L')}</span>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
              <p style={{ margin: 0, color: '#666' }}>{t('Here your latest recipes will be displayed.')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;