import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import '../assets/scss/pages/_register.scss';
import { useBreweryStore } from '../store/useBreweryStore';
import { supabase } from '../supabase/client';

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { setActiveBrewery, setBreweries, createBrewery } = useBreweryStore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      setError(t('Please fill in all fields')); return;
    }
    if (password !== confirmPassword) {
      setError(t('Passwords do not match')); return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      
      if (signUpError) throw signUpError;
      
      const user = data.user;
      
      if (user?.id) {
        const breweryName = user.email ? user.email.split('@')[0] : 'Personal';
        const personalBrewery = await createBrewery(user.id, breweryName, true);
        
        if (personalBrewery) {
          setBreweries([personalBrewery]);
          setActiveBrewery(personalBrewery);
        }
        navigate('/home');
      }
    } catch (err: any) {
      setError(err?.message || t('An unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h1>{t('Create Account')}</h1>
        {error && <div className="error-message">{error}</div>}
        <form className='auth-form' onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="email">{t('Email')}</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('Password')}</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">{t('Confirm Password')}</label>
            <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? t('Loading...') : t('Register')}
          </button>
          <p className="auth-footer">
            {t('Already registered?')} <Link to="/login">{t('Login here')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;