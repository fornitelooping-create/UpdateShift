// Petits sons d'interface générés à la volée avec la Web Audio API
// (aucun fichier audio à charger/héberger pour les presets intégrés, ça
// marche direct hors-ligne). Le preset "custom" fait exception : il joue un
// vrai fichier audio importé par l'utilisateur (mp3/wav/...), hébergé sur
// Supabase Storage.

import { getRingtoneSettings, getRingtonePreset, CUSTOM_RINGTONE_ID } from "./ringtoneSettings";

let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  // Les navigateurs suspendent l'AudioContext tant qu'il n'y a pas eu
  // d'interaction utilisateur ; comme ces sons sont toujours déclenchés
  // suite à un clic (rejoindre un salon, appeler...) ou un message reçu
  // après une première interaction, un simple resume() suffit ici.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Joue une note (fréquence en Hz) avec une enveloppe de volume simple.
function playTone({ freq, start = 0, duration = 0.15, type = "sine", volume = 0.2 }) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + start;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Deux notes qui montent : "on entre dans le salon".
function playJoinVoice() {
  playTone({ freq: 587, start: 0, duration: 0.12, volume: 0.18 }); // ré
  playTone({ freq: 880, start: 0.09, duration: 0.16, volume: 0.18 }); // la
}

// Deux notes qui descendent : "on quitte le salon".
function playLeaveVoice() {
  playTone({ freq: 740, start: 0, duration: 0.12, volume: 0.16 }); // fa#
  playTone({ freq: 494, start: 0.09, duration: 0.18, volume: 0.16 }); // si
}

// Petit "pop" pour une notification (message reçu).
function playNotification() {
  playTone({ freq: 784, start: 0, duration: 0.09, volume: 0.15, type: "triangle" });
  playTone({ freq: 1046, start: 0.07, duration: 0.12, volume: 0.15, type: "triangle" });
}

// ------- Sonnerie d'appel (boucle tant qu'on ne l'arrête pas) -------
// Personnalisable depuis Paramètres > Sonnerie (voir ringtoneSettings.js) :
// soit un des presets générés (par défaut "classic", identique à l'ancien
// comportement), soit un fichier audio importé par l'utilisateur.
let ringInterval = null;
let ringAudioEl = null;

function ringOnce({ freq1, freq2, type = "sine", volumeScale = 1 }) {
  playTone({ freq: freq1, start: 0, duration: 0.22, volume: 0.2 * volumeScale, type });
  playTone({ freq: freq2, start: 0.22, duration: 0.22, volume: 0.2 * volumeScale, type });
}

// Boucle basée sur des tonalités générées (presets intégrés). `cfg` peut
// être `null` (preset "Silencieuse") : dans ce cas on ne joue rien.
function startToneLoop(cfg, volumeScale) {
  if (!cfg) return;
  ringOnce({ ...cfg, volumeScale });
  ringInterval = setInterval(() => ringOnce({ ...cfg, volumeScale }), cfg.interval);
}

// Boucle basée sur un vrai fichier audio (son personnalisé importé).
function startCustomAudioLoop(url, volumeScale) {
  if (!url || typeof Audio === "undefined") return;
  const el = new Audio(url);
  el.loop = true;
  el.volume = Math.min(1, Math.max(0, volumeScale));
  el.play().catch(() => {
    // Lecture bloquée par le navigateur (pas encore d'interaction
    // utilisateur) : rien de grave, l'appel continue sans son.
  });
  ringAudioEl = el;
}

function stopRing() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  if (ringAudioEl) {
    try {
      ringAudioEl.pause();
      ringAudioEl.currentTime = 0;
    } catch {
      // ignore
    }
    ringAudioEl = null;
  }
}

// Démarre la sonnerie pour un "sens" donné ("incoming" ou "outgoing") à
// partir des réglages actuels de l'utilisateur.
function startRingFor(kind) {
  stopRing();
  const { presetId, volume, customSoundUrl } = getRingtoneSettings();
  if (presetId === CUSTOM_RINGTONE_ID) {
    startCustomAudioLoop(customSoundUrl, volume);
    return;
  }
  startToneLoop(getRingtonePreset(presetId)[kind], volume);
}

// Sonnerie pour celui qui appelle (bip régulier tant que ça sonne chez l'autre).
function startOutgoingRing() {
  startRingFor("outgoing");
}

// Sonnerie pour celui qui reçoit l'appel (deux tons, plus proche d'un
// vrai téléphone qui sonne).
function startIncomingRing() {
  startRingFor("incoming");
}

// Utilisé par l'écran Paramètres > Sonnerie pour prévisualiser un preset
// (ou un son personnalisé) avant de le choisir par défaut. `kind` vaut
// "incoming" ou "outgoing". `customUrl` n'est utilisé que si
// `presetId === "custom"`. S'appuie sur la même boucle que les vraies
// sonneries, donc `sounds.stopRing()` l'arrête aussi.
function previewRingtone(presetId, kind = "incoming", volume = 1, customUrl = null) {
  stopRing();
  if (presetId === CUSTOM_RINGTONE_ID) {
    startCustomAudioLoop(customUrl, volume);
    return;
  }
  startToneLoop(getRingtonePreset(presetId)[kind], volume);
}

export const sounds = {
  playJoinVoice,
  playLeaveVoice,
  playNotification,
  startOutgoingRing,
  startIncomingRing,
  stopRing,
  previewRingtone,
};

export default sounds;
