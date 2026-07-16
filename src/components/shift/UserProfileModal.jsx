import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { X, MessageCircle, UserPlus, UserCheck, Shield, Star, Zap, Clock, UserMinus } from "lucide-react";
import UserAvatar from "./UserAvatar";

const BADGE_ICONS = {
  admin: { icon: Shield, color: "#f23f43", label: "Admin" },
  developer: { icon: Zap, color: "#5865f2", label: "Développeur" },
  premium: { icon: Star, color: "#f0b232", label: "Premium" }
};

const STATUS_LABELS = {
  online: { label: "En ligne", color: "#23a559" },
  idle: { label: "Absent", color: "#f0b232" },
  dnd: { label: "Ne pas déranger", color: "#f23f43" },
  offline: { label: "Hors ligne", color: "#80848e" }
};

export default function UserProfileModal({ userId, username, currentUserId, roles, memberRoleIds, canKick, onKick, serverOwnerId, onClose, onOpenDM, onAddFriend, liveProfiles }) {
  const [profile, setProfile] = useState(null);
  const [friendship, setFriendship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("about");

  useEffect(() => {
    loadProfile();
  }, [userId]);

  // Fusionne les données live (avatar/bannière/statut...) par-dessus le
  // profil chargé, pour que la fenêtre reste à jour tant qu'elle est ouverte.
  const displayProfile = liveProfiles?.[userId]
    ? { ...profile, ...liveProfiles[userId] }
    : profile;

  const loadProfile = async () => {
    setLoading(true);
    const profiles = await db.entities.UserProfile.filter({ user_id: userId });
    setProfile(profiles[0] || { user_id: userId, username, status: "offline" });

    if (currentUserId && currentUserId !== userId) {
      const sent = await db.entities.Friendship.filter({ requester_id: currentUserId, receiver_id: userId });
      const received = await db.entities.Friendship.filter({ requester_id: userId, receiver_id: currentUserId });
      setFriendship(sent[0] || received[0] || null);
    }
    setLoading(false);
  };

  const handleAddFriend = async () => {
    if (!onAddFriend) return;
    const created = await onAddFriend(userId, profile?.username || username);
    if (created) setFriendship(created);
  };

  const isSelf = currentUserId && currentUserId === userId;
  const canKickUser = canKick && !isSelf && userId !== serverOwnerId;
  const isFriend = friendship?.status === "accepted";
  const isPending = friendship?.status === "pending";
  const statusInfo = STATUS_LABELS[displayProfile?.status || "offline"];
  const userRoles = (roles || [])
    .filter((r) => (memberRoleIds || []).includes(r.id))
    .sort((a, b) => (b.position || 0) - (a.position || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#5865f2] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Banner */}
            <div className="h-24 relative" style={{ background: displayProfile?.banner_color || "#5865f2" }}>
              {displayProfile?.banner && (
                <img src={displayProfile.banner} alt="" className="w-full h-full object-cover" />
              )}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/30 rounded-full p-1.5 transition"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute -bottom-8 left-5 ring-4 ring-[var(--bg-primary)] rounded-full">
                <UserAvatar user={displayProfile} size={72} showStatus />
              </div>
            </div>

            <div className="pt-11 px-5 pb-5">
              {/* Name + badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-lg">
                  {displayProfile?.display_name || displayProfile?.username || username}
                </h2>
                {(displayProfile?.badges || []).map((b) => {
                  const badge = BADGE_ICONS[b];
                  if (!badge) return null;
                  const Icon = badge.icon;
                  return (
                    <span key={b} title={badge.label} style={{ color: badge.color }}>
                      <Icon className="w-4 h-4" />
                    </span>
                  );
                })}
              </div>
              <p className="text-[var(--text-secondary)] text-sm">@{displayProfile?.username || username}</p>

              {/* Status */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full" style={{ background: statusInfo.color }} />
                <span className="text-[var(--text-secondary)] text-xs">{statusInfo.label}</span>
              </div>

              {displayProfile?.custom_status && (
                <p className="text-[var(--text-normal)] text-sm mt-2 italic">{displayProfile.custom_status}</p>
              )}

              <div className="border-t border-[var(--bg-floating)] my-4" />

              {/* Tabs */}
              <div className="flex gap-4 mb-3">
                <button
                  onClick={() => setActiveTab("about")}
                  className={`text-sm font-medium pb-1.5 border-b-2 transition ${
                    activeTab === "about" ? "text-white border-[#5865f2]" : "text-[var(--text-muted)] border-transparent hover:text-white"
                  }`}
                >
                  À propos
                </button>
                {userRoles.length > 0 && (
                  <button
                    onClick={() => setActiveTab("roles")}
                    className={`text-sm font-medium pb-1.5 border-b-2 transition ${
                      activeTab === "roles" ? "text-white border-[#5865f2]" : "text-[var(--text-muted)] border-transparent hover:text-white"
                    }`}
                  >
                    Rôles — {userRoles.length}
                  </button>
                )}
              </div>

              {activeTab === "about" && (
                <p className="text-[var(--text-normal)] text-sm whitespace-pre-wrap min-h-[2rem]">
                  {displayProfile?.bio || "Aucune bio pour le moment."}
                </p>
              )}

              {activeTab === "roles" && (
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  {userRoles.map((role) => (
                    <span
                      key={role.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-secondary)]"
                      style={{ color: role.color || "var(--text-normal)" }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: role.color || "var(--text-secondary)" }} />
                      {role.name}
                    </span>
                  ))}
                </div>
              )}

              {!isSelf && (
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => onOpenDM?.(displayProfile)}
                    className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                  {isFriend ? (
                    <button
                      disabled
                      className="flex-1 bg-[var(--border-default)] text-[var(--text-secondary)] py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-default"
                    >
                      <UserCheck className="w-4 h-4" />
                      Ami
                    </button>
                  ) : isPending ? (
                    <button
                      disabled
                      className="flex-1 bg-[var(--border-default)] text-[var(--text-secondary)] py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-default"
                    >
                      <Clock className="w-4 h-4" />
                      En attente
                    </button>
                  ) : (
                    <button
                      onClick={handleAddFriend}
                      className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Ajouter
                    </button>
                  )}
                </div>
              )}

              {canKickUser && (
                <button
                  onClick={() => { onKick?.(userId); onClose(); }}
                  className="w-full mt-3 bg-[#ed4245]/10 hover:bg-[#ed4245]/20 text-[#ed4245] py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 border border-[#ed4245]/30"
                >
                  <UserMinus className="w-4 h-4" />
                  Expulser du serveur
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
