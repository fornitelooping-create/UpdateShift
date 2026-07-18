import { db } from '@/lib/localDb';

import React, { useState } from "react";

import { X, Camera, Copy, Check, Shield, LogOut, Trash2, Loader2, AlertCircle, Hash, Volume2, Settings2, Plus, ChevronLeft, Ban as BanIcon } from "lucide-react";
import UserAvatar from "./UserAvatar";
import ChannelSettingsModal from "./ChannelSettingsModal";
import { useIsMobile } from "@/hooks/use-mobile";
import moment from "moment";
import "moment/locale/fr";
moment.locale("fr");

export default function ServerSettingsModal({
  server,
  members,
  roles,
  channels,
  categories,
  currentUser,
  isMemberOwner,
  permissions,
  onClose,
  onManageRoles,
  onDeleteServer,
  onLeaveServer, // called once it's safe to leave (non-owner, or owner who already transferred)
  onOwnershipTransferred, // called with the new owner id, so the parent can refresh its data
  onCreateChannel,
  onRenameChannel,
  onDeleteChannel,
  onMoveChannelCategory,
  onUpdateChannelAccess
}) {
  const [tab, setTab] = useState("overview");
  const isMobile = useIsMobile();
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState(null);
  const [bans, setBans] = useState([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [unbanningId, setUnbanningId] = useState(null);

  const editingChannel = (channels || []).find((c) => c.id === editingChannelId) || null;

  const otherMembers = members.filter((m) => (m.user_id || m.id) !== currentUser.id);

  const canManageChannels = permissions?.canManageChannels ?? isMemberOwner;
  const canManageRoles = permissions?.canManageRoles ?? isMemberOwner;
  const canViewBans = permissions?.canViewBans ?? isMemberOwner;

  const loadBans = async () => {
    if (!server?.id) return;
    setBansLoading(true);
    const rows = await db.entities.Ban.filter({ server_id: server.id });
    setBans(
      rows.slice().sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
    );
    setBansLoading(false);
  };

  const handleUnban = async (ban) => {
    setUnbanningId(ban.id);
    try {
      await db.entities.Ban.delete(ban.id);
      setBans((prev) => prev.filter((b) => b.id !== ban.id));
    } catch (err) {
      console.error("Échec du débannissement", err);
    } finally {
      setUnbanningId(null);
    }
  };

  const handleIconChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !server?.id) return;
    setIconUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    await db.entities.Server.update(server.id, { icon: file_url });
    setIconUploading(false);
  };

  const copyInviteCode = () => {
    if (server?.invite_code) {
      navigator.clipboard.writeText(server.invite_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleTransferAndLeave = async () => {
    if (!selectedNewOwner) return;
    setTransferring(true);
    await db.entities.Server.update(server.id, { owner_id: selectedNewOwner });
    setTransferring(false);
    onOwnershipTransferred?.(selectedNewOwner);
    onLeaveServer?.();
  };

  const TABS = [
    { id: "overview", label: "Vue d'ensemble" },
    ...(canManageChannels ? [{ id: "channels", label: "Salons" }] : []),
    ...(canManageRoles ? [{ id: "roles", label: "Rôles" }] : []),
    ...(canViewBans ? [{ id: "bans", label: "Membres bannis" }] : []),
    { id: "leave", label: isMemberOwner ? "Quitter / Transférer" : "Quitter le serveur" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60" onClick={onClose}>
      <div
        className={
          isMobile
            ? "flex flex-col w-full h-full bg-[var(--bg-primary)] overflow-hidden"
            : "m-auto flex bg-[var(--bg-primary)] rounded-2xl w-[760px] max-h-[80vh] shadow-2xl overflow-hidden"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div
          className={
            isMobile
              ? mobileShowContent
                ? "hidden"
                : "w-full h-full bg-[var(--bg-secondary)] flex flex-col p-3 overflow-y-auto"
              : "w-48 bg-[var(--bg-secondary)] flex flex-col flex-shrink-0 p-3"
          }
        >
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide px-2 mb-2 truncate">
            {server?.name}
          </p>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "bans") loadBans();
                if (isMobile) setMobileShowContent(true);
              }}
              className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition mb-0.5 ${
                tab === t.id ? "bg-[var(--bg-modifier-hover)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)] hover:text-white"
              } ${t.id === "leave" ? "text-[#ed4245]" : ""}`}
            >
              {t.label}
            </button>
          ))}
          {isMemberOwner && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-[#ed4245] hover:bg-[#ed4245]/10 transition mt-auto"
            >
              Supprimer le serveur
            </button>
          )}
        </div>

        {/* Content */}
        <div className={isMobile ? (mobileShowContent ? "w-full h-full flex flex-col overflow-hidden" : "hidden") : "flex-1 flex flex-col overflow-hidden"}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button onClick={() => setMobileShowContent(false)} className="text-[var(--text-muted)] hover:text-white transition -ml-2 p-1">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-white font-bold text-lg truncate">Paramètres du serveur</h2>
            </div>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {tab === "overview" && (
              <>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-[#5865f2] flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                      {server?.icon ? (
                        <img src={server.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        server?.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    {isMemberOwner && (
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl cursor-pointer opacity-0 hover:opacity-100 transition">
                        {iconUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Camera className="w-4 h-4 text-white" />
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
                      </label>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold">{server?.name}</p>
                    <p className="text-[var(--text-muted-alt)] text-xs">{members.length} membre{members.length > 1 ? "s" : ""}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1">Code d'invitation</p>
                  <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2.5">
                    <span className="text-[var(--text-normal)] text-sm flex-1 font-mono">{server?.invite_code || "---"}</span>
                    <button onClick={copyInviteCode} className="text-[var(--text-muted)] hover:text-white transition">
                      {codeCopied ? <Check className="w-4 h-4 text-[#23a559]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === "channels" && canManageChannels && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => onCreateChannel?.("text")}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2 rounded-lg text-sm font-medium transition"
                  >
                    <Hash className="w-4 h-4" /> Nouveau salon texte
                  </button>
                  <button
                    onClick={() => onCreateChannel?.("voice")}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2 rounded-lg text-sm font-medium transition"
                  >
                    <Volume2 className="w-4 h-4" /> Nouveau salon vocal
                  </button>
                </div>

                <div className="space-y-1">
                  {(channels || []).map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-modifier-hover)] transition group"
                    >
                      {ch.type === "voice" ? (
                        <Volume2 className="w-4 h-4 text-[var(--text-muted-alt)] flex-shrink-0" />
                      ) : (
                        <Hash className="w-4 h-4 text-[var(--text-muted-alt)] flex-shrink-0" />
                      )}
                      <span className="flex-1 text-sm text-white truncate">{ch.name}</span>
                      {ch.category && (
                        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{ch.category}</span>
                      )}
                      <button
                        onClick={() => setEditingChannelId(ch.id)}
                        className="text-[var(--text-muted)] hover:text-white transition flex-shrink-0"
                        title="Paramètres du salon"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteChannel(ch)}
                        className="text-[var(--text-muted)] hover:text-[#ed4245] transition flex-shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!channels || channels.length === 0) && (
                    <p className="text-[var(--text-muted)] text-sm italic px-3 py-2">Aucun salon pour l'instant.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "roles" && canManageRoles && (
              <div className="flex flex-col items-start gap-3">
                <p className="text-[var(--text-secondary)] text-sm">
                  Gère les rôles et permissions du serveur (créer, colorer, assigner).
                </p>
                <button
                  onClick={() => { onManageRoles?.(); onClose(); }}
                  className="flex items-center gap-2 bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  <Shield className="w-4 h-4" />
                  Ouvrir le gestionnaire de rôles
                </button>
              </div>
            )}

            {tab === "bans" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold text-sm mb-1">Membres bannis</h3>
                  <p className="text-[var(--text-muted)] text-xs">
                    Ces personnes ne peuvent pas rejoindre {server?.name} tant qu'elles restent bannies.
                  </p>
                </div>

                {bansLoading ? (
                  <div className="animate-pulse space-y-2">
                    {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-[var(--border-default)] rounded-lg" />)}
                  </div>
                ) : bans.length === 0 ? (
                  <p className="text-[var(--text-muted)] text-sm italic">Aucun membre banni pour l'instant.</p>
                ) : (
                  <div className="space-y-2">
                    {bans.map((ban) => {
                      const expired = ban.expires_at && new Date(ban.expires_at) < new Date();
                      return (
                        <div
                          key={ban.id}
                          className="flex items-center justify-between gap-3 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#ed4245]/15 flex items-center justify-center flex-shrink-0">
                              <BanIcon className="w-4 h-4 text-[#ed4245]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">{ban.username || "Utilisateur inconnu"}</p>
                              <p className="text-[var(--text-muted)] text-xs truncate">
                                Banni par {ban.banned_by_name || "?"}
                                {ban.created_date ? ` · ${moment(ban.created_date).format("DD MMM YYYY")}` : ""}
                                {ban.expires_at
                                  ? expired
                                    ? " · expiré"
                                    : ` · jusqu'au ${moment(ban.expires_at).format("DD MMM YYYY, HH:mm")}`
                                  : " · définitif"}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnban(ban)}
                            disabled={unbanningId === ban.id}
                            className="flex-shrink-0 flex items-center gap-1.5 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          >
                            {unbanningId === ban.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Débannir
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "leave" && (
              <div className="space-y-4">
                {isMemberOwner ? (
                  <>
                    <div className="flex items-start gap-3 bg-[#f0b232]/10 border border-[#f0b232]/30 rounded-xl p-4">
                      <AlertCircle className="w-5 h-5 text-[#f0b232] flex-shrink-0 mt-0.5" />
                      <p className="text-[var(--text-normal)] text-sm">
                        Tu es propriétaire de ce serveur. Choisis un nouveau propriétaire avant de pouvoir le quitter.
                      </p>
                    </div>

                    {otherMembers.length === 0 ? (
                      <p className="text-[var(--text-muted)] text-sm italic">
                        Il n'y a personne d'autre à qui transférer la propriété. Tu peux supprimer le serveur si tu veux le quitter définitivement.
                      </p>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">
                            Nouveau propriétaire
                          </label>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {otherMembers.map((m) => {
                              const uid = m.user_id || m.id;
                              return (
                                <button
                                  key={uid}
                                  onClick={() => setSelectedNewOwner(uid)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition border-2 ${
                                    selectedNewOwner === uid
                                      ? "border-[#5865f2] bg-[#5865f2]/10"
                                      : "border-transparent bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]"
                                  }`}
                                >
                                  <UserAvatar user={m} size={28} />
                                  <span className="text-white text-sm">{m.display_name || m.username}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={handleTransferAndLeave}
                          disabled={!selectedNewOwner || transferring}
                          className="w-full flex items-center justify-center gap-2 bg-[#ed4245] hover:bg-[#c73033] disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition"
                        >
                          {transferring ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LogOut className="w-4 h-4" />
                          )}
                          Transférer la propriété et quitter
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[var(--text-secondary)] text-sm">
                      Tu vas quitter <strong className="text-white">{server?.name}</strong>. Tu pourras toujours le rejoindre à nouveau avec un lien d'invitation.
                    </p>
                    <button
                      onClick={() => setShowConfirmLeave(true)}
                      className="flex items-center gap-2 bg-[#ed4245] hover:bg-[#c73033] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                    >
                      <LogOut className="w-4 h-4" />
                      Quitter le serveur
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm leave (non-owner) */}
      {showConfirmLeave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={(e) => { e.stopPropagation(); setShowConfirmLeave(false); }}>
          <div className="bg-[var(--bg-primary)] rounded-xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-2">Quitter le serveur</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-5">
              Es-tu sûr de vouloir quitter <strong className="text-white">{server?.name}</strong> ?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmLeave(false)} className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition">
                Annuler
              </button>
              <button onClick={() => { onLeaveServer?.(); setShowConfirmLeave(false); }} className="flex-1 bg-[#ed4245] hover:bg-[#c73033] text-white py-2.5 rounded-lg text-sm font-medium transition">
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete (owner) */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(false); }}>
          <div className="bg-[var(--bg-primary)] rounded-xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-2">Supprimer le serveur</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-5">
              Es-tu sûr de vouloir supprimer <strong className="text-white">{server?.name}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmDelete(false)} className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition">
                Annuler
              </button>
              <button onClick={() => { onDeleteServer?.(); setShowConfirmDelete(false); }} className="flex-1 bg-[#ed4245] hover:bg-[#c73033] text-white py-2.5 rounded-lg text-sm font-medium transition">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {editingChannel && (
        <ChannelSettingsModal
          channel={editingChannel}
          categories={categories || []}
          roles={roles || []}
          members={members}
          onClose={() => setEditingChannelId(null)}
          onRename={(name) => onRenameChannel?.(editingChannel.id, name)}
          onDelete={() => onDeleteChannel?.(editingChannel.id)}
          onMoveCategory={(cat) => onMoveChannelCategory?.(editingChannel.id, cat)}
          onUpdateAccess={(access) => onUpdateChannelAccess?.(editingChannel.id, access)}
        />
      )}

      {confirmDeleteChannel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setConfirmDeleteChannel(null)}>
          <div className="bg-[var(--bg-primary)] rounded-xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-2">Supprimer le salon</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-5">
              Es-tu sûr de vouloir supprimer <strong className="text-white">#{confirmDeleteChannel.name}</strong> ?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteChannel(null)} className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition">
                Annuler
              </button>
              <button
                onClick={() => { onDeleteChannel?.(confirmDeleteChannel.id); setConfirmDeleteChannel(null); }}
                className="flex-1 bg-[#ed4245] hover:bg-[#c73033] text-white py-2.5 rounded-lg text-sm font-medium transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
