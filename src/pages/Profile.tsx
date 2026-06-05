import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import '../assets/scss/pages/_profile.scss';
import { createSharedBrewery } from '../firebase/breweryService';
import { auth } from '../firebase/config';
import { useAuthStore } from '../store/useAuthStore';
import { useBreweryStore } from '../store/useBreweryStore';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { breweries, activeBrewery, setActiveBrewery, setBreweries } = useBreweryStore();

  const [newBreweryName, setNewBreweryName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/register');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t('An error occurred during logout'));
    }
  };

  const handleCreateBrewery = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newBreweryName.trim();
    if (!trimmedName || !user?.uid) return;

    setIsLoading(true);
    setError(null);
    try {
      const newBrewery = await createSharedBrewery(user.uid, trimmedName);
      if (newBrewery) {
        const updatedBreweries = [...breweries, newBrewery];
        setBreweries(updatedBreweries);
        setActiveBrewery(newBrewery);
        setNewBreweryName('');
      } else {
        setError(t('Failed to create brewery'));
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t('An unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchBrewery = (breweryId: string | null | undefined) => {
    if (!breweryId || !breweries) return;
    const selected = breweries.find(b => b.id === breweryId);
    if (selected) {
      setActiveBrewery(selected);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>{t('Profile')}</h1>
        <p>{user?.email}</p>
      </div>

      {error && <div className="error-message" style={{ backgroundColor: '#ffe6e6', color: '#d93025', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <h2 className="section-title">{t('My Breweries')}</h2>
      
      <div className="breweries-list">
        {breweries?.map((brewery) => (
          <div 
            key={brewery.id} 
            className={`brewery-card ${activeBrewery?.id === brewery.id ? 'active' : ''}`}
          >
            <div className="brewery-info">
              <span className="brewery-name">{brewery.name}</span>
              <span className="brewery-type">
                {brewery.isPersonal ? t('Personal') : t('Shared')}
              </span>
            </div>
            {activeBrewery?.id !== brewery.id && (
              <button 
                className="btn-switch"
                onClick={() => handleSwitchBrewery(brewery.id)}
              >
                {t('Select')}
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 className="section-title">{t('Create Shared Brewery')}</h2>
      <form className="create-brewery-form" onSubmit={handleCreateBrewery}>
        <div className="form-group">
          <label htmlFor="breweryName">{t('Brewery Name')}</label>
          <input
            type="text"
            id="breweryName"
            value={newBreweryName}
            onChange={(e) => setNewBreweryName(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-submit" disabled={isLoading || !newBreweryName.trim()}>
          {isLoading ? t('Creating...') : t('Create')}
        </button>
      </form>

      <div className="logout-section">
        <button className="btn-logout" onClick={handleLogout}>
          {t('Logout')}
        </button>
      </div>
    </div>
  );
};

export default Profile;