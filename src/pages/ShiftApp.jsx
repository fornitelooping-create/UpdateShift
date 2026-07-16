import { useVoiceChannel } from "../hooks/useVoiceChannel";

import { db } from '@/lib/localDb';
import { computePermissions } from "@/lib/permissions";

import React, { useState, useEffect, useContext } from "react";

import { ShiftAuthContext } from "@/lib/useShiftAuth";
import { Plus, Settings, Home, LogOut } from "lucide-react";
import UserAvatar from "@/components/shift/UserAvatar";
import ServerSidebar from "@/components/shift/ServerSidebar";
import MemberList from "@/components/shift/MemberList";
import ChatArea from "@/components/shift/ChatArea";
import FriendsPanel from "@/components/shift/FriendsPanel";
import DMSidebar from "@/components/shift/DMSidebar";
import RolesModal from "@/components/shift/RolesModal";
import ServerSettingsModal from "@/components/shift/ServerSettingsModal";
import NewGroupModal from "@/components/shift/NewGroupModal";
import UserProfileModal from "@/components/shift/UserProfileModal";
import JoinServerModal from "@/components/shift/JoinServerModal";
import UserSettingsModal from "@/components/shift/UserSettingsModal";
import ThemeBackground from "@/components/shift/ThemeBackground";
import CallBar from "@/components/shift/CallBar";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import { usePresence } from "@/hooks/usePresence";
import { sounds } from "@/lib/sounds";

// Libellés affichés dans le panneau utilisateur en fonction du statut réel
// (jusqu'ici on affichait toujours "En ligne" en dur, même en absent/DND/invisible).
const OWN_STATUS_LABELS = {
  online: "En ligne",
  idle: "Absent",
  dnd: "Ne pas déranger",
  offline: "Hors ligne"
};

// A member can see a channel if it has no access restriction, if their
// roles intersect allowed_role_ids, if they're individually allowed, or
// if they own the server (owners always see everything).
function isChannelVisible(channel, { isOwner, userId, member }) {
  if (isOwner) return true;
  const roleRestricted = channel.allowed_role_ids && channel.allowed_role_ids.length > 0;
  const userRestricted = channel.allowed_user_ids && channel.allowed_user_ids.length > 0;
  if (!roleRestricted && !userRestricted) return true;
  if (userRestricted && channel.allowed_user_ids.includes(userId)) return true;
  if (roleRestricted && (member?.role_ids || []).some((rid) => channel.allowed_role_ids.includes(rid))) return true;
  return false;
}

