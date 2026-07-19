import { useState, useEffect, useRef, createContext, useContext } from "react";
import { supabase } from "./supabaseClient";
import {
  getCurrentUser,
  checkAccountExists as authCheckAccountExists,
  registerAccount as authRegisterAccount,
  completeSignup as authCompleteSignup,
  loginWithPassword as authLoginWithPassword,
  logout as authLogout,
  updateCurrentUser
} from "./auth";

export const ShiftAuthContext = createContext(null);

export function useShiftAuth() {
  return useContext(ShiftAuthContext);
}

export function useShiftAuthProvider() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const startupHandledRef = useRef(false);
  const startupFixPromiseRef = useRef(null);

  // Au (re)démarrage de l'app / à la reprise d'une session déjà valide, le
  // statut enregistré peut être resté à "offline" (c'est ce que met la
  // fermeture précédente via beforeunload dans usePresence). On le remet à
  // "online" une seule fois au tout début de la vie de l'app.
  //
  // ATTENTION : `onAuthStateChange` déclenche aussi un événement dès le
  // montage (session déjà valide), EN PLUS de l'appel direct juste en
  // dessous. Les deux lisent le profil en même temps ; sans coordination,
  // celui qui finit en second peut écraser le statut corrigé par l'ancien
  // statut "offline" encore non corrigé en base. On passe donc par une
  // promesse partagée : peu importe lequel démarre le fetch, les deux
  // attendent le même résultat final.
  const fetchStartupUser = async () => {
    const profile = await getCurrentUser();
    if (startupHandledRef.current) return profile;
    if (profile?.status !== "offline") {
      startupHandledRef.current = true;
      return profile;
    }
    if (!startupFixPromiseRef.current) {
      startupFixPromiseRef.current = updateCurrentUser({ status: "online" })
        .then((updated) => updated || profile)
        .catch((err) => {
          console.error("useShiftAuth: échec de la remise en ligne au démarrage", err);
          return profile;
        })
        .finally(() => {
          startupHandledRef.current = true;
        });
    }
    return startupFixPromiseRef.current;
  };

  useEffect(() => {
    let active = true;

    fetchStartupUser().then((u) => {
      if (active) {
        setUser(u);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        if (active) setUser(null);
        return;
      }
      const profile = await fetchStartupUser();
      if (active) setUser(profile);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Check whether a username is already taken (decides whether the login
  // screen asks for a password, or starts the "create account" flow).
  const checkAccountExists = (username) => authCheckAccountExists(username);

  // New account, step 1: create the account with a password
  const registerAccount = (username, password) => authRegisterAccount(username, password);

  // New account, step 2: pick a display name, creates the profile row
  const completeSignup = async (username, displayName) => {
    const u = await authCompleteSignup(username, displayName);
    setUser(u);
    return u;
  };

  // Returning account: log in with username + password
  const loginWithPassword = async (username, password) => {
    let u = await authLoginWithPassword(username, password);
    if (u?.status === "offline") {
      try {
        u = (await updateCurrentUser({ status: "online" })) || u;
      } catch (err) {
        console.error("useShiftAuth: échec de la remise en ligne après connexion", err);
      }
    }
    setUser(u);
    return u;
  };

  const logout = async () => {
    await authLogout();
    setUser(null);
  };

  const updateUser = async (data) => {
    const updated = await updateCurrentUser(data);
    setUser(updated);
    return updated;
  };

  return {
    user,
    loading,
    checkAccountExists,
    registerAccount,
    completeSignup,
    loginWithPassword,
    logout,
    updateUser,
  };
}
