// src/pages/Profile.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useBreweryStore } from '../store/useBreweryStore';
import { supabase } from '../supabase/client';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { breweries, activeBrewery, setActiveBrewery, setBreweries, createBrewery, deleteBrewery, inviteToBrewery } = useBreweryStore();

  const [newBreweryName, setNewBreweryName] = useState<string>('');
  const [inviteEmails, setInviteEmails] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateBrewery = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newBreweryName.trim();
    if (!trimmedName || !user?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const newBrewery = await createBrewery(user.id, trimmedName, false, inviteEmails);
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
    <div className="profile">
      <div className="profile__header">
        <h1 className="profile__title">{t('Profile')}</h1>
        <p className="profile__email">{user?.email}</p>
      </div>

      {error && <div className="session-alert session-alert--warning profile__error">{error}</div>}

      <h2 className="profile__section-title">{t('My Breweries')}</h2>
      
      <div className="profile__brewery-list">
        {breweries?.map((brewery) => (
          <div key={brewery.id} className={`profile__brewery-card ${activeBrewery?.id === brewery.id ? 'profile__brewery-card--active' : ''}`}>
            <div className="profile__brewery-info">
              <span className="profile__brewery-name">{brewery.name}</span>
              <span className="profile__brewery-type">
                {brewery.isPersonal ? t('Personal') : t('Shared')} • {brewery.members.length} {t('members')}
              </span>
            </div>
            
            <div className="profile__brewery-actions">
              {activeBrewery?.id !== brewery.id && (
                <button className="btn-secondary btn-secondary--small" onClick={() => setActiveBrewery(brewery)}>
                  {t('Select')}
                </button>
              )}
              
              {!brewery.isPersonal && user?.id === brewery.ownerId && (
                <>
                  <button className="btn-secondary btn-secondary--small" onClick={() => handleInviteToExisting(brewery.id)}>
                    {t('Invite')}
                  </button>
                  <button className="btn-secondary btn-secondary--small profile__btn-delete" onClick={() => handleDeleteBrewery(brewery.id)}>
                    {t('Delete')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="profile__section-title">{t('Create Shared Brewery')}</h2>
      <form className="profile__form" onSubmit={handleCreateBrewery}>
        <div className="profile__form-group">
          <label className="profile__form-label" htmlFor="breweryName">{t('Brewery Name')}</label>
          <input
            className="profile__form-input"
            type="text"
            id="breweryName"
            value={newBreweryName}
            onChange={(e) => setNewBreweryName(e.target.value)}
            required
          />
        </div>
        <div className="profile__form-group">
          <label className="profile__form-label" htmlFor="inviteEmails">{t('Invite Emails (comma separated)')}</label>
          <input
            className="profile__form-input"
            type="text"
            id="inviteEmails"
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            placeholder="friend1@mail.com, friend2@mail.com"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={isLoading || !newBreweryName.trim()}>
          {isLoading ? t('Creating...') : t('Create')}
        </button>
      </form>

      <div className="profile__logout">
        <button className="btn-secondary profile__btn-logout" onClick={handleLogout}>
          {t('Logout')}
        </button>
      </div>
    </div>
  );
};

export default Profile;