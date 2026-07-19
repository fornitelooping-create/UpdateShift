// Génération et hachage des codes de récupération de mot de passe.
//
// Comme cette app n'utilise pas d'email réel (voir auth.js), la
// récupération de compte se fait via un code aléatoire donné à
// l'utilisateur une seule fois, à l'inscription (et re-généré après
// chaque reset réussi). On ne stocke jamais le code en clair : seul son
// hash SHA-256 est conservé, côté serveur, dans les métadonnées du
// compte Supabase Auth.
//
// IMPORTANT : l'Edge Function `reset-password` doit hacher le code reçu
// exactement de la même façon (SHA-256 sur la version normalisée
// majuscule) pour que la comparaison fonctionne.

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/L...) pour que le
// code reste facile à recopier à la main.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Génère un code de récupération lisible, ex: "K7QX-2MPT-9RCF-4WZB".
 */
export function generateRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let raw = "";
  for (const b of bytes) raw += ALPHABET[b % ALPHABET.length];
  return raw.match(/.{1,4}/g).join("-");
}

/**
 * Hash SHA-256 (hex) d'un code de récupération, après normalisation
 * (espaces retirés, majuscules). Utilisé pour ne jamais stocker/envoyer
 * le code en clair une fois généré.
 */
export async function hashRecoveryCode(code) {
  const normalized = (code || "").replace(/\s+/g, "").toUpperCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
