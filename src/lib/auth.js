// Authentication backed by Supabase Auth, using username + password only.
// No real email is ever sent: Supabase requires an email internally, so we
// generate a placeholder one from the username (never shown to the user).

import { supabase } from "./supabaseClient";
import { generateRecoveryCode, hashRecoveryCode } from "./recoveryCode";

function normalizeUsername(username) {
  return (username || "").trim().toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function fakeEmail(username) {
  return `${username}@shift.local`;
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("auth: fetchProfile failed", error);
    return null;
  }
  return data;
}

/**
 * Checks whether an account already exists for this username.
 */
export async function checkAccountExists(username) {
  const normalized = normalizeUsername(username);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("username", normalized)
    .maybeSingle();
  if (error) {
    console.error("auth: checkAccountExists failed", error);
    return false;
  }
  return !!data;
}

/**
 * New account, step 1: create the Supabase auth user with a password.
 */
export async function registerAccount(username, password) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    throw new Error("Le nom d'utilisateur doit faire 3 à 20 caractères (lettres, chiffres, _)");
  }
  if (!password || password.length < 6) {
    throw new Error("Le mot de passe doit faire au moins 6 caractères");
  }

  const exists = await checkAccountExists(normalized);
  if (exists) {
    throw new Error("Ce nom d'utilisateur est déjà pris.");
  }

  const { error } = await supabase.auth.signUp({
    email: fakeEmail(normalized),
    password,
  });
  if (error) throw error;

  // Génère le code de récupération de secours (voir recoveryCode.js) : on
  // ne stocke que son hash, dans les métadonnées du compte Auth qui vient
  // d'être créé (signUp() ouvre déjà une session, donc updateUser marche).
  const recoveryCode = generateRecoveryCode();
  const recovery_code_hash = await hashRecoveryCode(recoveryCode);
  const { error: metaError } = await supabase.auth.updateUser({
    data: { recovery_code_hash },
  });
  if (metaError) {
    console.error("auth: échec de l'enregistrement du code de récupération", metaError);
  }

  return { username: normalized, recoveryCode };
}

/**
 * Mot de passe oublié : réinitialise via le code de récupération donné à
 * l'inscription. Passe par une Edge Function côté serveur car changer le
 * mot de passe d'un compte qui n'est PAS la session courante nécessite la
 * clé service_role, qui ne doit jamais tourner dans le navigateur.
 *
 * Renvoie le nouveau code de récupération (l'ancien est invalidé côté
 * serveur après un reset réussi) — à afficher une seule fois à l'écran.
 */
export async function resetPasswordWithCode(username, recoveryCode, newPassword) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    throw new Error("Nom d'utilisateur invalide.");
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Le mot de passe doit faire au moins 6 caractères");
  }
  if (!recoveryCode || recoveryCode.replace(/\s+/g, "").length < 8) {
    throw new Error("Code de récupération invalide.");
  }

  const { data, error } = await supabase.functions.invoke("reset-password", {
    body: { username: normalized, recoveryCode, newPassword },
  });

  // supabase-js ne renvoie pas toujours `error` pour un statut HTTP non-2xx
  // selon la version ; on vérifie donc aussi le contenu de la réponse.
  if (error || !data?.success) {
    throw new Error(data?.error || "Code de récupération ou nom d'utilisateur incorrect.");
  }

  return { newRecoveryCode: data.newRecoveryCode };
}

/**
 * Régénère le code de récupération pour l'utilisateur ACTUELLEMENT connecté
 * (depuis les paramètres, à tout moment). Contrairement à
 * resetPasswordWithCode, pas besoin d'Edge Function ici : on modifie le
 * compte de la session en cours, donc updateUser() suffit, comme à
 * l'inscription. L'ancien code (dont on n'a de toute façon jamais gardé
 * que le hash) devient invalide dès que le nouveau hash est enregistré.
 *
 * Renvoie le nouveau code — à afficher une seule fois à l'écran, il ne
 * sera plus jamais récupérable ensuite.
 */
export async function regenerateRecoveryCode() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("Tu dois être connecté pour régénérer ton code de récupération.");
  }

  const recoveryCode = generateRecoveryCode();
  const recovery_code_hash = await hashRecoveryCode(recoveryCode);
  const { error } = await supabase.auth.updateUser({
    data: { recovery_code_hash },
  });
  if (error) throw error;

  return { recoveryCode };
}

/**
 * New account, step 2: pick a display name and create the public profile.
 * Requires an active session (created by registerAccount above).
 */
export async function completeSignup(username, displayName) {
  const normalized = normalizeUsername(username);
  const name = (displayName || "").trim();
  if (!name || name.length < 2) {
    throw new Error("Choisis un nom d'affichage d'au moins 2 caractères");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("Crée d'abord ton compte avant de terminer l'inscription.");
  }
  const userId = userData.user.id;

  const profile = {
    id: userId,
    user_id: userId,
    username: normalized,
    display_name: name,
    avatar_url: null,
    status: "online",
  };

  const { data: inserted, error: insertError } = await supabase
    .from("user_profiles")
    .insert(profile)
    .select()
    .single();
  if (insertError) throw insertError;

  return inserted;
}

/**
 * Returning account: log in with username + password.
 */
export async function loginWithPassword(username, password) {
  const normalized = normalizeUsername(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: fakeEmail(normalized),
    password,
  });
  if (error) throw new Error("Nom d'utilisateur ou mot de passe incorrect.");

  const profile = data?.user ? await fetchProfile(data.user.id) : null;
  return profile;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return null;
  return fetchProfile(data.user.id);
}

export async function updateCurrentUser(data) {
  // getSession() lit la session déjà en mémoire locale (pas d'appel
  // réseau), contrairement à getUser() qui revérifie le token auprès du
  // serveur Supabase à chaque appel. C'est important ici : juste après
  // avoir repris l'app en arrière-plan, le réseau peut mettre un instant
  // à se réveiller, et getUser() pouvait alors échouer silencieusement
  // (return null, sans erreur) — empêchant le statut de repasser "online".
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data: updated, error } = await supabase
    .from("user_profiles")
    .update(data)
    .eq("id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return updated;
}

export async function isLoggedIn() {
  const { data } = await supabase.auth.getSession();
  return !!data?.session;
}
