import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/config';
import i18n from '../i18n';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().language) {
          await i18n.changeLanguage(userDoc.data().language);
        }
      }

      navigate('/home');
    } catch (err: any) {
      console.error(err);
      setError(t('Invalid email or password'));
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleLogin} className="auth-form">
        <h1>{t('Login')}</h1>
        {error && <p className="error">{error}</p>}
        <input type="email" placeholder={t('Email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder={t('Password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">{t('Login')}</button>
        <p className="auth-footer">
          {t('No account?')} <Link to="/register">{t('Register here')}</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;