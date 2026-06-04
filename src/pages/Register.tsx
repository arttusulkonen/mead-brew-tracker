import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import '../assets/scss/pages/_register.scss';
import { createPersonalBrewery } from '../firebase/breweryService';
import { auth, db } from '../firebase/config';
import { useBreweryStore } from '../store/useBreweryStore';

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { setActiveBrewery, setBreweries } = useBreweryStore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      setError(t('Please fill in all fields'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('Passwords do not match'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential?.user;
      
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          createdAt: new Date().toISOString(),
        });

        const personalBrewery = await createPersonalBrewery(user.uid, user.email);
        
        if (personalBrewery) {
          setBreweries([personalBrewery]);
          setActiveBrewery(personalBrewery);
        }

        navigate('/home');
      }
    } catch (err: any) {
      if (err?.message) {
        setError(err.message);
      } else {
        setError(t('An unknown error occurred'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h1>{t('Create Account')}</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="email">{t('Email')}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">{t('Password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('Confirm Password')}</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? t('Loading...') : t('Register')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;