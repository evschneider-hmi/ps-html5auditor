import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExtendedHome } from './pages/ExtendedHome';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ExtendedHome />
  </React.StrictMode>
);

