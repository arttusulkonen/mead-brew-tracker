import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import langsConfig from '../../languages.json';
import '../assets/scss/pages/_profile.scss';
import { createSharedBrewery, deleteBrewery, inviteToBrewery } from '../firebase/breweryService';
import { auth } from '../firebase/config';
import { useAuthStore } from '../store/useAuthStore';
import { useBreweryStore } from '../store/useBreweryStore';

const Profile: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { breweries, activeBrewery, setActiveBrewery, setBreweries } = useBreweryStore();

  const [newBreweryName, setNewBreweryName] = useState<string>('');
  const [inviteEmails, setInviteEmails] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/register');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateBrewery = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newBreweryName.trim();
    if (!trimmedName || !user?.uid) return;

    setIsLoading(true);
    setError(null);
    try {
      const newBrewery = await createSharedBrewery(user.uid, trimmedName, inviteEmails);
      if (newBrewery) {
        setBreweries([...breweries, newBrewery]);
        setActiveBrewery(newBrewery);
        setNewBreweryName('');
        setInviteEmails('');
      } else {
        setError(t('Failed to create brewery'));
      }
    } catch (err: any) {
      console.error(err);
      setError(t('An unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBrewery = async (breweryId: string) => {
    const isConfirmed = window.confirm(t('Are you sure you want to delete this brewery and all its recipes?'));
    if (!isConfirmed) return;

    try {
      const success = await deleteBrewery(breweryId);
      if (success) {
        const updatedBreweries = breweries.filter(b => b.id !== breweryId);
        setBreweries(updatedBreweries);
        if (activeBrewery?.id === breweryId) {
          setActiveBrewery(updatedBreweries.length > 0 ? updatedBreweries[0] : null);
        }
      } else {
        setError(t('Failed to delete brewery'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInviteToExisting = async (breweryId: string) => {
    const email = window.prompt(t('Enter email to invite:'));
    if (!email || !email.trim()) return;

    const success = await inviteToBrewery(breweryId, email.trim());
    if (success) {
      alert(t('Invite sent successfully!'));
    } else {
      alert(t('Failed to send invite.'));
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="header-main">
          <h1>{t('Profile')}</h1>
          <div className="lang-switcher">
            <select 
              value={currentLanguage} 
              onChange={handleLanguageChange}
              aria-label={t('Select Language')}
            >
              {Object.entries(langsConfig.uiLabels).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <p>{user?.email}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <h2 className="section-title">{t('My Breweries')}</h2>
      
      <div className="breweries-list">
        {breweries?.map((brewery) => (
          <div key={brewery.id} className={`brewery-card ${activeBrewery?.id === brewery.id ? 'active' : ''}`}>
            <div className="brewery-info">
              <span className="brewery-name">{brewery.name}</span>
              <span className="brewery-type">
                {brewery.isPersonal ? t('Personal') : t('Shared')} • {brewery.members.length} {t('members')}
              </span>
            </div>
            
            <div className="card-actions">
              {activeBrewery?.id !== brewery.id && (
                <button className="btn-switch" onClick={() => setActiveBrewery(brewery)}>
                  {t('Select')}
                </button>
              )}
              
              {!brewery.isPersonal && user?.uid === brewery.ownerId && (
                <>
                  <button className="btn-invite" onClick={() => handleInviteToExisting(brewery.id)}>
                    {t('Invite')}
                  </button>
                  <button className="btn-delete" onClick={() => handleDeleteBrewery(brewery.id)}>
                    {t('Delete')}
                  </button>
                </>
              )}
            </div>
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
        <div className="form-group">
          <label htmlFor="inviteEmails">{t('Invite Emails (comma separated)')}</label>
          <input
            type="text"
            id="inviteEmails"
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            placeholder="friend1@mail.com, friend2@mail.com"
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