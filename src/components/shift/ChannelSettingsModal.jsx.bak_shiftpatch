import React, { useState } from "react";

import { X, Hash, Volume2, Trash2, Lock, Globe } from "lucide-react";

export default function ChannelSettingsModal({
  channel,
  categories,
  roles,
  members,
  onClose,
  onRename,
  onDelete,
  onMoveCategory,
  onUpdateAccess,
  initialTab = "overview"
}) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(channel.name);
  const [categoryChoice, setCategoryChoice] = useState(channel.category || "");
  const [newCategory, setNewCategory] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isRestricted =
    (channel.allowed_role_ids && channel.allowed_role_ids.length > 0) ||
    (channel.allowed_user_ids && channel.allowed_user_ids.length > 0);

  const saveOverview = () => {
    if (name.trim() && name.trim() !== channel.name) onRename(name.trim());
    const finalCategory = newCategory.trim() || categoryChoice;
    if (finalCategory !== (channel.category || "")) onMoveCategory(finalCategory || null);
    onClose();
  };

  const toggleRole = (roleId) => {
    const current = channel.allowed_role_ids || [];
    const next = current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId];
    onUpdateAccess({ allowed_role_ids: next, allowed_user_ids: channel.allowed_user_ids || [] });
  };

  const toggleMember = (userId) => {
    const current = channel.allowed_user_ids || [];
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    onUpdateAccess({ allowed_role_ids: channel.allowed_role_ids || [], allowed_user_ids: next });
  };

  const clearRestrictions = () => onUpdateAccess({ allowed_role_ids: [], allowed_user_ids: [] });

  const TABS = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "access", label: "Accès" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60" onClick={onClose}>
      <div
        className="m-auto flex bg-[var(--bg-primary)] rounded-2xl w-[640px] max-h-[75vh] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-44 bg-[var(--bg-secondary)] flex flex-col flex-shrink-0 p-3">
          <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide px-2 mb-2 truncate flex items-center gap-1.5">
            {channel.type === "voice" ? <Volume2 className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
            {channel.name}
          </p>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition mb-0.5 ${
                tab === t.id ? "bg-[var(--bg-modifier-hover)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="text-left px-3 py-2 rounded-lg text-sm font-medium text-[#ed4245] hover:bg-[#ed4245]/10 transition mt-auto"
          >
            Supprimer le salon
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <h2 className="text-white font-bold text-lg">Paramètres du salon</h2>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {tab === "overview" && (
              <>
                <div>
                  <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">
                    Nom du salon
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">
                    Catégorie
                  </label>
                  <select
                    value={categoryChoice}
                    onChange={(e) => { setCategoryChoice(e.target.value); setNewCategory(""); }}
                    className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition mb-2"
                  >
                    <option value="">Sans catégorie</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    value={newCategory}
                    onChange={(e) => { setNewCategory(e.target.value); if (e.target.value) setCategoryChoice(""); }}
                    placeholder="...ou créer une nouvelle catégorie"
                    className="w-full bg-[var(--bg-tertiary)] text-white px-4 py-2.5 rounded-lg text-sm outline-none border border-transparent focus:border-[#5865f2] transition placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <button
                  onClick={saveOverview}
                  className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  Enregistrer
                </button>
              </>
            )}

            {tab === "access" && (
              <>
                <div
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
                    isRestricted ? "border-[#f0b232] bg-[#f0b232]/10" : "border-[#23a559] bg-[#23a559]/10"
                  }`}
                >
                  {isRestricted ? <Lock className="w-5 h-5 text-[#f0b232] flex-shrink-0" /> : <Globe className="w-5 h-5 text-[#23a559] flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      {isRestricted ? "Salon restreint" : "Salon public"}
                    </p>
                    <p className="text-[var(--text-muted-alt)] text-xs">
                      {isRestricted
                        ? "Seuls les rôles/membres cochés ci-dessous y ont accès."
                        : "Visible par tous les membres du serveur. Coche un rôle ou un membre ci-dessous pour le restreindre."}
                    </p>
                  </div>
                  {isRestricted && (
                    <button
                      onClick={clearRestrictions}
                      className="text-xs text-[var(--text-muted-alt)] hover:text-white transition underline flex-shrink-0"
                    >
                      Rendre public
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Rôles autorisés</p>
                  <div className="space-y-1">
                    {roles.length === 0 && <p className="text-[var(--text-muted)] text-sm italic">Aucun rôle sur ce serveur.</p>}
                    {roles.map((role) => {
                      const checked = (channel.allowed_role_ids || []).includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-modifier-hover)] cursor-pointer transition"
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleRole(role.id)} />
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: role.color }} />
                          <span className="text-white text-sm">{role.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2">Membres autorisés individuellement</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {members.map((m) => {
                      const uid = m.user_id || m.id;
                      const checked = (channel.allowed_user_ids || []).includes(uid);
                      return (
                        <label
                          key={uid}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-modifier-hover)] cursor-pointer transition"
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleMember(uid)} />
                          <span className="text-white text-sm">{m.display_name || m.username}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showConfirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(false); }}>
          <div className="bg-[var(--bg-primary)] rounded-xl p-6 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-2">Supprimer le salon</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-5">
              Es-tu sûr de vouloir supprimer <strong className="text-white">#{channel.name}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmDelete(false)} className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition">
                Annuler
              </button>
              <button
                onClick={() => { onDelete(); onClose(); }}
                className="flex-1 bg-[#ed4245] hover:bg-[#c73033] text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
