import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { Users, MessageCircle, X } from "lucide-react";
import UserAvatar from "./UserAvatar";

export default function DMSidebar({ currentUser, selectedDM, onSelectDM, onSelectFriends, liveProfiles }) {
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const convs = await db.entities.DMConversation.filter({});
    const myConvs = convs.filter((c) => c.participants?.includes(currentUser.id));
    setConversations(myConvs.sort((a, b) => new Date(b.last_message_date || 0) - new Date(a.last_message_date || 0)));

    // Load all other participants' profiles (works for 1:1 and groups)
    const otherIds = myConvs.flatMap((c) => (c.participants || []).filter((p) => p !== currentUser.id));
    const uniqueIds = [...new Set(otherIds)];
    const profs = await Promise.all(
      uniqueIds.map((uid) => db.entities.UserProfile.filter({ user_id: uid }).then((r) => r[0]))
    );
    const profileMap = {};
    profs.filter(Boolean).forEach((p) => { profileMap[p.user_id] = p; });
    setProfiles(profileMap);
  };

  const isGroup = (conv) => conv.is_group || (conv.participants?.length || 0) > 2;

  const getOtherUser = (conv) => {
    const otherId = conv.participants?.find((p) => p !== currentUser.id);
    const base = profiles[otherId] || {
      user_id: otherId,
      username: conv.participant_names?.find((n) => n !== (currentUser.display_name || currentUser.username)) || "Utilisateur",
      status: "offline"
    };
    // On superpose le cache temps réel (statut, avatar, etc.) par-dessus le
    // profil chargé une seule fois au montage, sinon le statut affiché ici
    // reste figé tant que la conversation n'est pas rechargée.
    return { ...base, ...(liveProfiles?.[otherId] || {}) };
  };

  const getConvDisplayName = (conv) => {
    if (conv.name) return conv.name;
    const otherNames = (conv.participant_names || []).filter(
      (n) => n && n !== (currentUser.display_name || currentUser.username)
    );
    return otherNames.length > 0 ? otherNames.join(", ") : "Conversation";
  };

  const closeConv = async (e, convId) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== convId));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Friends button */}
      <button
        onClick={onSelectFriends}
        className="w-full flex items-center gap-3 px-3 py-2 mx-2 rounded-lg hover:bg-[var(--bg-modifier-hover)] transition text-[var(--text-secondary)] hover:text-white group"
      >
        <Users className="w-5 h-5" />
        <span className="text-sm font-medium">Amis</span>
      </button>

      {conversations.length > 0 && (
        <div className="mt-3">
          <p className="text-[var(--text-muted)] text-xs uppercase font-semibold px-5 mb-1">Messages directs</p>
          {conversations.map((conv) => {
            const group = isGroup(conv);
            const other = group ? null : getOtherUser(conv);
            const isSelected = selectedDM?.id === conv.id;
            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDM(conv, other)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectDM(conv, other);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 mx-2 rounded-lg transition group text-left cursor-pointer ${
                  isSelected ? "bg-[var(--bg-modifier-hover)] text-white" : "hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-normal)]"
                }`}
              >
                {group ? (
                  <div className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <UserAvatar user={other} size={32} showStatus />
                )}
                <span className="flex-1 text-sm truncate font-medium">
                  {group ? getConvDisplayName(conv) : other.display_name || other.username}
                </span>
                <button
                  onClick={(e) => closeConv(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-white transition p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}