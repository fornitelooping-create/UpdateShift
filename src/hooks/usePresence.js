import { useEffect, useRef } from "react";
import { db } from "@/lib/localDb";

// Statuts choisis volontairement par l'utilisateur dans les Paramètres :
// on ne les écrase JAMAIS automatiquement (ex: quelqu'un qui se met en
// "Ne pas déranger" ou "Invisible" doit le rester, même en arrière-plan).
const MANUAL_STATUSES = ["dnd", "idle", "offline"];

// Petit délai avant de basculer "hors ligne" pour éviter les faux positifs
// (ex: un clic rapide qui fait perdre puis reprendre le focus).
const AWAY_DELAY_MS = 5000;

/**
 * Met automatiquement le compte "hors ligne" quand l'app passe en
 * arrière-plan (fenêtre cachée dans le tray, minimisée, ou qui perd le
 * focus), et restaure le statut choisi par l'utilisateur quand il revient
 * dans l'app. Fonctionne aussi bien dans Electron (via IPC) que dans un
 * navigateur classique (via la Page Visibility API / focus / blur).
 */
export function usePresence(user, updateUser) {
  const manualStatusRef = useRef("online");
  const isAwayRef = useRef(false);
  const awayTimerRef = useRef(null);
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  // Mémorise le "vrai" statut choisi par l'utilisateur, sauf quand la valeur
  // qu'on reçoit vient de notre propre bascule automatique vers "offline".
  useEffect(() => {
    if (!isAwayRef.current && user?.status) {
      manualStatusRef.current = user.status;
    }
  }, [user?.status]);

  useEffect(() => {
    if (!user?.id) return;

    const setStatus = async (status, isRetry = false) => {
      try {
        const result = await updateUserRef.current?.({ status });
        if (!result && !isRetry) {
          // Résultat vide sans erreur levée : on retente une fois après
          // un court délai (le réseau vient peut-être de se réveiller).
          setTimeout(() => setStatus(status, true), 1500);
        }
      } catch (err) {
        console.error("usePresence: échec de la mise à jour du statut", err);
      }
    };

    const goAway = () => {
      if (awayTimerRef.current || isAwayRef.current) return;
      awayTimerRef.current = setTimeout(() => {
        awayTimerRef.current = null;
        // On respecte un statut manuel (dnd / idle / invisible) : pas besoin
        // de le forcer à "offline", il l'affiche déjà comme tel ou volontaire.
        if (MANUAL_STATUSES.includes(manualStatusRef.current)) return;
        isAwayRef.current = true;
        setStatus("offline");
      }, AWAY_DELAY_MS);
    };

    const goActive = () => {
      if (awayTimerRef.current) {
        clearTimeout(awayTimerRef.current);
        awayTimerRef.current = null;
      }
      if (isAwayRef.current) {
        isAwayRef.current = false;
        setStatus(manualStatusRef.current || "online");
      }
    };

    const handleVisibility = () => (document.hidden ? goAway() : goActive());
    const handleBlur = () => goAway();
    const handleFocus = () => goActive();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // Electron : relais explicite hide/show/minimize/restore/blur/focus
    // envoyé par le process principal (plus fiable que la Page Visibility
    // API seule, notamment sur Linux).
    const offElectron = window.electronAPI?.onPresenceChange?.((visible) => {
      if (visible) goActive();
      else goAway();
    });

    // Dernier recours : si l'app/l'onglet se ferme vraiment, on tente une
    // mise à jour "hors ligne" immédiate (best effort, pas de garantie).
    const handleUnload = () => {
      db.entities.UserProfile.update(user.id, { status: "offline" }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handleUnload);
      offElectron?.();
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
    };
  }, [user?.id]);
}
