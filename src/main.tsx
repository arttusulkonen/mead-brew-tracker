import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import './i18n';

import './assets/scss/main.scss';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка приложения...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);