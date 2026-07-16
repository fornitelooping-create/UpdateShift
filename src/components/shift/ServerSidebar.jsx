import React, { useState } from "react";
import {
  Hash,
  Plus,
  ChevronDown,
  ChevronRight,
  Volume2,
  Settings,
  Lock,
  PencilLine,
  Trash2
} from "lucide-react";

import ContextMenu from "./ContextMenu";
import ChannelSettingsModal from "./ChannelSettingsModal";
import UserAvatar from "@/components/shift/UserAvatar";

export default function ServerSidebar({
  server,
  channels,
  categories,
  selectedChannel,
  onSelectChannel,
  currentUser,
  members,
  roles,
  isMemberOwner,
  permissions,
  onOpenSettings,
  onCreateChannel,
  onRenameChannel,
  onDeleteChannel,
  onMoveChannelCategory,
  onUpdateChannelAccess,

  // 🔥 Nouveau système vocal
  joinVoice,
  leaveVoice,
  voiceMembers,
  currentVoiceChannel,
  voiceConnected
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [settingsChannelId, setSettingsChannelId] = useState(null);
  const [settingsTab, setSettingsTab] = useState("overview");
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState(null);

  const canManageChannels = permissions?.canManageChannels ?? isMemberOwner;

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const openChannelContextMenu = (e, channel) => {
    if (!canManageChannels) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, channel });
  };

  const openChannelSettings = (channel, tab = "overview") => {
    setSettingsChannelId(channel.id);
    setSettingsTab(tab);
  };

  const settingsChannel = channels.find((c) => c.id === settingsChannelId) || null;

  const uncategorized = channels.filter((c) => !c.category);
  const categoryGroups = categories.map((cat) => ({
    name: cat,
    channels: channels.filter((c) => c.category === cat)
  }));

  const renderChannelGroup = (list) => {
    const text = list.filter((c) => c.type !== "voice");
    const voice = list.filter((c) => c.type === "voice");

    return (
      <>
        {text.map((ch) => (
          <ChannelRow
            key={ch.id}
            channel={ch}
            selected={selectedChannel?.id === ch.id}
            onClick={() => onSelectChannel(ch)}
            onContextMenu={(e) => openChannelContextMenu(e, ch)}
          />
        ))}

        {voice.map((ch) => (
          <VoiceChannelRow
            key={ch.id}
            channel={ch}
            currentUser={currentUser}
            members={members}
            voiceMembers={voiceMembers}
            currentVoiceChannel={currentVoiceChannel}
            joinVoice={joinVoice}
            leaveVoice={leaveVoice}
            onContextMenu={(e) => openChannelContextMenu(e, ch)}
  	    onSelectChannel={onSelectChannel}
          />
        ))}
      </>
    );
  };

  return (
    <div className="w-60 bg-[var(--bg-secondary)] flex-shrink-0 flex flex-col">
      {/* Header */}
      <div
        className="h-12 border-b border-[var(--bg-tertiary)] flex items-center justify-between px-4 cursor-pointer hover:bg-[var(--bg-modifier-hover)] transition group relative"
        onClick={() => setShowMenu(!showMenu)}
      >
        <span className="text-white font-bold text-sm truncate">{server?.name}</span>
        <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-white transition" />

        {showMenu && (
          <div
            className="absolute top-12 left-0 right-0 bg-[var(--bg-deepest)] rounded-lg shadow-2xl z-40 overflow-hidden py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onOpenSettings?.();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[var(--text-secondary)] hover:text-white hover:bg-[#5865f2] transition text-sm"
            >
              <Settings className="w-4 h-4" />
              Paramètres
            </button>
          </div>
        )}
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-2" onClick={() => showMenu && setShowMenu(false)}>
        {uncategorized.length > 0 && (
          <div className="mb-2">{renderChannelGroup(uncategorized)}</div>
        )}

        {categoryGroups.map(({ name, channels: catChannels }) => (
          <div key={name} className="mb-2">
            <div
              className="flex items-center justify-between px-3 py-1 cursor-pointer group"
              onClick={() => toggleCategory(name)}
            >
              <div className="flex items-center gap-1 text-[var(--text-muted)] group-hover:text-[var(--text-normal)] transition">
                {collapsedCategories[name] ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wide">{name}</span>
              </div>

              {canManageChannels && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateChannel?.("text", name);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-white transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {!collapsedCategories[name] && renderChannelGroup(catChannels)}
          </div>
        ))}

        {canManageChannels && (
          <div className="flex gap-2 px-2 mt-2">
            <button
              onClick={() => onCreateChannel?.("text")}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-modifier-hover)] py-1.5 rounded transition"
            >
              <Hash className="w-3.5 h-3.5" /> Salon texte
            </button>

            <button
              onClick={() => onCreateChannel?.("voice")}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-modifier-hover)] py-1.5 rounded transition"
            >
              <Volume2 className="w-3.5 h-3.5" /> Salon vocal
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Créer un salon ici",
              icon: Plus,
              onClick: () =>
                onCreateChannel?.("text", contextMenu.channel.category || null)
            },
            {
              label: "Paramètres du salon",
              icon: PencilLine,
              onClick: () => openChannelSettings(contextMenu.channel, "overview")
            },
            {
              label: "Gérer les accès",
              icon: Lock,
              onClick: () => openChannelSettings(contextMenu.channel, "access")
            },
            null,
            {
              label: "Supprimer le salon",
              icon: Trash2,
              danger: true,
              onClick: () => setConfirmDeleteChannel(contextMenu.channel)
            }
          ]}
        />
      )}

      {settingsChannel && (
        <ChannelSettingsModal
          channel={settingsChannel}
          categories={categories}
          roles={roles}
          members={members}
          initialTab={settingsTab}
          onClose={() => setSettingsChannelId(null)}
          onRename={(name) => onRenameChannel?.(settingsChannel.id, name)}
          onDelete={() => onDeleteChannel?.(settingsChannel.id)}
          onMoveCategory={(cat) => onMoveChannelCategory?.(settingsChannel.id, cat)}
          onUpdateAccess={(access) => onUpdateChannelAccess?.(settingsChannel.id, access)}
        />
      )}

      {confirmDeleteChannel && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={() => setConfirmDeleteChannel(null)}
        >
          <div
            className="bg-[var(--bg-primary)] rounded-xl p-6 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-lg mb-2">Supprimer le salon</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-5">
              Es-tu sûr de vouloir supprimer{" "}
              <strong className="text-white">#{confirmDeleteChannel.name}</strong> ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteChannel(null)}
                className="flex-1 bg-[var(--border-default)] hover:bg-[var(--bg-modifier-hover-strong)] text-white py-2.5 rounded-lg text-sm font-medium transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onDeleteChannel?.(confirmDeleteChannel.id);
                  setConfirmDeleteChannel(null);
                }}
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

