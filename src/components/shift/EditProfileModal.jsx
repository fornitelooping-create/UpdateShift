import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { X, Camera, Loader2 } from "lucide-react";
import UserAvatar from "./UserAvatar";

const STATUS_OPTIONS = [
  { value: "online", label: "En ligne", color: "#23a559" },
  { value: "idle", label: "Absent", color: "#f0b232" },
  { value: "dnd", label: "Ne pas déranger", color: "#f23f43" },
  { value: "offline", label: "Invisible", color: "#80848e" }
];

const BANNER_COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245", "#f0b232", "#00b0f4", "#ff5e05", "#23a559", "#9b59b6"];

export default function EditProfileModal({ currentUser, onClose, onSave }) {
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [status, setStatus] = useState("online");
  const [bannerColor, setBannerColor] = useState("#5865f2");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    loadProfile();
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

  const save = async () => {
    setSaving(true);
    const data = {
      display_name: displayName,
      bio,
      custom_status: customStatus,
      status,
      banner_color: bannerColor,
      avatar
    };
    if (profile) {
      await db.entities.UserProfile.update(profile.id, data);
    } else {
      await db.entities.UserProfile.create({ ...data, user_id: currentUser.id, username: currentUser.username });
    }
    onSave?.({ ...currentUser, display_name: displayName, avatar, status, bio, custom_status: customStatus, banner_color: bannerColor });
    setSaving(false);
    onClose();
  };

  const previewUser = { username: currentUser.username, display_name: displayName, avatar, status };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <h2 className="text-white font-bold text-lg">Modifier mon profil</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#5865f2]" />
          </div>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
            {/* Banner color preview */}
            <div>
              <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Couleur de bannière</label>
              <div className="h-20 rounded-xl mb-3 relative" style={{ background: bannerColor }}>
                <div className="absolute -bottom-6 left-4 ring-4 ring-[var(--bg-primary)] rounded-full">
                  <div className="relative">
                    <UserAvatar user={previewUser} size={56} showStatus />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer opacity-0 hover:opacity-100 transition">
                      {avatarUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Camera className="w-4 h-4 text-white" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  </div>
                </div>
              </div>
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
            </div>

            {/* Display name */}
            <div>
              <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Nom d'affichage</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
                placeholder="Ton nom..."
              />
            </div>

            {/* Bio */}
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

            {/* Custom status */}
            <div>
              <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Statut personnalisé</label>
              <input
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
                placeholder="En train de coder..."
              />
            </div>

            {/* Status */}
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
          </div>
        )}

        <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-default)]">
          <button onClick={onClose} className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition">
            Annuler
          </button>
          <button onClick={save} disabled={saving} className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde...</> : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}