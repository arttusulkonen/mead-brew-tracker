import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Brew from './pages/Brew';
import BrewSession from './pages/BrewSession';
import BrewSessionSetup from './pages/BrewSessionSetup';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import Profile from './pages/Profile';
import RecipeDetails from './pages/RecipeDetails';
import Recipes from './pages/Recipes';
import Register from './pages/Register';
import { useAuthStore } from './store/useAuthStore';
import { useBreweryStore } from './store/useBreweryStore';
import { supabase } from './supabase/client';

const App: React.FC = () => {
  const { user, setUser, setLoading } = useAuthStore();
  const { setBreweries, setActiveBrewery, fetchBreweries } = useBreweryStore();
  const { t } = useTranslation();

  useEffect(() => {
    // Проверка текущей сессии при загрузке
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchBreweries(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Подписка на изменения авторизации (логин/логаут)
   const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { id, email } = session.user;
        
        // 1. Проверяем, пригласили ли нас куда-то
        useBreweryStore.getState().processPendingInvites(id, email || '').then(() => {
          // 2. Грузим все пивоварни
          fetchBreweries(id).then(() => {
            const state = useBreweryStore.getState();
            const currentActiveId = state.activeBreweryId;
            const freshActiveBrewery = state.breweries.find(b => b.id === currentActiveId);
            setActiveBrewery(freshActiveBrewery || (state.breweries.length > 0 ? state.breweries[0] : null));
            setLoading(false);
          });
        });
      } else {
        setBreweries([]);
        setActiveBrewery(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, fetchBreweries, setBreweries, setActiveBrewery]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/home" replace /> : <Register />} />
        
        <Route element={user ? <AppLayout /> : <Navigate to="/login" replace />}>
          <Route path="/home" element={<Home />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeDetails />} />
          <Route path="/brew/setup/:id" element={<BrewSessionSetup />} />
          <Route path="/brew/:id" element={<BrewSession />} />
          <Route path="/brew" element={<Brew />} />
          <Route path="/journal" element={<div style={{ padding: '2rem' }}>{t('Journal Page')}</div>} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;