import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { Plus, Trash2, X, Shield } from "lucide-react";

const COLORS = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#f0b232", "#00b0f4", "#ff5e05"];

export default function RolesModal({ server, members, onClose, onUpdate }) {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [assignTab, setAssignTab] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    const r = await db.entities.Role.filter({ server_id: server.id });
    setRoles(r);
    setLoading(false);
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    const r = await db.entities.Role.create({
      server_id: server.id,
      name: newRoleName.trim(),
      color: COLORS[roles.length % COLORS.length],
      position: roles.length,
      permissions: {}
    });
    setNewRoleName("");
    loadRoles();
    onUpdate?.();
  };

  const deleteRole = async (role) => {
    await db.entities.Role.delete(role.id);
    if (selectedRole?.id === role.id) setSelectedRole(null);
    loadRoles();
    onUpdate?.();
  };

  const updateRoleColor = async (role, color) => {
    const updated = { ...role, color };
    setSelectedRole(updated);
    setRoles((prev) => prev.map((r) => r.id === role.id ? updated : r));
    await db.entities.Role.update(role.id, { color });
    onUpdate?.();
  };

  const togglePermission = async (role, perm) => {
    const perms = { ...(role.permissions || {}) };
    perms[perm] = !perms[perm];
    // Optimistic update for instant feedback
    const updated = { ...role, permissions: perms };
    setSelectedRole(updated);
    setRoles((prev) => prev.map((r) => r.id === role.id ? updated : r));
    await db.entities.Role.update(role.id, { permissions: perms });
    onUpdate?.();
  };

  const assignRole = async (member, role) => {
    const currentRoles = member.role_ids || [];
    const hasRole = currentRoles.includes(role.id);
    const newRoles = hasRole
      ? currentRoles.filter((id) => id !== role.id)
      : [...currentRoles, role.id];
    await db.entities.ServerMember.update(member.id, { role_ids: newRoles });
    onUpdate?.();
  };

  const PERMISSIONS = [
    { key: "manage_channels", label: "Gérer les canaux" },
    { key: "manage_roles", label: "Gérer les rôles" },
    { key: "kick_members", label: "Expulser des membres" },
    { key: "use_commands", label: "Utiliser les commandes (/clear, /ban, /unban)" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-[700px] max-h-[85vh] flex flex-col sm:flex-row overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Roles list */}
        <div className="w-full sm:w-56 max-h-40 sm:max-h-none bg-[var(--bg-secondary)] flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-[var(--bg-tertiary)]">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Rôles
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-8 bg-[var(--border-default)] rounded" />)}
              </div>
            ) : roles.map((role) => (
              <button
                key={role.id}
                onClick={() => { setSelectedRole(role); setAssignTab(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                  selectedRole?.id === role.id ? "bg-[var(--bg-modifier-hover)]" : "hover:bg-[var(--bg-modifier-hover)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: role.color }} />
                  <span className="text-white truncate">{role.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRole(role); }}
                  className="text-[var(--text-muted)] hover:text-[#ed4245] transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-[var(--bg-tertiary)]">
            <div className="flex gap-2">
              <input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createRole()}
                placeholder="Nouveau rôle..."
                className="flex-1 bg-[var(--bg-tertiary)] text-white text-xs px-2 py-1.5 rounded outline-none placeholder:text-[var(--text-muted)]"
              />
              <button onClick={createRole} className="text-[#5865f2] hover:text-white transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Role detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[var(--bg-tertiary)]">
            <h3 className="text-white font-bold">
              {selectedRole ? `Éditer : ${selectedRole.name}` : "Sélectionne un rôle"}
            </h3>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {selectedRole ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Tabs */}
              <div className="flex gap-4 border-b border-[var(--border-default)]">
                <button
                  onClick={() => setAssignTab(false)}
                  className={`pb-2 text-sm font-medium border-b-2 transition ${!assignTab ? "border-white text-white" : "border-transparent text-[var(--text-muted)]"}`}
                >
                  Permissions
                </button>
                <button
                  onClick={() => setAssignTab(true)}
                  className={`pb-2 text-sm font-medium border-b-2 transition ${assignTab ? "border-white text-white" : "border-transparent text-[var(--text-muted)]"}`}
                >
                  Membres
                </button>
              </div>

              {!assignTab ? (
                <>
                  {/* Color */}
                  <div>
                    <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3">Couleur du rôle</p>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateRoleColor(selectedRole, c)}
                          className="w-8 h-8 rounded-full transition hover:scale-110"
                          style={{
                            background: c,
                            ring: selectedRole.color === c ? `2px solid white` : "none",
                            outline: selectedRole.color === c ? `2px solid white` : "none",
                            outlineOffset: "2px"
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div>
                    <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3">Permissions</p>
                    <div className="space-y-3">
                      {PERMISSIONS.map(({ key, label }) => (
                        <label key={key} className="flex items-center justify-between cursor-pointer group">
                          <span className="text-[var(--text-normal)] text-sm group-hover:text-white transition">{label}</span>
                          <div
                            onClick={() => togglePermission(selectedRole, key)}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              selectedRole.permissions?.[key] ? "bg-[#5865f2]" : "bg-[var(--text-muted)]"
                            } relative`}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                selectedRole.permissions?.[key] ? "translate-x-7" : "translate-x-1"
                              }`}
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-3">Assigner à des membres</p>
                  <div className="space-y-2">
                    {members.map((m) => {
                      const hasRole = (m.role_ids || []).includes(selectedRole.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between py-2 border-b border-[var(--border-default)]">
                          <span className="text-[var(--text-normal)] text-sm">{m.display_name || m.username}</span>
                          <button
                            onClick={() => assignRole(m, selectedRole)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                              hasRole
                                ? "bg-[#5865f2] text-white hover:bg-[#4752c4]"
                                : "bg-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover-strong)]"
                            }`}
                          >
                            {hasRole ? "Retirer" : "Assigner"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
              <p>Sélectionne un rôle à gauche</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}