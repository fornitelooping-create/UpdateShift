// Edge Function : réinitialise le mot de passe d'un compte via son code
// de récupération (voir src/lib/recoveryCode.js côté client pour le
// contexte : cette app n'utilise pas d'email réel, donc pas de flow de
// reset par email possible).
//
// C'est la SEULE partie du projet qui a le droit de toucher à
// SUPABASE_SERVICE_ROLE_KEY. Cette clé ne doit jamais apparaître dans le
// code du site (src/). Elle est injectée automatiquement par Supabase
// dans l'environnement de la fonction, pas besoin de la configurer à la
// main.
//
// Déploiement : `supabase functions deploy reset-password`
// (nécessite la CLI Supabase, `supabase login` puis `supabase link`
// vers le projet au préalable)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Même alphabet que src/lib/recoveryCode.js — doit rester identique pour
// que les codes générés ici restent lisibles/cohérents avec le front.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let raw = "";
  for (const b of bytes) raw += ALPHABET[b % ALPHABET.length];
  return raw.match(/.{1,4}/g)!.join("-");
}

async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = (code || "").replace(/\s+/g, "").toUpperCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Méthode non autorisée." }, 405);
  }

  let body: { username?: string; recoveryCode?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Requête invalide." }, 400);
  }

  const username = (body.username || "").trim().toLowerCase();
  const recoveryCode = body.recoveryCode || "";
  const newPassword = body.newPassword || "";

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return jsonResponse({ success: false, error: "Nom d'utilisateur invalide." }, 400);
  }
  if (newPassword.length < 6) {
    return jsonResponse({ success: false, error: "Le mot de passe doit faire au moins 6 caractères." }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Message d'erreur volontairement générique dans tous les cas d'échec
  // ci-dessous, pour ne pas laisser deviner si un nom d'utilisateur existe
  // (énumération de comptes) ou si c'est le code qui est faux.
  const genericError = { success: false, error: "Nom d'utilisateur ou code de récupération incorrect." };

  // 1) Retrouve l'utilisateur via user_profiles (RLS bypassée par la clé
  //    service_role), pour obtenir son id auth.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (profileError) {
    console.error("reset-password: échec de la recherche du profil", profileError);
    return jsonResponse({ success: false, error: "Erreur serveur, réessaie plus tard." }, 500);
  }
  if (!profile) {
    return jsonResponse(genericError, 400);
  }

  // 2) Vérifie le code de récupération contre le hash stocké dans les
  //    métadonnées du compte Auth.
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (userError || !userData?.user) {
    console.error("reset-password: échec de la lecture du compte Auth", userError);
    return jsonResponse({ success: false, error: "Erreur serveur, réessaie plus tard." }, 500);
  }

  const storedHash = userData.user.user_metadata?.recovery_code_hash;
  const providedHash = await hashRecoveryCode(recoveryCode);
  if (!storedHash || storedHash !== providedHash) {
    return jsonResponse(genericError, 400);
  }

  // 3) Code valide : change le mot de passe, et régénère un nouveau code
  //    (l'ancien devient inutilisable) pour permettre un futur reset.
  const newRecoveryCode = generateRecoveryCode();
  const newHash = await hashRecoveryCode(newRecoveryCode);

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
    password: newPassword,
    user_metadata: { ...userData.user.user_metadata, recovery_code_hash: newHash },
  });

  if (updateError) {
    console.error("reset-password: échec de la mise à jour du mot de passe", updateError);
    return jsonResponse({ success: false, error: "Erreur serveur, réessaie plus tard." }, 500);
  }

  return jsonResponse({ success: true, newRecoveryCode });
});