/* 🔥 Salon texte */
function ChannelRow({ channel, selected, onClick, onContextMenu }) {
  const isRestricted =
    (channel.allowed_role_ids && channel.allowed_role_ids.length > 0) ||
    (channel.allowed_user_ids && channel.allowed_user_ids.length > 0);

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-sm ${
        selected
          ? "bg-[var(--bg-input)] text-white"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]"
      }`}
    >
      <Hash className="w-4 h-4 flex-shrink-0" />
      <span className="truncate flex-1 text-left">{channel.name}</span>
      {isRestricted && <Lock className="w-3 h-3 flex-shrink-0 opacity-60" />}
    </button>
  );
}

/* 🔥 Salon vocal */
function VoiceChannelRow({
  channel,
  currentUser,
  members,
  voiceMembers,
  currentVoiceChannel,
  joinVoice,
  leaveVoice,
  onContextMenu,
  onSelectChannel
}) {
  const membersInChannel = voiceMembers[channel.id] || [];
  const iAmConnectedHere = currentVoiceChannel === channel.id;
  const hasAnyoneConnected = membersInChannel.length > 0;

  const handleJoin = () => {
    onSelectChannel(channel);
    if (!iAmConnectedHere) joinVoice(channel.id);
    // Si déjà connecté : on sélectionne juste le canal pour afficher la page de contrôle
  };

  const isRestricted =
    (channel.allowed_role_ids && channel.allowed_role_ids.length > 0) ||
    (channel.allowed_user_ids && channel.allowed_user_ids.length > 0);

  return (
    <div className="mx-1 mb-0.5">
      <button
        onClick={handleJoin}
        onContextMenu={onContextMenu}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition text-sm ${
          iAmConnectedHere
            ? "bg-[#23a559]/20 text-[#23a559]"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-normal)]"
        }`}
      >
        <Volume2 className="w-4 h-4 flex-shrink-0" />
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {isRestricted && <Lock className="w-3 h-3 flex-shrink-0 opacity-60" />}
        {iAmConnectedHere && (
          <span className="text-xs bg-[#23a559] text-white px-1.5 py-0.5 rounded">
            Connecté
          </span>
        )}
      </button>

      {hasAnyoneConnected && (
        <div className="ml-4 mt-0.5 px-2 py-1.5 bg-[var(--bg-tertiary)] rounded-lg">
          {membersInChannel.map((memberId) => {
            const member = members.find((m) => m.user_id === memberId);
            const name =
              member?.display_name || member?.username || "Utilisateur";
            const isMe = memberId === currentUser?.id;

            return (
              <div key={memberId} className="flex items-center gap-1.5 mb-1">
                <UserAvatar user={member} size={24} showStatus />
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  {name}
                  {isMe && " (toi)"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}