import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExtendedHome } from './pages/ExtendedHome';
import './styles/theme.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <div className="app">
      <ExtendedHome />
    </div>
  </React.StrictMode>
);

