import React, { useState } from "react";
import UserAvatar from "./UserAvatar";
import UserProfileModal from "./UserProfileModal";

export default function MemberList({ members, roles, currentUser, onOpenDM, onAddFriend, liveProfiles, canKickMembers, onKickMember, serverOwnerId }) {
  const [selectedUser, setSelectedUser] = useState(null);

  // Group members by their highest role
  const getRoleForMember = (member) => {
    if (!member.role_ids || member.role_ids.length === 0) return null;
    const memberRoles = roles.filter((r) => member.role_ids.includes(r.id));
    if (memberRoles.length === 0) return null;
    return memberRoles.sort((a, b) => (b.position || 0) - (a.position || 0))[0];
  };

  // Separate online vs offline members first
  const onlineMembers = members.filter((m) => (m.status || "offline") !== "offline");
  const offlineMembers = members.filter((m) => (m.status || "offline") === "offline");

  // Group online members by their highest role
  const grouped = {};
  const noRole = [];

  onlineMembers.forEach((m) => {
    const role = getRoleForMember(m);
    if (role) {
      if (!grouped[role.id]) grouped[role.id] = { role, members: [] };
      grouped[role.id].members.push(m);
    } else {
      noRole.push(m);
    }
  });

  const groupedList = Object.values(grouped).sort(
    (a, b) => (b.role.position || 0) - (a.role.position || 0)
  );

  const renderMember = (m) => {
    return (
      <button
        key={m.user_id || m.id}
        onClick={() => setSelectedUser(m)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-modifier-hover)] transition text-left group"
      >
        <UserAvatar user={m} size={32} showStatus />
        <span
          className="text-sm truncate font-medium"
          style={{ color: getRoleForMember(m)?.color || "var(--text-normal)" }}
        >
          {m.display_name || m.username}
        </span>
      </button>
    );
  };

  return (
    <div className="w-60 bg-[var(--bg-secondary)] flex-shrink-0 overflow-y-auto py-3">
      {groupedList.map(({ role, members: roleMembers }) => (
        <div key={role.id} className="mb-3">
          <p className="text-[var(--text-muted-alt)] text-xs font-semibold uppercase tracking-wide px-3 mb-1">
            {role.name} — {roleMembers.length}
          </p>
          <div className="px-1">{roleMembers.map(renderMember)}</div>
        </div>
      ))}

      {noRole.length > 0 && (
        <div className="mb-3">
          <p className="text-[var(--text-muted-alt)] text-xs font-semibold uppercase tracking-wide px-3 mb-1">
            Membres — {noRole.length}
          </p>
          <div className="px-1">{noRole.map(renderMember)}</div>
        </div>
      )}

      {offlineMembers.length > 0 && (
        <div className="mb-3">
          <p className="text-[var(--text-muted-alt)] text-xs font-semibold uppercase tracking-wide px-3 mb-1">
            Hors ligne — {offlineMembers.length}
          </p>
          <div className="px-1 opacity-50">{offlineMembers.map(renderMember)}</div>
        </div>
      )}

      {selectedUser && (
        <UserProfileModal
          userId={selectedUser.user_id || selectedUser.id}
          username={selectedUser.username}
          currentUserId={currentUser?.id}
          roles={roles}
          memberRoleIds={selectedUser.role_ids}
          canKick={canKickMembers}
          onKick={onKickMember}
          serverOwnerId={serverOwnerId}
          onClose={() => setSelectedUser(null)}
          onOpenDM={(profile) => {
            setSelectedUser(null);
            onOpenDM?.(profile);
          }}
          onAddFriend={onAddFriend}
          liveProfiles={liveProfiles}
        />
      )}
    </div>
  );
}