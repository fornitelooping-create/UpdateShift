import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { X, Users, Check } from "lucide-react";
import UserAvatar from "./UserAvatar";

export default function NewGroupModal({ currentUser, onClose, onCreate }) {
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const sent = await db.entities.Friendship.filter({ requester_id: currentUser.id, status: "accepted" });
    const received = await db.entities.Friendship.filter({ receiver_id: currentUser.id, status: "accepted" });
    const all = [...sent, ...received];
    const otherIds = all.map((f) => (f.requester_id === currentUser.id ? f.receiver_id : f.requester_id));
    const profiles = await Promise.all(
      otherIds.map((uid) => db.entities.UserProfile.filter({ user_id: uid }).then((r) => r[0]))
    );
    setFriends(profiles.filter(Boolean));
    setLoading(false);
  };

  const toggleFriend = (profile) => {
    setSelected((prev) =>
      prev.some((p) => p.user_id === profile.user_id)
        ? prev.filter((p) => p.user_id !== profile.user_id)
        : [...prev, profile]
    );
  };

  const handleCreate = async () => {
    if (selected.length < 2) return; // need at least 2 others for a "group"
    setCreating(true);
    await onCreate(selected, groupName.trim());
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bg-floating)]">
          <h2 className="text-white font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Nouveau groupe
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--bg-floating)]">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nom du groupe (optionnel)"
            className="w-full bg-[var(--bg-tertiary)] text-white px-3 py-2 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[var(--text-muted-alt)] text-xs uppercase font-semibold px-2 mb-2">
            Choisis au moins 2 amis
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#5865f2] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm italic px-2 py-4">
              Tu n'as pas encore d'amis à ajouter à un groupe.
            </p>
          ) : (
            friends.map((f) => {
              const isSelected = selected.some((p) => p.user_id === f.user_id);
              return (
                <button
                  key={f.user_id}
                  onClick={() => toggleFriend(f)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--bg-modifier-hover)] transition text-left"
                >
                  <UserAvatar user={f} size={32} />
                  <span className="flex-1 text-sm text-white truncate">{f.display_name || f.username}</span>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 transition ${
                      isSelected ? "bg-[#5865f2] border-[#5865f2]" : "border-[var(--text-muted)]"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--bg-floating)]">
          <button
            onClick={handleCreate}
            disabled={selected.length < 2 || creating}
            className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition"
          >
            {creating ? "Création..." : `Créer le groupe${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
