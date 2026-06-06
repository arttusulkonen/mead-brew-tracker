// src/pages/Home.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import '../assets/scss/pages/_home.scss';
import { useBreweryStore } from '../store/useBreweryStore';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { activeBrewery } = useBreweryStore();

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
          <h3>{t('Recent Recipes')}</h3>
          <p>{t('Your latest recipes will appear here.')}</p>
        </div>
      </div>
    </div>
  );
};

export default Home;