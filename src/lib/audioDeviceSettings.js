// Préférences de périphériques audio (micro / haut-parleurs), stockées
// localement sur l'appareil (localStorage), comme le fait déjà
// ringtoneSettings.js pour les sonneries. Chaque appareil garde donc son
// propre choix de micro/sortie.
//
// On stocke le deviceId choisi. Ces identifiants sont stables pour un
// même appareil/navigateur, mais peuvent changer si le périphérique est
// débranché puis rebranché ailleurs, ou sur un autre navigateur — dans ce
// cas on retombe simplement sur le périphérique par défaut.

const STORAGE_KEY = "shift:audioDeviceSettings";

const DEFAULT_AUDIO_DEVICE_SETTINGS = {
  inputDeviceId: null,
  outputDeviceId: null,
};

export function getAudioDeviceSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_AUDIO_DEVICE_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_DEVICE_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      inputDeviceId: typeof parsed.inputDeviceId === "string" ? parsed.inputDeviceId : null,
      outputDeviceId: typeof parsed.outputDeviceId === "string" ? parsed.outputDeviceId : null,
    };
  } catch {
    return { ...DEFAULT_AUDIO_DEVICE_SETTINGS };
  }
}

export function saveAudioDeviceSettings(partial) {
  const next = { ...getAudioDeviceSettings(), ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage indisponible (navigation privée très restrictive, etc.) :
    // on ignore, le périphérique par défaut sera simplement réappliqué.
  }
  return next;
}

// Ouvre le micro en utilisant le périphérique choisi dans les paramètres,
// utilisé partout où on démarre réellement un appel/salon vocal (pas
// seulement pour le test dans les paramètres). Si le périphérique
// sauvegardé n'existe plus (débranché, changé d'ordinateur...), on
// retombe silencieusement sur le micro par défaut plutôt que de faire
// échouer l'appel.
export async function getMicStream() {
  const { inputDeviceId } = getAudioDeviceSettings();
  if (inputDeviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: inputDeviceId } },
      });
    } catch {
      // périphérique sauvegardé indisponible : on continue ci-dessous.
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

// Route la lecture d'un élément <audio> (voix distante) vers la sortie
// choisie dans les paramètres. setSinkId n'est pas supporté par tous les
// navigateurs (Firefox/Safari) : dans ce cas on garde la sortie système
// par défaut sans planter.
export async function applyOutputDevice(audioEl) {
  if (!audioEl || typeof audioEl.setSinkId !== "function") return;
  const { outputDeviceId } = getAudioDeviceSettings();
  if (!outputDeviceId) return;
  try {
    await audioEl.setSinkId(outputDeviceId);
  } catch {
    // périphérique de sortie sauvegardé indisponible : on garde la sortie par défaut.
  }
}
