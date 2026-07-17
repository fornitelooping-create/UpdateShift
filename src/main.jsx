import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Enregistrement du service worker (PWA installable sur mobile). On le fait
// après le chargement pour ne pas retarder le premier rendu de l'app.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] échec d'enregistrement du service worker", err);
    });
  });
}
