// src/App.tsx
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { getUserBreweries, processPendingInvites } from './firebase/breweryService';
import { auth } from './firebase/config';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Register from './pages/Register';
import { useAuthStore } from './store/useAuthStore';
import { useBreweryStore } from './store/useBreweryStore';

const App: React.FC = () => {
  const { user, setUser, setLoading } = useAuthStore();
  const { setBreweries, setActiveBrewery } = useBreweryStore();
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUser(currentUser);
        
        if (currentUser?.uid) {
          if (currentUser.email) {
            await processPendingInvites(currentUser.uid, currentUser.email);
          }

          const userBreweries = await getUserBreweries(currentUser.uid);
          setBreweries(userBreweries);
          
          const currentActiveId = useBreweryStore.getState().activeBrewery?.id;
          const isStillMember = userBreweries.find(b => b.id === currentActiveId);
          
          if (!isStillMember && userBreweries.length > 0) {
            setActiveBrewery(userBreweries[0]);
          } else if (userBreweries.length === 0) {
            setActiveBrewery(null);
          }
        } else {
          setBreweries([]);
          setActiveBrewery(null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading, setBreweries, setActiveBrewery]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={user ? <Navigate to="/home" replace /> : <Register />} />
        
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/recipes" element={<div style={{ padding: '2rem' }}>{t('Recipes Page')}</div>} />
          <Route path="/brew" element={<div style={{ padding: '2rem' }}>{t('Brew Day Page')}</div>} />
          <Route path="/journal" element={<div style={{ padding: '2rem' }}>{t('Journal Page')}</div>} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;