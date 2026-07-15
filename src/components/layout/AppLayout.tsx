import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import Navigation from './Navigation';

export const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{'Loading...'}</div>;
  }

  if (!user) {
    return <Navigate to="/register" replace />;
  }

  return (
    <div className="app-layout">
      <Navigation />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};