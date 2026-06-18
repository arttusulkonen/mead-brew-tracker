import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { getUserBreweries, processPendingInvites } from './firebase/breweryService';
import { auth } from './firebase/config';
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
          
          const currentActiveId = useBreweryStore.getState().activeBreweryId;
          const freshActiveBrewery = userBreweries.find(b => b.id === currentActiveId);
          
          if (freshActiveBrewery) {
            setActiveBrewery(freshActiveBrewery);
          } else if (userBreweries.length > 0) {
            setActiveBrewery(userBreweries[0]);
          } else {
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
        <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/home" replace /> : <Register />} />
        
        <Route element={user ? <AppLayout /> : <Navigate to="/login" replace />}>
          <Route path="/home" element={<Home />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeDetails />} />
          <Route path="/brew/setup/:id" element={<BrewSessionSetup />} />
          <Route path="/brew/:id" element={<div style={{ padding: '2rem' }}>{t('Live Brew Session (Under Construction)')}</div>} />
          <Route path="/brew" element={<div style={{ padding: '2rem' }}>{t('Brew Day Page')}</div>} />
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