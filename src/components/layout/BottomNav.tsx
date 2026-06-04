import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaBook, FaChartLine, FaFlask, FaHome, FaUser } from 'react-icons/fa';
import { NavLink } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const { t } = useTranslation();

  return (
    <nav className="bottom-nav">
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
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <FaUser className="icon" />
        <span>{t('Profile')}</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;