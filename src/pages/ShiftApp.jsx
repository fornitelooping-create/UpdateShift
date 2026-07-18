import { useVoiceChannel } from "../hooks/useVoiceChannel";

import { db } from '@/lib/localDb';
import { computePermissions } from "@/lib/permissions";

import React, { useState, useEffect, useContext, useRef } from "react";

import { ShiftAuthContext } from "@/lib/useShiftAuth";
import { Plus, Settings, Home, LogOut, ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
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

  // --- Navigation mobile façon Discord (la vraie, à l'ancienne) : 3
  // panneaux qu'on parcourt en swipe horizontal, comme un carrousel :
  //   page 0 = rail des serveurs + liste des salons/DM
  //   page 1 = conversation (salon, DM ou liste d'amis)
  //   page 2 = liste des membres (pertinent uniquement dans un salon)
  // Sur desktop (isMobile === false), rien de tout ça n'est monté : le
  // layout desktop est rendu séparément, strictement inchangé.
  const isMobile = useIsMobile();
  const [mobilePage, setMobilePageState] = useState(0);
  const mobilePageRef = useRef(0);
  const mobileTrackRef = useRef(null);
  const mobileWrapRef = useRef(null);
  // Trace globale de mes adhésions (id d'adhésion -> id de serveur),
  // utilisée par la souscription temps réel ci-dessous (qui ne doit tourner
  // qu'une fois, indépendamment du serveur sélectionné) pour détecter une
  // expulsion même si on ne regarde pas ce serveur au moment où ça arrive.
  const myMembershipsRef = useRef(new Map());

  const selectedServerRef = useRef(null);

  const MOBILE_MAX_PAGE = () => (selectedServerRef.current ? 2 : 1);

  const setMobilePage = (updater) => {
    setMobilePageState((prev) => {
      const raw = typeof updater === "function" ? updater(prev) : updater;
      const clamped = Math.max(0, Math.min(MOBILE_MAX_PAGE(), raw));
      mobilePageRef.current = clamped;
      return clamped;
    });
  };

  // Anime la piste vers la page demandée (utilisé aussi bien par les boutons
  // retour que par la fin d'un geste de swipe).
  const goToMobilePage = (index) => {
    setMobilePage(index);
    const track = mobileTrackRef.current;
    const wrap = mobileWrapRef.current;
    if (track && wrap) {
      const w = wrap.clientWidth || window.innerWidth;
      track.style.transition = "transform 0.28s cubic-bezier(0.22,1,0.36,1)";
      track.style.transform = `translateX(${-mobilePageRef.current * w}px)`;
    }
  };

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

  // Keep the member list in sync in realtime: quand quelqu'un rejoint le
  // serveur ou se fait expulser (ou quitte), tout le monde voit la liste
  // se mettre à jour tout de suite, sans avoir besoin de recliquer sur le
  // serveur ou de recharger la page.
  useEffect(() => {
    const unsubscribe = db.entities.ServerMember.subscribe(({ type, data }) => {
      if (type === "delete") {
        // Sur Supabase, un événement DELETE ne renvoie souvent QUE l'id de
        // la ligne supprimée (server_id / user_id absents), sauf si la
        // table a REPLICA IDENTITY FULL. Pour savoir si c'est MOI qu'on
        // vient d'expulser (et de quel serveur), on ne peut donc pas se
        // fier à data.server_id : on regarde plutôt dans myMembershipsRef,
        // qui garde la correspondance id d'adhésion -> serveur pour TOUTES
        // mes adhésions, pas seulement celles du serveur actuellement
        // affiché — c'est ce qui permet au serveur de disparaître de la
        // barre latérale même si on regardait autre chose au moment de
        // l'expulsion.
        const kickedServerId = myMembershipsRef.current.get(data.id);
        if (kickedServerId) {
          myMembershipsRef.current.delete(data.id);
          setServers((prev) => prev.filter((s) => s.id !== kickedServerId));
          if (selectedServerRef.current && selectedServerRef.current.id === kickedServerId) {
            setSelectedServer(null);
            setSelectedChannel(null);
            setMembers([]);
            // On était peut-être en vocal dans ce serveur : on s'en déconnecte
            // immédiatement pour ne pas continuer à entendre/parler alors
            // qu'on vient d'être expulsé.
            leaveVoice();
          }
        }
        // Si le membre supprimé fait partie du serveur qu'on regarde en ce
        // moment (que ce soit moi ou quelqu'un d'autre qu'on vient
        // d'expulser), on le retire aussi de la liste de membres visible.
        setMembers((prev) => prev.filter((m) => m.id !== data.id));
        return;
      }

      if (type === "create" && (data.user_id || data.id) === user?.id) {
        // On vient de rejoindre un serveur (depuis un autre onglet, ou
        // qu'on nous y a ajouté) : on le suit désormais nous aussi.
        myMembershipsRef.current.set(data.id, data.server_id);
        db.entities.Server.get(data.server_id).then((srv) => {
          if (srv) setServers((prev) => (prev.some((s) => s.id === srv.id) ? prev : [...prev, srv]));
        });
      }

      if (!selectedServerRef.current || data.server_id !== selectedServerRef.current.id) return;
      if (type === "create") {
        setMembers((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
        cacheProfiles([data.user_id || data.id]);
      } else if (type === "update") {
        setMembers((prev) => prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)));
      }
    });
    return unsubscribe;
  }, []);

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
    // Garde une trace globale (id d'adhésion -> id de serveur), indépendante
    // du serveur actuellement affiché, pour pouvoir détecter une expulsion
    // même si on regarde un autre serveur ou une DM au moment où ça arrive.
    myMembershipsRef.current = new Map(memberships.map((m) => [m.id, m.server_id]));
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
    // Pas de changement de page ici : sur mobile, la page 0 contient déjà
    // le rail des serveurs ET la liste des salons côte à côte (comme sur
    // desktop) — sélectionner un serveur ne fait que changer ce qui
    // s'affiche à l'intérieur de cette même page.
  };

  const goHome = () => {
    setSelectedServer(null);
    setSelectedDM(null);
    setSelectedDMUser(null);
    setShowFriends(true);
  };

  const selectChannel = (channel) => {
    setSelectedChannel(channel);
    if (isMobile) goToMobilePage(1);
  };

  const toggleMemberList = () => {
    if (isMobile) {
      goToMobilePage(mobilePageRef.current === 2 ? 1 : 2);
    } else {
      setShowMemberList((v) => !v);
    }
  };

  const handleSelectDM = (conv, otherUser) => {
    setSelectedServer(null);
    setSelectedDM(conv);
    setSelectedDMUser(otherUser);
    setShowFriends(false);
    cacheProfiles(conv?.participants || []);
    if (isMobile) goToMobilePage(1);
  };

  // Garde une ref à jour de selectedServer (lisible depuis les listeners
  // tactiles sans avoir à réattacher les listeners à chaque changement), et
  // ramène la page courante à 1 (chat) si on quitte un salon alors qu'on
  // était sur la page 2 (membres) qui n'a plus de sens sans serveur.
  useEffect(() => {
    selectedServerRef.current = selectedServer;
    if (mobilePageRef.current > MOBILE_MAX_PAGE()) {
      goToMobilePage(MOBILE_MAX_PAGE());
    }
  }, [selectedServer]);

  // Swipe horizontal façon Discord mobile : on attache des listeners
  // tactiles non-passifs (nécessaire pour pouvoir bloquer le scroll
  // vertical pendant un swipe horizontal, ce que React ne permet pas de
  // faire de façon fiable via les props onTouch* JSX). On ne les monte
  // qu'une fois sur mobile, et on lit les valeurs qui changent (page
  // courante, serveur sélectionné) via des refs plutôt que des deps
  // d'effet, pour éviter de recréer les listeners à chaque frame de drag.
  useEffect(() => {
    if (!isMobile) return;
    const wrap = mobileWrapRef.current;
    const track = mobileTrackRef.current;
    if (!wrap || !track) return;

    const drag = { startX: 0, startY: 0, dragging: false, horizontal: null, baseX: 0 };

    // Éléments sur lesquels le swipe ne doit JAMAIS s'activer : sinon un
    // léger tremblement du doigt en tapant sur le champ de message (ou en
    // faisant défiler une liste, ou en appuyant sur un bouton) est détecté
    // comme un swipe horizontal, on appelle preventDefault(), et ça bloque
    // l'ouverture du clavier / le focus / le clic — d'où "impossible
    // d'écrire" sur mobile.
    const isInteractiveTarget = (el) =>
      !!el.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="textbox"]');

    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (isInteractiveTarget(e.target)) {
        // On laisse le navigateur gérer normalement le tap/focus/scroll de
        // cet élément, sans jamais déclencher notre logique de swipe.
        drag.dragging = false;
        return;
      }
      track.style.transition = "none";
      drag.startX = t.clientX;
      drag.startY = t.clientY;
      drag.dragging = true;
      drag.horizontal = null;
      drag.baseX = -mobilePageRef.current * wrap.clientWidth;
    };

    const onTouchMove = (e) => {
      if (!drag.dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (drag.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        drag.horizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!drag.horizontal) return; // scroll vertical normal : on laisse faire
      e.preventDefault();
      const maxPage = MOBILE_MAX_PAGE();
      let d = dx;
      // effet "élastique" quand on essaie de dépasser la première ou la
      // dernière page, comme un vrai scroll iOS/Android.
      if (mobilePageRef.current === 0 && d > 0) d = d / 3;
      if (mobilePageRef.current === maxPage && d < 0) d = d / 3;
      track.style.transform = `translateX(${drag.baseX + d}px)`;
    };

    const onTouchEnd = (e) => {
      if (drag.dragging && drag.horizontal) {
        const t = e.changedTouches[0];
        const dx = t.clientX - drag.startX;
        const threshold = Math.min(120, wrap.clientWidth * 0.22);
        const maxPage = MOBILE_MAX_PAGE();
        let next = mobilePageRef.current;
        if (dx < -threshold) next = Math.min(maxPage, mobilePageRef.current + 1);
        else if (dx > threshold) next = Math.max(0, mobilePageRef.current - 1);
        goToMobilePage(next);
      } else {
        goToMobilePage(mobilePageRef.current);
      }
      drag.dragging = false;
      drag.horizontal = null;
    };

    wrap.addEventListener("touchstart", onTouchStart, { passive: true });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });
    wrap.addEventListener("touchend", onTouchEnd, { passive: true });
    wrap.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      wrap.removeEventListener("touchstart", onTouchStart);
      wrap.removeEventListener("touchmove", onTouchMove);
      wrap.removeEventListener("touchend", onTouchEnd);
      wrap.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isMobile]);

  // Re-cale la piste correctement si l'écran change de taille (rotation,
  // clavier virtuel qui redimensionne le viewport, etc).
  useEffect(() => {
    if (!isMobile) return;
    const onResize = () => goToMobilePage(mobilePageRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

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
    if (!target) return;
    await db.entities.ServerMember.delete(target.id);
    const stillMember = await db.entities.ServerMember.get(target.id);
    if (stillMember) {
      alert('L\'expulsion a été refusée par la base de données (policy RLS sur "server_members" dans Supabase). Le membre est toujours présent.');
      return;
    }
    loadServerData(selectedServer.id);
  };

  // Retire un membre de la liste affichée immédiatement, sans attendre
  // Supabase Realtime (qui peut ne pas être activé sur "server_members").
  // Utilisé après un /ban ou /unban exécuté depuis le chat.
  const handleMemberRemovedLocally = (memberRowId) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberRowId));
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

      {isMobile ? (
        <div ref={mobileWrapRef} className="relative w-full h-full overflow-hidden">
          {/* Piste à 3 panneaux (300% de large), déplacée au doigt en swipe
              horizontal — exactement le comportement historique de Discord
              mobile : rail serveurs+salons, conversation, membres. */}
          <div
            ref={mobileTrackRef}
            className="flex h-full"
            style={{ width: "300%", transform: "translateX(0px)" }}
          >
            {/* Page 0 : rail des serveurs + liste des salons/DM */}
            <div className="h-full flex-shrink-0 flex overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <div className="w-[72px] bg-[var(--bg-tertiary)] flex-shrink-0 flex flex-col items-center py-3 pb-20 gap-2 overflow-y-auto">
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

              {selectedServer ? (
                <ServerSidebar
                  server={selectedServer}
                  channels={visibleChannels}
                  categories={categories}
                  selectedChannel={selectedChannel}
                  onSelectChannel={selectChannel}
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
                <div className="flex-1 bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
                  <div className="h-12 border-b border-[var(--bg-tertiary)] flex items-center justify-between px-4 flex-shrink-0">
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
                      goToMobilePage(1);
                    }}
                    liveProfiles={liveProfiles}
                  />
                </div>
              )}
            </div>

            {/* Page 1 : conversation (salon de serveur, DM, ou liste d'amis) */}
            <div className="h-full flex-shrink-0 flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <div className="h-12 flex-shrink-0 border-b border-[var(--bg-tertiary)] flex items-center gap-2 px-2 bg-[var(--bg-secondary)]">
                <button
                  onClick={() => goToMobilePage(0)}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-white transition rounded"
                  title="Retour"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white font-semibold text-sm truncate">
                  {selectedServer
                    ? selectedChannel
                      ? `# ${selectedChannel.name}`
                      : selectedServer.name
                    : showFriends
                    ? "Amis"
                    : selectedDMUser?.display_name || selectedDMUser?.username || "Messages"}
                </span>
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {selectedServer ? (
                  <ChatArea
                    channel={selectedChannel}
                    currentUser={user}
                    isDM={false}
                    serverRoles={roles}
                    serverMembers={liveMembers}
                    liveProfiles={liveProfiles}
                    showMemberList={mobilePage === 2}
                    onToggleMemberList={toggleMemberList}
                    onSecretCode={unlockSignalingField}
                    isOwner={isMemberOwner}
                    canUseCommands={myPermissions.canUseCommands}
                    serverOwnerId={selectedServer?.owner_id}
                    onMemberRemoved={handleMemberRemovedLocally}
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
              </div>
            </div>

            {/* Page 2 : membres du salon (pertinent uniquement dans un salon de serveur) */}
            <div className="h-full flex-shrink-0 flex flex-col overflow-hidden" style={{ width: `${100 / 3}%` }}>
              <div className="h-12 flex-shrink-0 border-b border-[var(--bg-tertiary)] flex items-center gap-2 px-2 bg-[var(--bg-secondary)]">
                <button
                  onClick={() => goToMobilePage(1)}
                  className="p-1.5 text-[var(--text-secondary)] hover:text-white transition rounded"
                  title="Retour"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white font-semibold text-sm truncate">Membres</span>
              </div>
              {selectedServer && (
                <MemberList
                  members={liveMembers}
                  roles={roles}
                  currentUser={user}
                  onOpenDM={handleOpenDM}
                  onAddFriend={handleAddFriend}
                  liveProfiles={liveProfiles}
                  canKickMembers={myPermissions.canKickMembers}
                  onKickMember={handleKickMember}
                  serverOwnerId={selectedServer?.owner_id}
                  mobileFull
                />
              )}
            </div>
          </div>

          {/* Barre utilisateur, uniquement visible sur la page 0 (rail serveurs) */}
          <div
            className={`fixed bottom-0 left-0 w-full flex items-center gap-2 bg-[var(--bg-floating)] px-3 py-2 z-20 transition-opacity duration-150 ${
              mobilePage === 0 ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
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
        </div>
      ) : (
        <>
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
              onSelectChannel={selectChannel}
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
                onToggleMemberList={toggleMemberList}
                onSecretCode={unlockSignalingField}
                isOwner={isMemberOwner}
                canUseCommands={myPermissions.canUseCommands}
                serverOwnerId={selectedServer?.owner_id}
                onMemberRemoved={handleMemberRemovedLocally}
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
                <MemberList
                  members={liveMembers}
                  roles={roles}
                  currentUser={user}
                  onOpenDM={handleOpenDM}
                  onAddFriend={handleAddFriend}
                  liveProfiles={liveProfiles}
                  canKickMembers={myPermissions.canKickMembers}
                  onKickMember={handleKickMember}
                  serverOwnerId={selectedServer?.owner_id}
                />
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
        </>
      )}

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