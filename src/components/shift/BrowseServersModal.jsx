import { db } from '@/lib/localDb';

import React, { useEffect, useMemo, useState } from "react";

import { X, Search, Loader2, Users, Compass, Trash2, ShieldAlert, Lock, Unlock } from "lucide-react";

const AVATAR_GRADIENTS = [
  "from-[#5865f2] to-[#8f5cf2]",
  "from-[#23a559] to-[#1f9c6f]",
  "from-[#f0b232] to-[#f0713b]",
  "from-[#eb459e] to-[#c73033]",
  "from-[#3ba55c] to-[#5865f2]",
];

function gradientFor(id) {
  let hash = 0;
  for (let i = 0; i < (id || "").length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export default function BrowseServersModal({ currentUser, isSiteAdmin, onClose, onJoined, onServerDeleted }) {
  const [servers, setServers] = useState([]);
  const [myServerIds, setMyServerIds] = useState(new Set());
  const [memberCounts, setMemberCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [allServers, allMembers] = await Promise.all([
        db.entities.Server.filter({}),
        db.entities.ServerMember.filter({})
      ]);
      if (cancelled) return;
      setServers(allServers);
      setMyServerIds(new Set(allMembers.filter((m) => m.user_id === currentUser.id).map((m) => m.server_id)));
      const counts = {};
      allMembers.forEach((m) => {
        counts[m.server_id] = (counts[m.server_id] || 0) + 1;
      });
      setMemberCounts(counts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const joinServer = async (server) => {
    setError("");
    setJoiningId(server.id);
    try {
      // Check if banned (bannissement permanent ou temporaire toujours actif)
      const bans = await db.entities.Ban.filter({ server_id: server.id, user_id: currentUser.id });
      const activeBan = bans.find((b) => !b.expires_at || new Date(b.expires_at) > new Date());
      if (activeBan) {
        setError(
          activeBan.expires_at
            ? `Tu es banni de ce serveur jusqu'au ${new Date(activeBan.expires_at).toLocaleString("fr-FR")}.`
            : "Tu es banni définitivement de ce serveur."
        );
        setJoiningId(null);
        return;
      }
      await db.entities.ServerMember.create({
        server_id: server.id,
        user_id: currentUser.id,
        username: currentUser.username,
        display_name: currentUser.display_name || currentUser.username,
        avatar: currentUser.avatar || null,
        status: "online",
        online: true,
        role_ids: []
      });
      setMyServerIds((prev) => new Set(prev).add(server.id));
      onJoined(server);
      onClose();
    } catch (err) {
      console.error("BrowseServersModal: join failed", err);
      setError("Impossible de rejoindre ce serveur. Réessaie.");
    } finally {
      setJoiningId(null);
    }
  };

  const deleteServerAsAdmin = async (server) => {
    setError("");
    setDeletingId(server.id);
    try {
      await db.entities.Server.delete(server.id);
      setServers((prev) => prev.filter((s) => s.id !== server.id));
      setConfirmDeleteId(null);
      onServerDeleted?.(server.id);
    } catch (err) {
      console.error("BrowseServersModal: admin delete failed", err);
      setError("Impossible de fermer ce serveur. Réessaie.");
    } finally {
      setDeletingId(null);
    }
  };

  const togglePrivacy = async (server) => {
    setError("");
    setTogglingId(server.id);
    try {
      const updated = await db.entities.Server.update(server.id, { is_private: !server.is_private });
      setServers((prev) => prev.map((s) => (s.id === server.id ? { ...s, is_private: updated?.is_private ?? !server.is_private } : s)));
    } catch (err) {
      console.error("BrowseServersModal: privacy toggle failed", err);
      setError("Impossible de changer la confidentialité de ce serveur. Réessaie.");
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = useMemo(
    () =>
      servers
        .filter((s) => isSiteAdmin || !s.is_private)
        .filter((s) => (s.name || "").toLowerCase().includes(search.trim().toLowerCase())),
    [servers, search, isSiteAdmin]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)]" onClick={onClose}>
      <div
        className="flex flex-col w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 md:px-10 pt-6 pb-5 bg-gradient-to-br from-[#5865f2]/20 via-transparent to-transparent border-b border-[var(--border-default)] flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-[var(--text-muted)] hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#5865f2]/20 flex items-center justify-center flex-shrink-0">
                <Compass className="w-5 h-5 text-[#5865f2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-bold text-lg leading-tight">Tous les serveurs</h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  {loading
                    ? "Chargement..."
                    : isSiteAdmin
                    ? `${servers.length} serveur${servers.length > 1 ? "s" : ""} créé${servers.length > 1 ? "s" : ""} (dont ${servers.filter((s) => s.is_private).length} privé${servers.filter((s) => s.is_private).length > 1 ? "s" : ""})`
                    : `${filtered.length} serveur${filtered.length > 1 ? "s" : ""} visible${filtered.length > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <div className="relative mt-4 max-w-md">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un serveur..."
                autoFocus
                className="w-full bg-[var(--bg-tertiary)] text-white pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
              />
            </div>

            {isSiteAdmin && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#ed4245] bg-[#ed4245]/10 px-2.5 py-1.5 rounded-lg w-fit">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Mode admin : tu vois les serveurs privés, tu peux les fermer ou changer leur confidentialité.</span>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm mt-3 flex items-center justify-between gap-2 max-w-md">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  title="Fermer"
                  className="p-0.5 rounded hover:bg-white/10 transition flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </p>
            )}
          </div>
        </div>

        <div className="px-6 md:px-10 py-6 overflow-y-auto flex-1">
          <div className="max-w-5xl mx-auto w-full">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Récupération des serveurs...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                <Compass className="w-10 h-10 text-[var(--text-muted)]" />
                <p className="text-[var(--text-muted)] text-sm">
                  {servers.length === 0 ? "Aucun serveur n'a encore été créé." : "Aucun serveur ne correspond à ta recherche."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((server) => {
                  const isMember = myServerIds.has(server.id);
                  const count = memberCounts[server.id] || 0;
                  const isConfirming = confirmDeleteId === server.id;

                  return (
                    <div
                      key={server.id}
                      className="flex items-center gap-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] rounded-xl px-3 py-3 transition"
                    >
                      <div
                        className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradientFor(server.id)} flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0`}
                      >
                        {server.icon ? (
                          <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                        ) : (
                          server.name?.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate flex items-center gap-1.5">
                          {server.name}
                          {server.is_private && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded flex-shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              Privé
                            </span>
                          )}
                        </p>
                        <p className="text-[var(--text-muted)] text-xs flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {count} membre{count !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-[var(--text-muted)] hover:text-white px-2 py-1.5 rounded-lg transition"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => deleteServerAsAdmin(server)}
                            disabled={deletingId === server.id}
                            className="bg-[#ed4245] hover:bg-[#c73033] disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                          >
                            {deletingId === server.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Confirmer
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isMember ? (
                            <span className="text-xs text-[var(--text-muted)] px-3 py-1.5">Membre</span>
                          ) : (
                            <button
                              onClick={() => joinServer(server)}
                              disabled={joiningId === server.id}
                              className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                            >
                              {joiningId === server.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                              Rejoindre
                            </button>
                          )}
                          {isSiteAdmin && (
                            <>
                              <button
                                onClick={() => togglePrivacy(server)}
                                disabled={togglingId === server.id}
                                title={server.is_private ? "Rendre public (admin)" : "Rendre privé (admin)"}
                                className="text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-modifier-hover-strong)] disabled:opacity-50 p-1.5 rounded-lg transition"
                              >
                                {togglingId === server.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : server.is_private ? (
                                  <Unlock className="w-4 h-4" />
                                ) : (
                                  <Lock className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(server.id)}
                                title="Fermer définitivement ce serveur (admin)"
                                className="text-[var(--text-muted)] hover:text-[#ed4245] hover:bg-[#ed4245]/10 p-1.5 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
