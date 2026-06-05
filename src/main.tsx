import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './assets/scss/main.scss';
import './i18n';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Suspense fallback={<div className="global-loader"><div className="spinner"></div></div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);