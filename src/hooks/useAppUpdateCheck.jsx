import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { CURRENT_VERSION } from "@/lib/appVersion";

// Vérifie /public/version.json au démarrage, puis toutes les 5 minutes.
// S'il diffère de la version avec laquelle l'app tourne actuellement, ça
// veut dire qu'un nouveau déploiement a eu lieu : on affiche un toast
// persistant proposant de recharger la page (comme Discord qui redémarre
// pour appliquer une mise à jour).
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useAppUpdateCheck() {
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const checkForUpdate = async () => {
      if (notifiedRef.current) return;
      try {
        // cache: "no-store" + paramètre anti-cache : on veut la toute
        // dernière version du fichier, jamais une copie mise en cache par
        // le navigateur ou un CDN.
        const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.version && data.version !== CURRENT_VERSION) {
          notifiedRef.current = true;
          toast({
            title: "Mise à jour disponible",
            description: "Une nouvelle version de Shift est prête. Recharge la page pour l'obtenir.",
            duration: 1000000,
            action: (
              <ToastAction altText="Recharger la page" onClick={() => window.location.reload()}>
                Recharger
              </ToastAction>
            ),
          });
        }
      } catch (err) {
        console.error("[useAppUpdateCheck] échec de la vérification de mise à jour", err);
      }
    };

    checkForUpdate(); // vérification immédiate au démarrage
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
