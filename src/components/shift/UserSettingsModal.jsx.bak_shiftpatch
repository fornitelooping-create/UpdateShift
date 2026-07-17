import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { X, Camera, Loader2, User, Shield, Mic, Volume2, AlertCircle, Bell, Play, Square, Upload, Music, Trash2, Palette, Check, Plus, Pencil } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { useAudioDevices } from "@/hooks/useAudioDevices";
import { sounds } from "@/lib/sounds";
import { RINGTONE_PRESETS, CUSTOM_RINGTONE_ID, getRingtoneSettings, saveRingtoneSettings } from "@/lib/ringtoneSettings";
import { useTheme } from "@/lib/ThemeContext";
import ThemeEditorModal from "./ThemeEditorModal";
import ImportThemeModal from "./ImportThemeModal";

const STATUS_OPTIONS = [
  { value: "online", label: "En ligne", color: "#23a559" },
  { value: "idle", label: "Absent", color: "#f0b232" },
  { value: "dnd", label: "Ne pas déranger", color: "#f23f43" },
  { value: "offline", label: "Invisible", color: "#80848e" }
];

const BANNER_COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245", "#f0b232", "#00b0f4", "#ff5e05", "#23a559", "#9b59b6"];

// Taille max acceptée pour un son de sonnerie importé depuis l'ordinateur.
const MAX_CUSTOM_SOUND_MB = 8;

