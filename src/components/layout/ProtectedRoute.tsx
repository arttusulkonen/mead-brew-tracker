import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return user ? <Outlet /> : <Navigate to="/register" replace />;
};