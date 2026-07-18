import { db } from '@/lib/localDb';

import React, { useEffect, useState } from "react";

import { X, Search, Loader2 } from "lucide-react";

export default function BrowseServersModal({ currentUser, onClose, onJoined }) {
  const [servers, setServers] = useState([]);
  const [myServerIds, setMyServerIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [allServers, myMemberships] = await Promise.all([
        db.entities.Server.filter({}),
        db.entities.ServerMember.filter({ user_id: currentUser.id })
      ]);
      if (cancelled) return;
      setServers(allServers);
      setMyServerIds(new Set(myMemberships.map((m) => m.server_id)));
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

  const filtered = servers.filter((s) =>
    (s.name || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] flex-shrink-0">
          <div>
            <h3 className="text-white font-bold">Tous les serveurs</h3>
            <p className="text-[var(--text-secondary)] text-sm">Découvre et rejoins un serveur existant</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un serveur..."
              autoFocus
              className="w-full bg-[var(--bg-tertiary)] text-white pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-2 flex items-center justify-between gap-2">
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

        <div className="px-4 pb-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-10">
              {servers.length === 0 ? "Aucun serveur n'a encore été créé." : "Aucun serveur trouvé."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((server) => {
                const isMember = myServerIds.has(server.id);
                return (
                  <div
                    key={server.id}
                    className="flex items-center gap-3 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2.5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#5865f2] flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0">
                      {server.icon ? (
                        <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        server.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{server.name}</p>
                    </div>
                    {isMember ? (
                      <span className="text-xs text-[var(--text-muted)] px-3 py-1.5 flex-shrink-0">Membre</span>
                    ) : (
                      <button
                        onClick={() => joinServer(server)}
                        disabled={joiningId === server.id}
                        className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 flex-shrink-0"
                      >
                        {joiningId === server.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Rejoindre
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
