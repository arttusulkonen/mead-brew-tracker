import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{t('Dashboard')}</h1>
      <p>{t('Welcome back')}, {user?.email}</p>
    </div>
  );
};

export default Home;