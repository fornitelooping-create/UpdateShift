import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { ShiftAuthContext, useShiftAuthProvider } from '@/lib/useShiftAuth';
import ShiftLogin from '@/pages/ShiftLogin';
import ShiftApp from '@/pages/ShiftApp';
import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck';

function ShiftRoot() {
  const authState = useShiftAuthProvider();

  if (!authState.user) {
    return (
      <ShiftAuthContext.Provider value={authState}>
        <ShiftLogin />
      </ShiftAuthContext.Provider>
    );
  }

  return (
    <ShiftAuthContext.Provider value={authState}>
      <ShiftApp />
    </ShiftAuthContext.Provider>
  );
}

function App() {
  useAppUpdateCheck();

  // Sur Discord, la touche Tab ne fait littéralement rien : elle ne
  // déplace jamais le focus vers un autre bouton/salon/champ. On
  // reproduit ça ici en bloquant Tab au niveau de toute l'appli (phase
  // de capture, donc avant même que le navigateur ne change le focus).
  // Les gestions locales de Tab (ex : valider une mention/commande dans
  // le champ de message) continuent de fonctionner normalement, puisque
  // seul le comportement PAR DÉFAUT du navigateur (changer le focus)
  // est annulé — pas l'événement lui-même.
  useEffect(() => {
    const blockTab = (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", blockTab, true);
    return () => window.removeEventListener("keydown", blockTab, true);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <ShiftRoot />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;