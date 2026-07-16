// Préférences de sonnerie (appel entrant / sortant), stockées localement
// sur l'appareil (localStorage). Ce n'est pas synchronisé avec le compte
// Supabase (seul le fichier audio personnalisé, s'il y en a un, est hébergé
// sur Supabase Storage pour pouvoir être rejoué) : chaque appareil peut donc
// avoir sa propre sonnerie, comme le choix du micro/haut-parleur.
//
// Le preset "classic" reproduit EXACTEMENT les fréquences/tempos utilisés
// avant l'ajout de cette personnalisation, donc si l'utilisateur ne touche
// à rien, le comportement par défaut ne change pas.

const STORAGE_KEY = "shift:ringtoneSettings";

export const RINGTONE_PRESETS = [
  {
    id: "classic",
    label: "Classique",
    description: "La sonnerie d'origine de Shift.",
    incoming: { freq1: 587, freq2: 440, interval: 1800, type: "sine" },
    outgoing: { freq1: 480, freq2: 480, interval: 2000, type: "sine" },
  },
  {
    id: "soft",
    label: "Douce",
    description: "Deux notes plus rondes, moins insistantes.",
    incoming: { freq1: 523, freq2: 659, interval: 2200, type: "sine" },
    outgoing: { freq1: 440, freq2: 440, interval: 2400, type: "sine" },
  },
  {
    id: "marimba",
    label: "Marimba",
    description: "Un son de percussion chaleureux.",
    incoming: { freq1: 659, freq2: 523, interval: 1600, type: "triangle" },
    outgoing: { freq1: 392, freq2: 392, interval: 1900, type: "triangle" },
  },
  {
    id: "digital",
    label: "Digitale",
    description: "Un bip plus électronique et rythmé.",
    incoming: { freq1: 880, freq2: 660, interval: 1400, type: "square" },
    outgoing: { freq1: 660, freq2: 660, interval: 1600, type: "square" },
  },
  {
    id: "silent",
    label: "Silencieuse",
    description: "Aucun son joué lors des appels.",
    incoming: null,
    outgoing: null,
  },
];

// Identifiant spécial (pas dans RINGTONE_PRESETS) qui indique qu'il faut
// utiliser le fichier audio importé par l'utilisateur (customSoundUrl).
export const CUSTOM_RINGTONE_ID = "custom";

export const DEFAULT_RINGTONE_SETTINGS = {
  presetId: "classic",
  volume: 1, // multiplicateur (0 à 1) appliqué au volume de base des sonneries
  customSoundUrl: null, // URL du fichier audio importé (hébergé sur Supabase Storage)
  customSoundName: null, // nom d'origine du fichier, juste pour l'affichage
};

const VALID_PRESET_IDS = [...RINGTONE_PRESETS.map((p) => p.id), CUSTOM_RINGTONE_ID];

export function getRingtonePreset(presetId) {
  return RINGTONE_PRESETS.find((p) => p.id === presetId) || RINGTONE_PRESETS[0];
}

export function getRingtoneSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_RINGTONE_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RINGTONE_SETTINGS };
    const parsed = JSON.parse(raw);
    const presetId = VALID_PRESET_IDS.includes(parsed.presetId)
      ? parsed.presetId
      : DEFAULT_RINGTONE_SETTINGS.presetId;
    const volume =
      typeof parsed.volume === "number" && !Number.isNaN(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : DEFAULT_RINGTONE_SETTINGS.volume;
    const customSoundUrl = typeof parsed.customSoundUrl === "string" ? parsed.customSoundUrl : null;
    const customSoundName = typeof parsed.customSoundName === "string" ? parsed.customSoundName : null;
    return { presetId, volume, customSoundUrl, customSoundName };
  } catch {
    return { ...DEFAULT_RINGTONE_SETTINGS };
  }
}

export function saveRingtoneSettings(partial) {
  const next = { ...getRingtoneSettings(), ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage indisponible (navigation privée très restrictive, etc.) :
    // on ignore, le preset par défaut sera simplement réappliqué à chaque fois.
  }
  return next;
}
