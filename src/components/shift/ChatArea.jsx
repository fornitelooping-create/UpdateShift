import { db } from '@/lib/localDb';

import React, { useState, useEffect, useRef } from "react";

import { Send, Hash, Paperclip, X, FileText, Download, Loader2, Pencil, Trash2, Check, Smile, Users, Phone, Volume2, PhoneOff, Mic, MicOff } from "lucide-react";
import UserAvatar from "./UserAvatar";
import UserProfileModal from "./UserProfileModal";
import MediaPreview from "./MediaPreview";
import moment from "moment";
import "moment/locale/fr";
moment.locale("fr");

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];
const COMPOSER_EMOJIS = [
  "😀", "😂", "😍", "😊", "😉", "😎", "🤔", "😢", "😡", "😱",
  "👍", "👎", "👏", "🙏", "💪", "🔥", "🎉", "❤️", "💯", "✨"
];

export default function ChatArea({
  channel,
  dmConversation,
  currentUser,
  isDM,
  serverRoles,
  serverMembers,
  showMemberList,
  onToggleMemberList,
  onStartCall,
  callState,
  onSecretCode,
  onOpenDM,
  onAddFriend,
  liveProfiles,

  // 🔥 Vocal
  voiceMembers,
  currentVoiceChannel,
  joinVoice,
  leaveVoice,
  muted,
  mutedMembers,
  toggleMute
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null); // { url, fileName, fileType }
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const contextId = isDM ? dmConversation?.id : channel?.id;

  useEffect(() => {
    if (!contextId) return;
    loadMessages();
    const unsub = db.entities.Message.subscribe((event) => {
      if (event.type === "create" && event.data) {
        const msg = event.data;
        const matches = isDM
          ? msg.dm_conversation_id === contextId
          : msg.channel_id === contextId;
        if (matches) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      } else if (event.type === "update" && event.data) {
        setMessages((prev) => prev.map((m) => (m.id === event.data.id ? event.data : m)));
      } else if (event.type === "delete" && event.data?.id) {
        setMessages((prev) => prev.filter((m) => m.id !== event.data.id));
      }
    });
    return () => unsub?.();
  }, [contextId, isDM]);

  // Scroll instantané vers le bas — utilisé au chargement / changement de conversation
  const scrollToBottomInstant = () => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    // Quand on change de conversation, on remet à zéro puis charge
    setMessages([]);
  }, [contextId]);

  useEffect(() => {
    if (messages.length > 0) {
      // requestAnimationFrame assure que le DOM a fini de peindre les messages
      requestAnimationFrame(() => requestAnimationFrame(scrollToBottomInstant));
    }
  }, [messages]);

  const loadMessages = async () => {
    const query = isDM ? { dm_conversation_id: contextId } : { channel_id: contextId };
    const msgs = await db.entities.Message.filter(query);
    setMessages(
      msgs.slice().sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0))
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
  };

  const clearPendingFile = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !pendingFile) return;
    if (!contextId) return;

    if (input.trim() === "080898" && !pendingFile) {
      onSecretCode?.();
      setInput("");
      return;
    }

    setSending(true);
    try {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;

      if (pendingFile) {
        const uploaded = await db.integrations.Core.UploadFile({ file: pendingFile });
        fileUrl = uploaded?.file_url || "";
        fileName = pendingFile.name;
        fileType = pendingFile.type;
      }

      const messageData = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        channel_id: isDM ? undefined : contextId,
        dm_conversation_id: isDM ? contextId : undefined,
        sender_id: currentUser.id,
        sender_name: currentUser.display_name || currentUser.username,
        sender_avatar: currentUser.avatar || null,
        content: input.trim(),
        type: isDM ? "dm" : "channel",
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        created_date: new Date().toISOString()
      };

      await db.entities.Message.create(messageData);
      setInput("");
      clearPendingFile();
    } finally {
      setSending(false);
    }
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditValue(msg.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (msg) => {
    const content = editValue.trim();
    if (!content) return;
    await db.entities.Message.update(msg.id, { content });
    cancelEdit();
  };

  const deleteMessage = async (msg) => {
    await db.entities.Message.delete(msg.id);
  };

  const toggleReaction = async (msg, emoji) => {
    const reactions = { ...(msg.reactions || {}) };
    const users = new Set(reactions[emoji] || []);
    if (users.has(currentUser.id)) {
      users.delete(currentUser.id);
    } else {
      users.add(currentUser.id);
    }
    if (users.size === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = [...users];
    }
    await db.entities.Message.update(msg.id, { reactions });
    setReactionPickerFor(null);
  };

  const insertEmoji = (emoji) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const dmTitle = () => {
    if (!dmConversation) return "Message privé";
    if (dmConversation.name) return dmConversation.name; // custom group name
    const otherNames = (dmConversation.participant_names || []).filter(
      (n) => n && n !== (currentUser.display_name || currentUser.username)
    );
    if (otherNames.length > 0) return otherNames.join(", ");
    return "Message privé";
  };

  const title = isDM ? dmTitle() : channel?.name || "canal";
  const isGroupDM = isDM && (dmConversation?.participants?.length || 0) > 2;

  // -----------------------------------------------------------
  // VOICE CHANNEL — dédié, aucun chat texte ici
  // -----------------------------------------------------------
  if (!isDM && channel?.type === "voice") {
    const isJoined = currentVoiceChannel === channel.id;
    const membersHere = voiceMembers?.[channel.id] || [];

    return (
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)] min-w-0 min-h-0">
        <div className="h-12 border-b border-[var(--bg-tertiary)] flex items-center gap-2 px-4 flex-shrink-0">
          <Volume2 className="w-5 h-5 text-[var(--text-muted-alt)] flex-shrink-0" />
          <span className="text-white font-semibold text-sm truncate">{title}</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
              <Volume2 className="w-9 h-9 text-[var(--text-muted-alt)]" />
            </div>
            <p className="text-white font-semibold">{title}</p>
            <p className="text-[var(--text-muted-alt)] text-sm">
              {membersHere.length > 0
                ? `${membersHere.length} connecté${membersHere.length > 1 ? "s" : ""}`
                : "Personne n'est connecté pour l'instant"}
            </p>
          </div>

          {membersHere.length > 0 && (
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {membersHere.map((memberId) => {
                const member = serverMembers?.find((m) => (m.user_id || m.id) === memberId);
                const name = member?.display_name || member?.username || "Utilisateur";
                const isMuted = memberId === currentUser?.id ? muted : !!mutedMembers?.[memberId];
                return (
                  <div
                    key={memberId}
                    className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-lg px-3 py-2"
                  >
                    <UserAvatar user={member} size={28} showStatus muted={isMuted} />
                    <span className="text-sm text-[var(--text-normal)] truncate">
                      {name}
                      {memberId === currentUser?.id && " (toi)"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => (isJoined ? leaveVoice?.() : joinVoice?.(channel.id))}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition ${
                isJoined
                  ? "bg-[#ed4245] hover:bg-[#c73033] text-white"
                  : "bg-[#23a559] hover:bg-[#1e8e4d] text-white"
              }`}
            >
              {isJoined ? (
                <>
                  <PhoneOff className="w-4 h-4" /> Quitter le vocal
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" /> Rejoindre le vocal
                </>
              )}
            </button>

            {isJoined && (
              <button
                onClick={() => toggleMute?.()}
                title={muted ? "Réactiver le micro" : "Couper le micro"}
                className={`p-2.5 rounded-lg transition ${
                  muted
                    ? "bg-[#ed4245] text-white"
                    : "bg-[var(--bg-secondary)] text-[var(--text-normal)] hover:bg-[var(--bg-modifier-hover)]"
                }`}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] min-w-0 min-h-0">
      {/* Header */}
      <div className="h-12 border-b border-[var(--bg-tertiary)] flex items-center justify-between gap-2 px-4 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {!isDM && <Hash className="w-5 h-5 text-[var(--text-muted-alt)] flex-shrink-0" />}
          {isGroupDM && <Users className="w-5 h-5 text-[var(--text-muted-alt)] flex-shrink-0" />}
          <span className="text-white font-semibold text-sm truncate">{title}</span>
        </div>
        {!isDM && onToggleMemberList && (
          <button
            onClick={onToggleMemberList}
            title={showMemberList ? "Masquer la liste des membres" : "Afficher la liste des membres"}
            className={`p-1.5 rounded transition ${showMemberList ? "text-white bg-[var(--bg-input)]" : "text-[var(--text-muted-alt)] hover:text-white"}`}
          >
            <Users className="w-5 h-5" />
          </button>
        )}
        {isDM && onStartCall && (
          <button
            onClick={onStartCall}
            disabled={callState && callState !== "idle"}
            title="Appel vocal"
            className="p-1.5 rounded text-[var(--text-muted-alt)] hover:text-white hover:bg-[var(--bg-input)] disabled:opacity-40 transition"
          >
            <Phone className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="chat-scrollbar flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm italic text-center mt-10">
            {isDM
              ? "C'est le début de votre conversation."
              : `Bienvenue dans #${channel?.name || "canal"} ! C'est le début de ce canal.`}
          </p>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUser.id;
          const isEditing = editingId === msg.id;
          const isImage = msg.file_type?.startsWith("image/");
          const isVideo = msg.file_type?.startsWith("video/");

          return (
            <div key={msg.id} className="flex items-start gap-3 group px-1 py-1 rounded-lg hover:bg-black/10">
              <button onClick={() => setSelectedUser({ user_id: msg.sender_id, username: msg.sender_name })}>
                <UserAvatar
                  user={
                    liveProfiles?.[msg.sender_id] || { username: msg.sender_name, avatar: msg.sender_avatar }
                  }
                  size={40}
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-medium text-sm">{msg.sender_name}</span>
                  <span className="text-[var(--text-muted)] text-xs">
                    {msg.created_date ? moment(msg.created_date).format("DD MMM, HH:mm") : ""}
                  </span>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(msg);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1 bg-[var(--bg-tertiary)] text-white px-3 py-1.5 rounded-lg text-sm outline-none border border-[#5865f2]"
                    />
                    <button onClick={() => saveEdit(msg)} className="text-[#23a559] hover:text-white transition">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="text-[var(--text-muted)] hover:text-white transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    {msg.content && (
                      <p className="selectable-text text-[var(--text-normal)] text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    {msg.file_url && (isImage || isVideo) && (
                      <button
                        onClick={() =>
                          setMediaPreview({ url: msg.file_url, fileName: msg.file_name, fileType: msg.file_type })
                        }
                        className="mt-1 block"
                      >
                        {isImage ? (
                          <img
                            src={msg.file_url}
                            alt={msg.file_name}
                            className="max-w-xs max-h-64 rounded-lg object-cover"
                          />
                        ) : (
                          <video src={msg.file_url} className="max-w-xs max-h-64 rounded-lg" />
                        )}
                      </button>
                    )}
                    {msg.file_url && !isImage && !isVideo && (
                      <a
                        href={msg.file_url}
                        download={msg.file_name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-floating)] px-3 py-2 rounded-lg text-sm text-[var(--text-normal)] transition"
                      >
                        <FileText className="w-4 h-4" />
                        {msg.file_name}
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                          const mine = userIds.includes(currentUser.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg, emoji)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
                                mine
                                  ? "bg-[#5865f2]/20 border-[#5865f2] text-[#c9cdfb]"
                                  : "bg-[var(--bg-secondary)] border-transparent text-[var(--text-normal)] hover:border-[#4e5058]"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{userIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="relative opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
                    className="text-[var(--text-muted)] hover:text-white transition p-1"
                    title="Ajouter une réaction"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  {isOwn && (
                    <>
                      <button onClick={() => startEdit(msg)} className="text-[var(--text-muted)] hover:text-white transition p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMessage(msg)} className="text-[var(--text-muted)] hover:text-[#ed4245] transition p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {reactionPickerFor === msg.id && (
                    <div className="absolute right-0 top-full mt-1 bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-lg shadow-xl p-1.5 flex gap-1 z-10">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg, emoji)}
                          className="text-lg hover:scale-125 transition-transform px-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        {pendingFile && (
          <div className="flex items-center gap-2 bg-[var(--border-default)] rounded-lg px-3 py-2 mb-2 text-sm text-[var(--text-normal)]">
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1">{pendingFile.name}</span>
            <button onClick={clearPendingFile} className="text-[var(--text-muted)] hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <form onSubmit={sendMessage} className="flex items-center gap-2 bg-[var(--border-default)] rounded-lg px-3 py-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[var(--text-secondary)] hover:text-white transition flex-shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="text-[var(--text-secondary)] hover:text-white transition"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-lg shadow-xl p-2 grid grid-cols-5 gap-1 z-10 w-52">
                {COMPOSER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="text-lg hover:bg-[var(--bg-modifier-hover)] rounded p-1 transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isDM ? `Message @${title}` : `Envoyer un message dans #${channel?.name || ""}`}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            type="submit"
            disabled={sending || (!input.trim() && !pendingFile)}
            className="text-[var(--text-secondary)] hover:text-white disabled:opacity-40 transition flex-shrink-0"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>

      {selectedUser && (
        <UserProfileModal
          userId={selectedUser.user_id}
          username={selectedUser.username}
          currentUserId={currentUser?.id}
          roles={serverRoles}
          memberRoleIds={serverMembers?.find((m) => (m.user_id || m.id) === selectedUser.user_id)?.role_ids}
          onClose={() => setSelectedUser(null)}
          onOpenDM={(profile) => {
            setSelectedUser(null);
            onOpenDM?.(profile);
          }}
          onAddFriend={onAddFriend}
          liveProfiles={liveProfiles}
        />
      )}

      {mediaPreview && (
        <MediaPreview
          url={mediaPreview.url}
          fileName={mediaPreview.fileName}
          fileType={mediaPreview.fileType}
          onClose={() => setMediaPreview(null)}
        />
      )}
    </div>
  );
}