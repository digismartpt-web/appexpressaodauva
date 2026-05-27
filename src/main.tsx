import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth } from './hooks/useAuth';
import App from './App.tsx';
import './index.css';
import { initGoogleMaps } from './lib/googleMaps';

// On enveloppe le tout pour éviter de bloquer le rendu visuel
const startApp = async () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const root = createRoot(rootElement);

  // Rendu initial immédiat (même si vide/chargement)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  // Initialisation différée pour ne pas faire planter l'affichage
  try {
    const { initializeAuth } = useAuth.getState();
    await initializeAuth();
    initGoogleMaps();
  } catch (error) {
    console.error('📊 Erreur d\'initialisation silencieuse :', error);
  }
};

startApp();

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}