export default function ShiftApp() {
  const { user, logout, updateUser } = useContext(ShiftAuthContext);

  // Bascule automatiquement le statut online/offline selon que l'app est
  // au premier plan ou en arrière-plan (tray, minimisée, sans focus).
  usePresence(user, updateUser);
  
  const {
  connected: voiceConnected,
  currentVoiceChannel,
  voiceMembers,
  joinVoice,
  leaveVoice,
  muted: voiceMuted,
  mutedMembers: voiceMutedMembers,
  toggleMute: toggleVoiceMute
} = useVoiceChannel(user);




  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  // 🔥 Cache global des profils (avatar, statut, display_name...), tenu à
  // jour en temps réel. Unique source de vérité pour tout l'app — évite
  // d'avoir plusieurs abonnements Supabase Realtime sur "user_profiles"
  // en même temps (ce qui plante, un seul abonnement par table à la fois).
  const [liveProfiles, setLiveProfiles] = useState({});
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDM, setSelectedDM] = useState(null);
  const [selectedDMUser, setSelectedDMUser] = useState(null);
  const [showFriends, setShowFriends] = useState(true);
  const [showRoles, setShowRoles] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  const [signalingUrl, setSignalingUrlState] = useState(
    () => localStorage.getItem("shift_signaling_url") || "wss://websocketshift.onrender.com"
  );
  const setSignalingUrl = (url) => {
    setSignalingUrlState(url);
    localStorage.setItem("shift_signaling_url", url);
  };
  const [signalingUnlocked, setSignalingUnlocked] = useState(false);
  const unlockSignalingField = () => setSignalingUnlocked(true);
  const call = useVoiceCall(user, signalingUrl);

  // Unique abonnement temps réel aux profils, pour toute l'application.
  useEffect(() => {
    const unsubscribe = db.entities.UserProfile.subscribe(({ type, data }) => {
      if (!data?.user_id) return;
      setLiveProfiles((prev) => {
        if (type === "delete") {
          const next = { ...prev };
          delete next[data.user_id];
          return next;
        }
        return { ...prev, [data.user_id]: { ...prev[data.user_id], ...data } };
      });
    });
    return unsubscribe;
  }, []);

  // Va chercher (une fois) les profils de ces ids et les ajoute au cache.
  const cacheProfiles = async (userIds) => {
    const idsToFetch = [...new Set(userIds)].filter((id) => id && !liveProfiles[id]);
    if (idsToFetch.length === 0) return;
    const profs = await Promise.all(
      idsToFetch.map((uid) => db.entities.UserProfile.filter({ user_id: uid }).then((r) => r[0]))
    );
    const found = {};
    profs.filter(Boolean).forEach((p) => { found[p.user_id] = p; });
    if (Object.keys(found).length > 0) {
      setLiveProfiles((prev) => ({ ...found, ...prev }));
    }
  };

  // Son de notification global : joué pour tout nouveau message envoyé par
  // quelqu'un d'autre, peu importe la conversation/le salon ouvert.
  // (ChatArea a son propre abonnement "Message" pour afficher les messages
  // de la conversation ouverte — grâce au multiplexage dans localDb.js les
  // deux abonnements coexistent sans se marcher dessus.)
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = db.entities.Message.subscribe(({ type, data }) => {
      if (type === "create" && data && data.sender_id !== user.id) {
        sounds.playNotification();
      }
    });
    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    loadServers();
  }, []);

  // Keep the server list (and the currently selected server) in sync with
  // realtime changes made elsewhere (e.g. icon updated from ServerSettingsModal).
  useEffect(() => {
    const unsubscribe = db.entities.Server.subscribe(({ type, data }) => {
      if (type === "update") {
        setServers((prev) => prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)));
        setSelectedServer((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
      } else if (type === "delete") {
        setServers((prev) => prev.filter((s) => s.id !== data.id));
      }
    });
    return unsubscribe;
  }, []);

  // Keep member avatars/status in sync with realtime profile edits (e.g.
  // someone changes their profile picture while you're looking at them).
  // NOTE: handled by MemberList's own subscription — do not add a second
  // subscribe() on "user_profiles" here, Supabase Realtime only allows one
  // per channel and a second one throws.

  useEffect(() => {
    if (selectedServer) {
      loadServerData(selectedServer.id);
    } else {
      setChannels([]);
      setMembers([]);
      setRoles([]);
      setSelectedChannel(null);
    }
  }, [selectedServer]);

  const loadServers = async () => {
    const memberships = await db.entities.ServerMember.filter({ user_id: user.id });
    const serverList = await Promise.all(
      memberships.map((m) => db.entities.Server.get(m.server_id))
    );
    setServers(serverList.filter(Boolean));
  };

  const loadServerData = async (serverId) => {
    const [chans, mems, rls] = await Promise.all([
      db.entities.Channel.filter({ server_id: serverId }),
      db.entities.ServerMember.filter({ server_id: serverId }),
      db.entities.Role.filter({ server_id: serverId })
    ]);
    const sortedChannels = chans.slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    setChannels(sortedChannels);

    setMembers(mems);
    setRoles(rls);
    cacheProfiles(mems.map((m) => m.user_id || m.id));

    const iAmOwner = selectedServer?.owner_id === user.id;
    const myMember = mems.find((m) => (m.user_id || m.id) === user.id);
    const visible = sortedChannels.filter((c) =>
      isChannelVisible(c, { isOwner: iAmOwner, userId: user.id, member: myMember })
    );
    const firstText = visible.find((c) => c.type !== "voice");
    setSelectedChannel(firstText || visible[0] || null);
  };

  const isMemberOwner = selectedServer && user && selectedServer.owner_id === user.id;

  const selectServer = (server) => {
    setSelectedServer(server);
    setSelectedDM(null);
    setSelectedDMUser(null);
    setShowFriends(false);
  };

  const goHome = () => {
    setSelectedServer(null);
    setSelectedDM(null);
    setSelectedDMUser(null);
    setShowFriends(true);
  };

  const handleSelectDM = (conv, otherUser) => {
    setSelectedServer(null);
    setSelectedDM(conv);
    setSelectedDMUser(otherUser);
    setShowFriends(false);
    cacheProfiles(conv?.participants || []);
  };

  const handleOpenDM = async (profile) => {
    if (!profile?.user_id) return;
    const existing = await db.entities.DMConversation.filter({});
    let conv = existing.find(
      (c) =>
        (c.participants?.length || 0) === 2 &&
        c.participants?.includes(user.id) &&
        c.participants?.includes(profile.user_id)
    );
    if (!conv) {
      conv = await db.entities.DMConversation.create({
        participants: [user.id, profile.user_id],
        participant_names: [user.display_name || user.username, profile.display_name || profile.username]
      });
      conv = { ...conv, id: conv.id || `dm-${Date.now()}`, participants: [user.id, profile.user_id] };
    }
    handleSelectDM(conv, profile);
  };

  const handleCreateChannel = async (type, category = null) => {
    if (!selectedServer) return;
    const name = type === "voice" ? "vocal" : "nouveau-canal";
    await db.entities.Channel.create({
      server_id: selectedServer.id,
      name,
      type,
      category: category || null,
      position: channels.length
    });
    loadServerData(selectedServer.id);
  };

  const handleRenameChannel = async (channelId, newName) => {
    const name = (newName || "").trim();
    if (!name) return;
    await db.entities.Channel.update(channelId, { name });
    loadServerData(selectedServer.id);
  };

  const handleDeleteChannel = async (channelId) => {
    await db.entities.Channel.delete(channelId);
    if (selectedChannel?.id === channelId) setSelectedChannel(null);
    loadServerData(selectedServer.id);
  };

  const handleMoveChannelCategory = async (channelId, category) => {
    await db.entities.Channel.update(channelId, { category: category || null });
    loadServerData(selectedServer.id);
  };

  const handleUpdateChannelAccess = async (channelId, access) => {
    // access = { allowed_role_ids: [...] | null, allowed_user_ids: [...] | null }
    // null/empty on both means the channel is visible to everyone (default).
    await db.entities.Channel.update(channelId, access);
    loadServerData(selectedServer.id);
  };

  // Categories that currently exist in this server (derived from channels)
  const categories = [...new Set(channels.map((c) => c.category).filter(Boolean))];

  // Members merged with the live profile cache — always up to date,
  // recomputed on every render, no extra subscription needed.
  const liveMembers = members.map((m) => ({
    ...m,
    ...(liveProfiles[m.user_id || m.id] || {})
  }));

  const myMembership = members.find((m) => (m.user_id || m.id) === user?.id);
  const myPermissions = computePermissions(myMembership, roles, isMemberOwner);
  const visibleChannels = channels.filter((c) =>
    isChannelVisible(c, { isOwner: isMemberOwner, userId: user?.id, member: myMembership })
  );

  const handleKickMember = async (memberUserId) => {
    const target = members.find((m) => (m.user_id || m.id) === memberUserId);
    if (target) await db.entities.ServerMember.delete(target.id);
    loadServerData(selectedServer.id);
  };

  const handleDeleteServer = async () => {
    if (!selectedServer) return;
    await db.entities.Server.delete(selectedServer.id);
    setServers((prev) => prev.filter((s) => s.id !== selectedServer.id));
    goHome();
  };

  const handleLeaveServer = async () => {
    if (!selectedServer) return;
    // Owners can only reach this via ServerSettingsModal, and only after
    // successfully transferring ownership (see handleTransferAndLeave there).
    const mine = members.find((m) => m.user_id === user.id);
    if (mine) await db.entities.ServerMember.delete(mine.id);
    setServers((prev) => prev.filter((s) => s.id !== selectedServer.id));
    goHome();
  };

  const handleOwnershipTransferred = (newOwnerId) => {
    setSelectedServer((prev) => (prev ? { ...prev, owner_id: newOwnerId } : prev));
  };

  const handleCreateGroup = async (friendProfiles, groupName) => {
    const participantIds = [user.id, ...friendProfiles.map((p) => p.user_id)];
    const participantNames = [
      user.display_name || user.username,
      ...friendProfiles.map((p) => p.display_name || p.username)
    ];
    const conv = await db.entities.DMConversation.create({
      participants: participantIds,
      participant_names: participantNames,
      is_group: true,
      name: groupName || null
    });
    setShowNewGroup(false);
    handleSelectDM(conv, null);
  };

  const handleAddFriend = async (targetUserId, targetUsername) => {
    const created = await db.entities.Friendship.create({
      requester_id: user.id,
      receiver_id: targetUserId,
      requester_username: user.username,
      receiver_username: targetUsername,
      status: "pending"
    });
    return { ...created, requester_id: user.id, receiver_id: targetUserId, status: "pending" };
  };

  return (
    <div className="h-screen w-screen flex bg-[var(--bg-tertiary)] overflow-hidden relative">
      <ThemeBackground />
      <div className="relative z-10 flex w-full h-full">
      <CallBar call={call} />

      {/* Server rail */}
      <div className="w-[72px] bg-[var(--bg-tertiary)] flex-shrink-0 flex flex-col items-center py-3 gap-2 overflow-y-auto">
        <button
          onClick={goHome}
          title="Accueil"
          className={`w-12 h-12 flex items-center justify-center transition-all ${
            !selectedServer ? "rounded-2xl bg-[#5865f2] text-white" : "rounded-3xl bg-[var(--bg-primary)] text-[var(--text-normal)] hover:bg-[#5865f2] hover:rounded-2xl hover:text-white"
          }`}
        >
          <Home className="w-6 h-6" />
        </button>

        <div className="w-8 h-[2px] bg-[var(--bg-modifier-hover)] rounded-full" />

        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => selectServer(server)}
            title={server.name}
            className={`w-12 h-12 flex items-center justify-center font-bold text-white transition-all overflow-hidden ${
              selectedServer?.id === server.id
                ? "rounded-2xl bg-[#5865f2]"
                : "rounded-3xl bg-[var(--bg-primary)] hover:bg-[#5865f2] hover:rounded-2xl"
            }`}
          >
            {server.icon ? (
              <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
            ) : (
              server.name?.charAt(0).toUpperCase()
            )}
          </button>
        ))}

        <button
          onClick={() => setShowJoinModal(true)}
          title="Ajouter un serveur"
          className="w-12 h-12 rounded-3xl bg-[var(--bg-primary)] hover:bg-[#23a559] hover:rounded-2xl text-[#23a559] hover:text-white flex items-center justify-center transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Secondary sidebar: DM list or server channels */}
      {selectedServer ? (
<ServerSidebar
  server={selectedServer}
  channels={visibleChannels}
  categories={categories}
  selectedChannel={selectedChannel}
  onSelectChannel={setSelectedChannel}
  currentUser={user}
  members={liveMembers}
  roles={roles}
  isMemberOwner={isMemberOwner}
  permissions={myPermissions}
  onOpenSettings={() => setShowServerSettings(true)}
  onCreateChannel={handleCreateChannel}
  onRenameChannel={handleRenameChannel}
  onDeleteChannel={handleDeleteChannel}
  onMoveChannelCategory={handleMoveChannelCategory}
  onUpdateChannelAccess={handleUpdateChannelAccess}
  joinVoice={(channelId) => {
    if (call.callState !== "idle") call.endCall();
    joinVoice(channelId);
  }}
  leaveVoice={leaveVoice}
  voiceMembers={voiceMembers}
  currentVoiceChannel={currentVoiceChannel}
  voiceConnected={voiceConnected}
 />

      ) : (
        <div className="w-60 bg-[var(--bg-secondary)] flex-shrink-0 flex flex-col">
          <div className="h-12 border-b border-[var(--bg-tertiary)] flex items-center justify-between px-4">
            <span className="text-white font-bold text-sm">Messages directs</span>
            <button
              onClick={() => setShowNewGroup(true)}
              title="Nouveau groupe"
              className="text-[var(--text-secondary)] hover:text-white transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <DMSidebar
            currentUser={user}
            selectedDM={selectedDM}
            onSelectDM={handleSelectDM}
            onSelectFriends={() => {
              setShowFriends(true);
              setSelectedDM(null);
              setSelectedDMUser(null);
            }}
            liveProfiles={liveProfiles}
          />
        </div>
      )}

      {/* Main content */}
      {selectedServer ? (
        <>
          <ChatArea
          channel={selectedChannel}
          currentUser={user}
          isDM={false}
          serverRoles={roles}
          serverMembers={liveMembers}
          liveProfiles={liveProfiles}
          showMemberList={showMemberList}
          onToggleMemberList={() => setShowMemberList((v) => !v)}
          onSecretCode={unlockSignalingField}
          voiceMembers={voiceMembers}
          currentVoiceChannel={currentVoiceChannel}
          joinVoice={(channelId) => {
            if (call.callState !== "idle") call.endCall();
            joinVoice(channelId);
          }}
          leaveVoice={leaveVoice}
          muted={voiceMuted}
          mutedMembers={voiceMutedMembers}
          toggleMute={toggleVoiceMute}
          onOpenDM={handleOpenDM}
          onAddFriend={handleAddFriend}
/>
          {showMemberList && (
            <MemberList members={liveMembers} roles={roles} currentUser={user} onOpenDM={handleOpenDM} onAddFriend={handleAddFriend} liveProfiles={liveProfiles} canKickMembers={myPermissions.canKickMembers} onKickMember={handleKickMember} serverOwnerId={selectedServer?.owner_id} />
          )}
        </>
      ) : showFriends ? (
        <FriendsPanel currentUser={user} onOpenDM={handleOpenDM} onAddFriend={handleAddFriend} liveProfiles={liveProfiles} />
      ) : (
        <ChatArea
          dmConversation={selectedDM}
          currentUser={user}
          isDM={true}
          onStartCall={
            selectedDM && (selectedDM.participants?.length || 0) === 2
              ? () => call.startCall(selectedDM.participants.find((p) => p !== user.id))
              : null
          }
          callState={call.callState}
          onSecretCode={unlockSignalingField}
          onOpenDM={handleOpenDM}
          onAddFriend={handleAddFriend}
          liveProfiles={liveProfiles}
        />
      )}

      {/* Bottom-left user bar */}
      <div className="fixed bottom-0 left-0 w-[calc(72px+15rem)] max-w-[312px] flex items-center gap-2 bg-[var(--bg-floating)] px-2 py-2">
        <UserAvatar user={user} size={32} showStatus />
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{user?.display_name || user?.username}</p>
          <p className="text-[var(--text-secondary)] text-[10px] truncate">
            {user?.custom_status || OWN_STATUS_LABELS[user?.status || "online"]}
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          title="Paramètres utilisateur"
          className="text-[var(--text-secondary)] hover:text-white transition p-1.5"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={logout}
          title="Se déconnecter"
          className="text-[var(--text-secondary)] hover:text-[#ed4245] transition p-1.5"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {showRoles && selectedServer && (
        <RolesModal
          server={selectedServer}
          members={members}
          onClose={() => setShowRoles(false)}
          onUpdate={() => loadServerData(selectedServer.id)}
        />
      )}

      {showServerSettings && selectedServer && (
        <ServerSettingsModal
          server={selectedServer}
          members={members}
          roles={roles}
          channels={channels}
          categories={categories}
          currentUser={user}
          isMemberOwner={isMemberOwner}
          permissions={myPermissions}
          onClose={() => setShowServerSettings(false)}
          onManageRoles={() => setShowRoles(true)}
          onDeleteServer={() => { setShowServerSettings(false); handleDeleteServer(); }}
          onLeaveServer={() => { setShowServerSettings(false); handleLeaveServer(); }}
          onOwnershipTransferred={handleOwnershipTransferred}
          onCreateChannel={handleCreateChannel}
          onRenameChannel={handleRenameChannel}
          onDeleteChannel={handleDeleteChannel}
          onMoveChannelCategory={handleMoveChannelCategory}
          onUpdateChannelAccess={handleUpdateChannelAccess}
        />
      )}

      {showJoinModal && (
        <JoinServerModal
          currentUser={user}
          onClose={() => setShowJoinModal(false)}
          onJoined={(server) => {
            setServers((prev) => [...prev, server]);
            selectServer(server);
          }}
        />
      )}

      {showSettings && (
        <UserSettingsModal
          currentUser={user}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => updateUser(updated)}
          onLogout={logout}
          signalingUrl={signalingUrl}
          onSaveSignalingUrl={signalingUnlocked ? setSignalingUrl : undefined}
          signalingConnected={call.socketReady}
        />
      )}

      {showNewGroup && (
        <NewGroupModal
          currentUser={user}
          onClose={() => setShowNewGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {profileUser && (
        <UserProfileModal
          userId={profileUser.user_id || profileUser.id}
          username={profileUser.username}
          currentUserId={user?.id}
          onClose={() => setProfileUser(null)}
          onOpenDM={handleOpenDM}
          onAddFriend={handleAddFriend}
          liveProfiles={liveProfiles}
        />
      )}
      </div>
    </div>
  );
}