export default function UserSettingsModal({ currentUser, onClose, onSave, onLogout, signalingUrl, onSaveSignalingUrl, signalingConnected }) {
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [status, setStatus] = useState("online");
  const [bannerColor, setBannerColor] = useState("#5865f2");
  const [avatar, setAvatar] = useState(null);
  const [banner, setBanner] = useState(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Sonnerie d'appel (préférence stockée localement sur cet appareil).
  const [ringtonePresetId, setRingtonePresetId] = useState("classic");
  const [ringtoneVolume, setRingtoneVolume] = useState(1);
  const [previewingId, setPreviewingId] = useState(null);
  const [customSoundUrl, setCustomSoundUrl] = useState(null);
  const [customSoundName, setCustomSoundName] = useState(null);
  const [uploadingSound, setUploadingSound] = useState(false);
  const [soundError, setSoundError] = useState("");

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => {
    const s = getRingtoneSettings();
    setRingtonePresetId(s.presetId);
    setRingtoneVolume(s.volume);
    setCustomSoundUrl(s.customSoundUrl);
    setCustomSoundName(s.customSoundName);
  }, []);

  // On arrête toute prévisualisation en cours si on quitte l'onglet
  // "Sonnerie" ou si on ferme la fenêtre de paramètres.
  useEffect(() => {
    if (tab !== "sonnerie" && previewingId) {
      sounds.stopRing();
      setPreviewingId(null);
    }
  }, [tab]);

  useEffect(() => {
    return () => sounds.stopRing();
  }, []);

  const loadProfile = async () => {
    const profiles = await db.entities.UserProfile.filter({ user_id: currentUser.id });
    const p = profiles[0];
    if (p) {
      setProfile(p);
      setDisplayName(p.display_name || p.username || "");
      setBio(p.bio || "");
      setCustomStatus(p.custom_status || "");
      setStatus(p.status || "online");
      setBannerColor(p.banner_color || "#5865f2");
      setAvatar(p.avatar || null);
      setBanner(p.banner || null);
    }
    setLoading(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setAvatar(file_url);
    setAvatarUploading(false);
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setBanner(file_url);
    setBannerUploading(false);
  };

  const save = async () => {
    setSaving(true);
    const data = { display_name: displayName, bio, custom_status: customStatus, status, banner_color: bannerColor, avatar, banner };
    if (profile) {
      await db.entities.UserProfile.update(profile.id, data);
    } else {
      await db.entities.UserProfile.create({ ...data, user_id: currentUser.id, username: currentUser.username });
    }
    onSave?.({ ...currentUser, display_name: displayName, avatar, status, bio, custom_status: customStatus, banner_color: bannerColor, banner });
    setSaving(false);
    onClose();
  };

  const previewUser = { username: currentUser.username, display_name: displayName, avatar, status };

  const audio = useAudioDevices();
  const { themeId, activeTheme, allThemes, setTheme } = useTheme();
  const [themeEditorState, setThemeEditorState] = useState(null); // null | "new" | themeObject
  const [showImportModal, setShowImportModal] = useState(false);

  const selectRingtonePreset = (id) => {
    setRingtonePresetId(id);
    saveRingtoneSettings({ presetId: id });
    sounds.previewRingtone(id, "incoming", ringtoneVolume, id === CUSTOM_RINGTONE_ID ? customSoundUrl : null);
    setPreviewingId(id);
  };

  const changeRingtoneVolume = (value) => {
    const v = Math.min(1, Math.max(0, value));
    setRingtoneVolume(v);
    saveRingtoneSettings({ volume: v });
  };

  const togglePreview = (id) => {
    if (previewingId === id) {
      sounds.stopRing();
      setPreviewingId(null);
    } else {
      sounds.previewRingtone(id, "incoming", ringtoneVolume, id === CUSTOM_RINGTONE_ID ? customSoundUrl : null);
      setPreviewingId(id);
    }
  };

  // Import d'un fichier audio depuis l'ordinateur (mp3, wav, ogg...) pour
  // s'en servir comme sonnerie d'appel. Le fichier est hébergé sur le
  // stockage Supabase (comme l'avatar ou la bannière) afin que l'URL reste
  // valable d'une session à l'autre.
  const handleCustomSoundChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setSoundError("Choisis un fichier audio (mp3, wav, ogg...).");
      return;
    }
    if (file.size > MAX_CUSTOM_SOUND_MB * 1024 * 1024) {
      setSoundError(`Le fichier est trop volumineux (${MAX_CUSTOM_SOUND_MB} Mo max).`);
      return;
    }

    setSoundError("");
    setUploadingSound(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setCustomSoundUrl(file_url);
      setCustomSoundName(file.name);
      setRingtonePresetId(CUSTOM_RINGTONE_ID);
      saveRingtoneSettings({
        presetId: CUSTOM_RINGTONE_ID,
        customSoundUrl: file_url,
        customSoundName: file.name,
      });
      sounds.previewRingtone(CUSTOM_RINGTONE_ID, "incoming", ringtoneVolume, file_url);
      setPreviewingId(CUSTOM_RINGTONE_ID);
    } catch (err) {
      console.error("Échec de l'import de la sonnerie personnalisée", err);
      setSoundError("Échec de l'envoi du fichier, réessaie.");
    } finally {
      setUploadingSound(false);
    }
  };

  const removeCustomSound = () => {
    sounds.stopRing();
    setPreviewingId(null);
    setCustomSoundUrl(null);
    setCustomSoundName(null);
    const nextPreset = ringtonePresetId === CUSTOM_RINGTONE_ID ? "classic" : ringtonePresetId;
    setRingtonePresetId(nextPreset);
    saveRingtoneSettings({ presetId: nextPreset, customSoundUrl: null, customSoundName: null });
  };

  const TABS = [
    { id: "profile", label: "Mon profil", icon: User },
    { id: "account", label: "Mon compte", icon: Shield },
    { id: "audio", label: "Audio", icon: Mic },
    { id: "sonnerie", label: "Sonnerie", icon: Bell },
    { id: "apparence", label: "Apparence", icon: Palette },
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60" onClick={onClose}>
      <div
        className="m-auto flex bg-[var(--bg-primary)] rounded-2xl w-[960px] max-h-[85vh] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-52 bg-[var(--bg-secondary)] flex flex-col flex-shrink-0 p-3">
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide px-2 mb-2">Paramètres utilisateur</p>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition mb-0.5 ${
                tab === t.id ? "bg-[var(--bg-modifier-hover)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)] hover:text-white"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}

          <div className="flex-1" />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <h2 className="text-white font-bold text-lg">
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#5865f2]" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {tab === "profile" && (
                <>
                  {/* Banner & Avatar */}
                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Bannière</label>
                    <div
                      className="h-24 rounded-xl mb-3 relative overflow-hidden group cursor-pointer"
                      style={{ background: banner ? "transparent" : bannerColor }}
                    >
                      {banner && <img src={banner} alt="bannière" className="w-full h-full object-cover" />}
                      {!banner && <div className="w-full h-full" style={{ background: bannerColor }} />}
                      {/* overlay buttons */}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover:opacity-100 transition">
                        <label className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded cursor-pointer">
                          {bannerUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                          Image
                          <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                        </label>
                        {banner && (
                          <button onClick={() => setBanner(null)} className="flex items-center gap-1 bg-white/20 hover:bg-red-500/70 text-white text-xs px-2 py-1 rounded">
                            <X className="w-3 h-3" /> Retirer
                          </button>
                        )}
                      </div>
                      <div className="absolute -bottom-6 left-4 ring-4 ring-[var(--bg-primary)] rounded-full">
                        <div className="relative">
                          <UserAvatar user={previewUser} size={56} showStatus />
                          <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer opacity-0 hover:opacity-100 transition">
                            {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Camera className="w-4 h-4 text-white" />}
                            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                          </label>
                        </div>
                      </div>
                    </div>
                    {!banner && (
                      <div className="mt-8 flex gap-2 flex-wrap">
                        {BANNER_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setBannerColor(c)}
                            className="w-7 h-7 rounded-full transition hover:scale-110"
                            style={{ background: c, outline: bannerColor === c ? "2px solid white" : "none", outlineOffset: "2px" }}
                          />
                        ))}
                      </div>
                    )}
                    {banner && <div className="mt-8" />}
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Nom d'affichage</label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
                      placeholder="Ton nom..."
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      maxLength={190}
                      className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)] resize-none"
                      placeholder="Parle un peu de toi..."
                    />
                    <p className="text-[var(--text-muted)] text-xs mt-1 text-right">{bio.length}/190</p>
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Statut personnalisé</label>
                    <input
                      value={customStatus}
                      onChange={(e) => setCustomStatus(e.target.value)}
                      className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
                      placeholder="En train de coder..."
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Statut de présence</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setStatus(s.value)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition text-sm font-medium border-2 ${
                            status === s.value ? "border-[#5865f2] bg-[#5865f2]/10" : "border-transparent bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]"
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-white">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === "account" && (
                <div className="space-y-4">
                  <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                    <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1">Nom d'utilisateur</p>
                    <p className="text-white font-medium">@{currentUser.username}</p>
                  </div>
                  <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                    <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1">ID utilisateur</p>
                    <p className="text-white font-mono text-sm">{currentUser.id}</p>
                  </div>
                </div>
              )}

              {tab === "apparence" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold">Thème</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-1 text-xs font-medium text-[#5865f2] hover:underline"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Importer
                      </button>
                      <button
                        onClick={() => setThemeEditorState("new")}
                        className="flex items-center gap-1 text-xs font-medium text-[#5865f2] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Créer
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {allThemes.map((t) => {
                      const preview = t.tokens;
                      const active = themeId === t.id;
                      return (
                        <div key={t.id} className="relative group">
                          <button
                            onClick={() => setTheme(t.id)}
                            className={`w-full rounded-xl overflow-hidden border-2 transition text-left ${
                              active ? "border-[#5865f2]" : "border-transparent hover:border-[var(--bg-modifier-hover-strong)]"
                            }`}
                          >
                            <div
                              className="h-20 w-full flex relative overflow-hidden"
                              style={{ background: preview["bg-primary"] }}
                            >
                              {t.background?.mediaUrl && (
                                <>
                                  {t.background.mediaType === "video" ? (
                                    <video
                                      src={t.background.mediaUrl}
                                      muted loop autoPlay
                                      className="absolute inset-0 w-full h-full object-cover"
                                      style={{ opacity: t.background.opacity ?? 0.3 }}
                                    />
                                  ) : (
                                    <img
                                      src={t.background.mediaUrl}
                                      alt=""
                                      className="absolute inset-0 w-full h-full object-cover"
                                      style={{ opacity: t.background.opacity ?? 0.3 }}
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-black/20" />
                                </>
                              )}
                              <div className="w-1/3 h-full relative z-10" style={{ background: preview["bg-tertiary"] }} />
                              <div className="w-1/3 h-full relative z-10" style={{ background: preview["bg-secondary"] }} />
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)]">
                              <span className="text-white text-sm font-medium truncate">{t.label}</span>
                              {active && <Check className="w-4 h-4 text-[#5865f2] shrink-0" />}
                            </div>
                          </button>
                          {!t.builtin && (
                            <button
                              onClick={() => setThemeEditorState(t)}
                              title="Modifier ce thème"
                              className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[var(--text-muted)] text-xs pt-2">
                    Sombre, Clair et Amoled sont toujours disponibles, comme sur Discord. Tu peux créer
                    des thèmes personnalisés avec tes couleurs, ou importer une image ou vidéo
                    (.png, .jpg, .gif, .mp4) comme arrière-plan.
                  </p>
                </div>
              )}

              {tab === "audio" && (
                <div className="space-y-6">
                  {audio.hasPermission === false && (
                    <div className="flex items-start gap-3 bg-[#ed4245]/10 border border-[#ed4245]/30 rounded-xl p-4">
                      <AlertCircle className="w-5 h-5 text-[#ed4245] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium mb-1">Accès micro refusé</p>
                        <p className="text-[var(--text-secondary)] text-xs">Autorise l'accès au microphone dans les paramètres de ton navigateur.</p>
                      </div>
                    </div>
                  )}

                  {audio.hasPermission !== true && (
                    <button
                      onClick={audio.requestPermission}
                      className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white py-2.5 rounded-lg text-sm font-medium transition"
                    >
                      Autoriser l'accès au microphone
                    </button>
                  )}

                  {/* Input */}
                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3 flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5" /> Entrée audio (microphone)
                    </label>
                    <select
                      value={audio.selectedInput || ""}
                      onChange={(e) => audio.setSelectedInput(e.target.value)}
                      className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition"
                    >
                      {audio.inputDevices.length === 0 && <option value="">Aucun microphone détecté</option>}
                      {audio.inputDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
                      ))}
                    </select>

                    {/* Mic test / voice activity indicator */}
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => audio.stream ? audio.stopMic() : audio.startMic(audio.selectedInput)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          audio.stream ? "bg-[#ed4245] hover:bg-[#c73033] text-white" : "bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {audio.stream ? "Arrêter le test" : "Tester le micro"}
                      </button>
                      {audio.stream && (
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full transition-all duration-100 ${audio.isSpeaking ? "bg-[#23a559] scale-125" : "bg-[var(--border-default)]"}`} />
                          <span className="text-[var(--text-secondary)] text-xs">{audio.isSpeaking ? "Parole détectée" : "Silence"}</span>
                        </div>
                      )}
                    </div>
                    {audio.stream && (
                      <button
                        onClick={audio.toggleMicMonitor}
                        className={`mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                          audio.micMonitorEnabled ? "bg-[#5865f2] text-white" : "bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        {audio.micMonitorEnabled ? "Retour audio activé" : "M'entendre pendant le test"}
                      </button>
                    )}
                  </div>

                  {/* Output */}
                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3 flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5" /> Sortie audio (haut-parleurs)
                    </label>
                    <select
                      value={audio.selectedOutput || ""}
                      onChange={(e) => audio.setSelectedOutput(e.target.value)}
                      className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition"
                    >
                      {audio.outputDevices.length === 0 && <option value="">Sortie par défaut</option>}
                      {audio.outputDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Haut-parleur ${d.deviceId.slice(0, 8)}`}</option>
                      ))}
                    </select>
                    {audio.outputDevices.length === 0 && (
                      <p className="text-[var(--text-muted)] text-xs mt-2">La sélection de la sortie audio nécessite un navigateur compatible (Chrome/Edge).</p>
                    )}
                  </div>

                  {/* Signaling server for voice calls */}
                  {onSaveSignalingUrl && (
                    <div>
                      <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3 flex items-center gap-2">
                        Serveur d'appel
                        <span className={`w-2 h-2 rounded-full ${signalingConnected ? "bg-[#23a559]" : "bg-[#ed4245]"}`} title={signalingConnected ? "Connecté" : "Non connecté"} />
                      </label>
                      <SignalingUrlField initial={signalingUrl} onSave={onSaveSignalingUrl} />
                      <p className="text-[var(--text-muted)] text-xs mt-2">
                        Adresse du petit serveur de signalisation (voir <code className="text-[var(--text-muted-alt)]">signaling-server/</code> à la racine du projet) que les deux appareils doivent utiliser pour pouvoir s'appeler.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {tab === "sonnerie" && (
                <div className="space-y-6">
                  <p className="text-[var(--text-secondary)] text-xs">
                    Choisis le son joué lors d'un appel entrant ou sortant. Ce réglage est propre à cet appareil.
                    Par défaut, la sonnerie "Classique" (celle d'origine) reste utilisée.
                  </p>

                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3 flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5" /> Sonnerie
                    </label>
                    <div className="space-y-2">
                      {RINGTONE_PRESETS.map((preset) => {
                        const isSelected = ringtonePresetId === preset.id;
                        const isPreviewing = previewingId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => selectRingtonePreset(preset.id)}
                            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${
                              isSelected ? "border-[#5865f2] bg-[#5865f2]/10" : "border-transparent bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium">{preset.label}</p>
                              <p className="text-[var(--text-muted)] text-xs truncate">{preset.description}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePreview(preset.id); }}
                              disabled={preset.id === "silent"}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0 ${
                                preset.id === "silent"
                                  ? "opacity-40 cursor-not-allowed bg-[var(--border-default)] text-[var(--text-secondary)]"
                                  : isPreviewing
                                  ? "bg-[#ed4245] hover:bg-[#c73033] text-white"
                                  : "bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-[var(--text-secondary)]"
                              }`}
                            >
                              {isPreviewing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              {isPreviewing ? "Arrêter" : "Tester"}
                            </button>
                          </div>
                        );
                      })}

                      {/* Son personnalisé importé depuis l'ordinateur */}
                      <div
                        onClick={() => customSoundUrl && selectRingtonePreset(CUSTOM_RINGTONE_ID)}
                        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 transition ${
                          customSoundUrl ? "cursor-pointer" : ""
                        } ${
                          ringtonePresetId === CUSTOM_RINGTONE_ID
                            ? "border-[#5865f2] bg-[#5865f2]/10"
                            : "border-transparent bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <Music className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium">Son personnalisé</p>
                            <p className="text-[var(--text-muted)] text-xs truncate">
                              {customSoundName || "Aucun fichier choisi sur ton ordinateur"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {customSoundUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePreview(CUSTOM_RINGTONE_ID); }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                previewingId === CUSTOM_RINGTONE_ID
                                  ? "bg-[#ed4245] hover:bg-[#c73033] text-white"
                                  : "bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-[var(--text-secondary)]"
                              }`}
                            >
                              {previewingId === CUSTOM_RINGTONE_ID ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              {previewingId === CUSTOM_RINGTONE_ID ? "Arrêter" : "Tester"}
                            </button>
                          )}
                          {customSoundUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeCustomSound(); }}
                              title="Retirer le son personnalisé"
                              className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition bg-[var(--border-default)] hover:bg-[#ed4245] text-[var(--text-secondary)] hover:text-white"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition bg-[#5865f2] hover:bg-[#4752c4] text-white cursor-pointer"
                          >
                            {uploadingSound ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            {customSoundUrl ? "Changer" : "Choisir un fichier"}
                            <input type="file" accept="audio/*" className="hidden" onChange={handleCustomSoundChange} disabled={uploadingSound} />
                          </label>
                        </div>
                      </div>
                      {soundError && <p className="text-[#ed4245] text-xs">{soundError}</p>}
                      <p className="text-[var(--text-muted)] text-xs">
                        Formats courants (mp3, wav, ogg...), {MAX_CUSTOM_SOUND_MB} Mo maximum.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3 flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5" /> Volume de la sonnerie
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={ringtoneVolume}
                        onChange={(e) => changeRingtoneVolume(parseFloat(e.target.value))}
                        className="flex-1 accent-[#5865f2]"
                      />
                      <span className="text-[var(--text-secondary)] text-xs w-10 text-right">{Math.round(ringtoneVolume * 100)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-default)]">
              <button onClick={onClose} className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition">
                Annuler
              </button>
              <button onClick={save} disabled={saving} className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde...</> : "Sauvegarder"}
              </button>
            </div>
          )}
        </div>

        {/* Live preview panel */}
        {tab === "profile" && (
          <div className="w-64 bg-[var(--bg-tertiary)] flex-shrink-0 flex flex-col border-l border-[var(--bg-deepest)]">
            <div className="px-4 py-3 border-b border-[var(--bg-deepest)]">
              <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide">Aperçu</p>
            </div>
            <div className="flex-1 flex items-start justify-center p-4 pt-6">
              <div className="bg-[var(--bg-floating)] rounded-2xl w-full overflow-hidden shadow-xl">
                {/* Banner */}
                <div
                  className="h-16 w-full flex-shrink-0 relative"
                  style={{ background: banner ? "transparent" : bannerColor }}
                >
                  {banner && <img src={banner} alt="" className="w-full h-full object-cover" />}
                </div>
                {/* Avatar */}
                <div className="px-4 pb-4">
                  <div className="-mt-6 mb-2 ring-4 ring-[var(--bg-floating)] rounded-full w-fit">
                    <UserAvatar user={previewUser} size={48} showStatus />
                  </div>
                  <p className="text-white font-bold text-sm">{displayName || currentUser.username}</p>
                  <p className="text-[var(--text-muted)] text-xs">@{currentUser.username}</p>
                  {customStatus && <p className="text-[var(--text-secondary)] text-xs mt-1 italic">"{customStatus}"</p>}
                  {bio && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
                      <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1">À propos de moi</p>
                      <p className="text-[var(--text-normal)] text-xs leading-relaxed line-clamp-4">{bio}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {themeEditorState && (
        <ThemeEditorModal
          editingTheme={themeEditorState === "new" ? null : themeEditorState}
          onClose={() => setThemeEditorState(null)}
        />
      )}

      {showImportModal && (
        <ImportThemeModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}

function SignalingUrlField({ initial, onSave }) {
  const [value, setValue] = useState(initial || "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ws://192.168.1.10:8080"
        className="flex-1 bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition font-mono"
      />
      <button
        onClick={handleSave}
        className="bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition flex-shrink-0"
      >
        {saved ? "Enregistré" : "Enregistrer"}
      </button>
    </div>
  );
}
