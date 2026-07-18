import { db } from '@/lib/localDb';

import React, { useState } from "react";

import { X, Hash, Loader2, Plus, Link } from "lucide-react";

export default function JoinServerModal({ currentUser, onClose, onJoined, onCreateInstead }) {
  const [tab, setTab] = useState("join");
  const [inviteCode, setInviteCode] = useState("");
  const [serverName, setServerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const joinServer = async () => {
    if (!inviteCode.trim()) return;
    setError("");
    setLoading(true);
    const servers = await db.entities.Server.filter({ invite_code: inviteCode.trim() });
    if (!servers.length) {
      setError("Code invalide. Vérifie le lien d'invitation.");
      setLoading(false);
      return;
    }
    const server = servers[0];
    // Check if already member
    const members = await db.entities.ServerMember.filter({ server_id: server.id, user_id: currentUser.id });
    if (members.length) {
      setError("Tu es déjà membre de ce serveur !");
      setLoading(false);
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
    setLoading(false);
    onJoined(server);
    onClose();
  };

  const createServer = async () => {
    if (!serverName.trim()) return;
    setLoading(true);
    const s = await db.entities.Server.create({
      name: serverName.trim(),
      owner_id: currentUser.id,
      invite_code: Math.random().toString(36).substring(2, 8)
    });
    await db.entities.Channel.create({ server_id: s.id, name: "général", type: "text", position: 0 });
    await db.entities.ServerMember.create({
      server_id: s.id,
      user_id: currentUser.id,
      username: currentUser.username,
      display_name: currentUser.display_name || currentUser.username,
      avatar: currentUser.avatar || null,
      status: "online",
      online: true,
      role_ids: []
    });
    setLoading(false);
    onJoined(s);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => { setTab("join"); setError(""); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "join" ? "bg-[#5865f2] text-white" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              Rejoindre
            </button>
            <button
              onClick={() => { setTab("create"); setError(""); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === "create" ? "bg-[#5865f2] text-white" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              Créer
            </button>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {tab === "join" ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#5865f2]/20 rounded-xl flex items-center justify-center">
                  <Link className="w-6 h-6 text-[#5865f2]" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Rejoindre un serveur</h3>
                  <p className="text-[var(--text-secondary)] text-sm">Entre le code d'invitation</p>
                </div>
              </div>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinServer()}
                placeholder="Ex : abc123"
                autoFocus
                className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-3 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)] mb-2"
              />
              {error && (
                <p className="text-red-400 text-sm mb-2 flex items-center justify-between gap-2">
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
              <button
                onClick={joinServer}
                disabled={loading || !inviteCode.trim()}
                className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Rejoindre le serveur
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#23a559]/20 rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-[#23a559]" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Créer un serveur</h3>
                  <p className="text-[var(--text-secondary)] text-sm">Tu en seras le propriétaire</p>
                </div>
              </div>
              <input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createServer()}
                placeholder="Nom du serveur"
                autoFocus
                className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-3 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)] mb-2"
              />
              <button
                onClick={createServer}
                disabled={loading || !serverName.trim()}
                className="w-full bg-[#23a559] hover:bg-[#1d8a4a] disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Créer le serveur
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}