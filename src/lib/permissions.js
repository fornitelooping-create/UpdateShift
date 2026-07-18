// Permission utility: checks if a member has a given permission
// based on their assigned roles and/or owner status.
// The server owner always has every permission.

export function hasPermission(member, roles, permissionKey, isOwner) {
  if (isOwner) return true;
  if (!member?.role_ids || !Array.isArray(roles)) return false;
  return roles
    .filter((r) => member.role_ids.includes(r.id))
    .some((r) => r.permissions?.[permissionKey]);
}

// Returns a ready-to-use permissions object for the current user.
export function computePermissions(member, roles, isOwner) {
  return {
    isOwner: !!isOwner,
    canManageChannels: hasPermission(member, roles, "manage_channels", isOwner),
    canManageRoles: hasPermission(member, roles, "manage_roles", isOwner),
    canKickMembers: hasPermission(member, roles, "kick_members", isOwner),
    canUseCommands: hasPermission(member, roles, "use_commands", isOwner),
    canViewBans: hasPermission(member, roles, "view_bans", isOwner),
  };
}