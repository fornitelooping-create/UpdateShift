import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { UserPlus, Users, Clock, Check, X, MessageCircle } from "lucide-react";
import UserAvatar from "./UserAvatar";
import UserProfileModal from "./UserProfileModal";

export default function FriendsPanel({ currentUser, onOpenDM, onAddFriend, liveProfiles }) {
  const [tab, setTab] = useState("all");
  const [friendships, setFriendships] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriends();
  }, []);

  // Refresh automatically when a friendship is created/updated/deleted —
  // e.g. someone sends you a request while your Friends panel is open.
  useEffect(() => {
    const unsubscribe = db.entities.Friendship.subscribe(() => {
      // On ne filtre pas selon "ça me concerne" : un événement DELETE
      // (ex: quelqu'un refuse une demande) n'envoie pas toutes les
      // colonnes par défaut côté Supabase, donc on ne peut pas le
      // vérifier de façon fiable ici. Un rechargement est peu coûteux.
      loadFriends();
    });
    return unsubscribe;
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    const sent = await db.entities.Friendship.filter({ requester_id: currentUser.id });
    const received = await db.entities.Friendship.filter({ receiver_id: currentUser.id });
    const all = [...sent, ...received];
    setFriendships(all);

    // Load profiles
    const otherIds = all.map((f) =>
      f.requester_id === currentUser.id ? f.receiver_id : f.requester_id
    );
    const uniqueIds = [...new Set(otherIds)];
    const profs = await Promise.all(
      uniqueIds.map((uid) => db.entities.UserProfile.filter({ user_id: uid }).then((r) => r[0]))
    );
    setProfiles(profs.filter(Boolean));
    setLoading(false);
  };

  const getOtherUser = (friendship) => {
    const otherId =
      friendship.requester_id === currentUser.id ? friendship.receiver_id : friendship.requester_id;
    const otherUsername =
      friendship.requester_id === currentUser.id
        ? friendship.receiver_username
        : friendship.requester_username;
    const base = profiles.find((p) => p.user_id === otherId) || {
      user_id: otherId,
      username: otherUsername,
      status: "offline"
    };
    // Comme pour la DMSidebar : les profils sont chargés une seule fois au
    // montage, donc sans ça le statut affiché ici ne bouge plus tant qu'on
    // ne recharge pas la liste d'amis.
    return { ...base, ...(liveProfiles?.[otherId] || {}) };
  };

  const acceptedFriendships = friendships.filter((f) => f.status === "accepted");
  const pendingReceived = friendships.filter(
    (f) => f.status === "pending" && f.receiver_id === currentUser.id
  );
  const pendingSent = friendships.filter(
    (f) => f.status === "pending" && f.requester_id === currentUser.id
  );

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");
    const username = addUsername.trim().replace(/^@/, "");
    if (!username) return;

    if (username.toLowerCase() === currentUser.username.toLowerCase()) {
      setAddError("Tu ne peux pas t'ajouter toi-même.");
      return;
    }

    // Recherche insensible à la casse : on récupère tous les profils et on
    // compare nous-mêmes, car db.entities.UserProfile.filter({ username })
    // exige une correspondance EXACTE (majuscules/minuscules incluses).
    const allProfiles = await db.entities.UserProfile.filter({});
    const target = allProfiles.find(
      (p) => (p.username || "").toLowerCase() === username.toLowerCase()
    );
    if (!target) {
      setAddError("Aucun utilisateur trouvé avec ce nom.");
      return;
    }

    const existing = [
      ...(await db.entities.Friendship.filter({ requester_id: currentUser.id, receiver_id: target.user_id })),
      ...(await db.entities.Friendship.filter({ requester_id: target.user_id, receiver_id: currentUser.id }))
    ];
    if (existing.length) {
      setAddError("Une relation existe déjà avec cet utilisateur.");
      return;
    }

    await db.entities.Friendship.create({
      requester_id: currentUser.id,
      receiver_id: target.user_id,
      requester_username: currentUser.username,
      receiver_username: target.username,
      status: "pending"
    });

    setAddSuccess(`Demande envoyée à ${target.username} !`);
    setAddUsername("");
    loadFriends();
  };

  const acceptRequest = async (friendship) => {
    await db.entities.Friendship.update(friendship.id, { status: "accepted" });
    loadFriends();
  };

  const declineRequest = async (friendship) => {
    await db.entities.Friendship.delete(friendship.id);
    loadFriends();
  };

  const removeFriend = async (friendship) => {
    await db.entities.Friendship.delete(friendship.id);
    loadFriends();
  };

  const TABS = [
    { id: "all", label: "Tous les amis", count: acceptedFriendships.length },
    { id: "pending", label: "En attente", count: pendingReceived.length },
    { id: "sent", label: "Envoyées", count: pendingSent.length },
    { id: "add", label: "Ajouter un ami" }
  ];

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="h-12 border-b border-[var(--bg-tertiary)] flex items-center gap-4 px-4 flex-shrink-0">
        <Users className="w-5 h-5 text-[var(--text-muted-alt)]" />
        <div className="flex items-center gap-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setAddError(""); setAddSuccess(""); }}
              className={`text-sm font-medium px-2 py-1 rounded transition ${
                tab === t.id ? "bg-[var(--bg-input)] text-white" : "text-[var(--text-muted-alt)] hover:text-white"
              }`}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#5865f2] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "add" ? (
          <div className="max-w-md">
            <h3 className="text-white font-bold text-sm uppercase tracking-wide mb-2">
              Ajouter un ami
            </h3>
            <p className="text-[var(--text-secondary)] text-sm mb-3">
              Tu peux ajouter des amis grâce à leur nom d'utilisateur Shift.
            </p>
            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="looping2 (sans le @)"
                className="flex-1 bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
              />
              <button
                type="submit"
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
              >
                Envoyer la demande
              </button>
            </form>
            {addError && <p className="text-red-400 text-sm mt-2">{addError}</p>}
            {addSuccess && <p className="text-[#23a559] text-sm mt-2">{addSuccess}</p>}
          </div>
        ) : (
          <div className="space-y-1 max-w-2xl">
            {(tab === "all" ? acceptedFriendships : tab === "pending" ? pendingReceived : pendingSent).map(
              (f) => {
                const other = getOtherUser(f);
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-modifier-hover)] transition group"
                  >
                    <button
                      onClick={() => setSelectedProfile(other)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <UserAvatar user={other} size={36} showStatus={tab === "all"} />
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {other.display_name || other.username}
                        </p>
                        <p className="text-[var(--text-muted-alt)] text-xs truncate">@{other.username}</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tab === "all" && (
                        <button
                          onClick={() => onOpenDM?.(other)}
                          title="Envoyer un message"
                          className="p-2 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted-alt)] hover:text-white hover:bg-[var(--bg-modifier-hover)] transition"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      {tab === "pending" && (
                        <>
                          <button
                            onClick={() => acceptRequest(f)}
                            title="Accepter"
                            className="p-2 rounded-full bg-[#23a559]/20 text-[#23a559] hover:bg-[#23a559] hover:text-white transition"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => declineRequest(f)}
                            title="Refuser"
                            className="p-2 rounded-full bg-[#ed4245]/20 text-[#ed4245] hover:bg-[#ed4245] hover:text-white transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {tab === "sent" && (
                        <span className="flex items-center gap-1 text-[var(--text-muted-alt)] text-xs">
                          <Clock className="w-3.5 h-3.5" />
                          En attente
                        </span>
                      )}
                      {tab === "all" && (
                        <button
                          onClick={() => removeFriend(f)}
                          title="Retirer"
                          className="p-2 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted-alt)] hover:text-[#ed4245] hover:bg-[#ed4245]/10 transition opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
            )}

            {(tab === "all" ? acceptedFriendships : tab === "pending" ? pendingReceived : pendingSent).length === 0 && (
              <p className="text-[var(--text-muted)] text-sm italic px-3 py-4">
                {tab === "all" && "Tu n'as pas encore d'amis. Ajoutes-en depuis l'onglet \"Ajouter un ami\" !"}
                {tab === "pending" && "Aucune demande en attente."}
                {tab === "sent" && "Aucune demande envoyée."}
              </p>
            )}
          </div>
        )}
      </div>

      {selectedProfile && (
        <UserProfileModal
          userId={selectedProfile.user_id}
          username={selectedProfile.username}
          currentUserId={currentUser?.id}
          onClose={() => setSelectedProfile(null)}
          onOpenDM={(profile) => {
            setSelectedProfile(null);
            onOpenDM?.(profile);
          }}
          onAddFriend={onAddFriend}
          liveProfiles={liveProfiles}
        />
      )}
    </div>
  );
}
