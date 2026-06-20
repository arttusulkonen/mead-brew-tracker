import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaBook, FaChartLine, FaFlask, FaGlobe, FaHome, FaUser } from 'react-icons/fa';
import { NavLink } from 'react-router-dom';
import langsConfig from '../../../languages.json';
import { useAuthStore } from '../../store/useAuthStore';

const Navigation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  const langCodes = Object.keys(langsConfig.uiLabels);

  const { setLanguage } = useAuthStore();
  
  const toggleLanguage = () => {
    const currentIndex = langCodes.indexOf(currentLanguage);
    const nextIndex = (currentIndex + 1) % langCodes.length;
    i18n.changeLanguage(langCodes[nextIndex]);
  };

  return (
    <nav className="main-nav">
      <NavLink to="/home" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <FaHome className="icon" />
        <span>{t('Home')}</span>
      </NavLink>
      <NavLink to="/recipes" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <FaBook className="icon" />
        <span>{t('Recipes')}</span>
      </NavLink>
      <NavLink to="/brew" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <FaFlask className="icon" />
        <span>{t('Brew')}</span>
      </NavLink>
      <NavLink to="/journal" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <FaChartLine className="icon" />
        <span>{t('Journal')}</span>
      </NavLink>
      <NavLink to="/inventory" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <FaChartLine className="icon" />
        <span>{t('Inventory')}</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <FaUser className="icon" />
        <span>{t('Profile')}</span>
      </NavLink>

      <div className="lang-switcher">
        <button onClick={toggleLanguage} className="lang-btn-mobile" aria-label={t('Select Language')}>
          <FaGlobe className="icon" />
          <span>{currentLanguage.toUpperCase()}</span>
        </button>

        <select 
          value={currentLanguage}
          onChange={(e) => {
            const lang = e.target.value;
            setLanguage(lang); 
          }}
          className="language-select"
        >
        {Object.entries(langsConfig.uiLabels).map(([code, label]) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
      </div>
    </nav>
  );
};

export default Navigation;