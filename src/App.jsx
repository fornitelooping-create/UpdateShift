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