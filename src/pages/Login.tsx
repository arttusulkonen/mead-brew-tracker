import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      
      navigate('/home');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(t('Invalid email or password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleLogin} className="auth-form">
        <h1>{t('Login')}</h1>
        {error && <p className="error">{error}</p>}
        <input type="email" placeholder={t('Email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder={t('Password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={isLoading}>{isLoading ? t('Loading...') : t('Login')}</button>
        <p className="auth-footer">
          {t('No account?')} <Link to="/register">{t('Register here')}</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;