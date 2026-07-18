import { useState, useEffect, useRef, useCallback } from "react";
import { sounds } from "@/lib/sounds";
import { getMicStream, applyOutputDevice } from "@/lib/audioDeviceSettings";
import { db } from "@/lib/localDb";

// STUN helps two peers behind NAT discover their public address so they can
// try to connect directly. That's not enough on its own: if either side is
// on a restrictive network (mobile data, corporate/school Wi-Fi, some
// consumer routers with symmetric NAT/CGNAT), the direct path fails and
// audio never flows — even though the call still "connects" in the UI,
// because signaling (WebSocket) and media (WebRTC) are separate paths.
// TURN servers below act as a relay for that case.
//
// ⚠️ openrelay.metered.ca is a free public TURN service, fine for testing/
// small usage, but not guaranteed for production reliability. For a real
// deployment, get your own TURN credentials (e.g. Metered.ca, Twilio
// Network Traversal Service, Cloudflare Calls, or self-hosted coturn) and
// swap them in here.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function useVoiceCall(user, signalingUrl) {
  const [callState, setCallState] = useState("idle"); // idle | calling | ringing | in-call
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]); // ICE candidates that arrive before the RTCPeerConnection is ready for them
  const callStateRef = useRef("idle"); // mirrors callState for use inside the stable ws.onmessage closure
  // Metadata for the call currently in progress (or ringing), used to write a
  // row to CallHistory once we know how it ended. { remoteUserId, direction: "incoming"|"outgoing", startedAt: Date, answeredAt: Date|null }
  const callInfoRef = useRef(null);

  // Reconnexion auto : voir useVoiceChannel.js pour le détail — un proxy
  // intermédiaire peut couper une connexion WebSocket restée inactive sans
  // que le serveur Render lui-même soit en cause. Sans reconnexion et sans
  // heartbeat, un client pouvait se retrouver injoignable pour les appels
  // entrants jusqu'à un rechargement manuel de la page.
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const unmountedRef = useRef(false);
  const connectRef = useRef(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Any ICE candidate that arrived while pcRef.current didn't exist yet (or
  // didn't have a remote description yet) is stashed in pendingCandidatesRef
  // instead of being dropped. Call this once the peer connection has a
  // remote description so those candidates actually get applied.
  const flushPendingCandidates = useCallback(async () => {
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stray/late candidates
      }
    }
  }, []);

  // Writes one CallHistory row for the call that just ended, from this
  // client's own point of view (each side logs its own row: user_id = me,
  // remote_user_id = the other person). `status` is one of:
  // "completed" | "missed" | "declined" | "cancelled" | "failed".
  const recordCallHistory = useCallback((status) => {
    const info = callInfoRef.current;
    callInfoRef.current = null;
    if (!info || !user?.id) return;
    const durationSeconds = info.answeredAt
      ? Math.max(0, Math.round((Date.now() - info.answeredAt.getTime()) / 1000))
      : 0;
    db.entities.CallHistory.create({
      user_id: user.id,
      remote_user_id: info.remoteUserId,
      direction: info.direction,
      status,
      started_at: info.startedAt.toISOString(),
      duration_seconds: durationSeconds,
    }).catch((err) => console.error("[useVoiceCall] échec enregistrement historique d'appel", err));
  }, [user?.id]);

  const cleanupCall = useCallback(() => {
    sounds.stopRing();
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    callInfoRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setRemoteStream(null);
    setCallState("idle");
    setRemoteUserId(null);
    setMuted(false);
  }, []);

  // Connect (and stay connected) to the signaling server
  useEffect(() => {
    if (!user?.id || !signalingUrl) return;

    unmountedRef.current = false;

    const clearHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (unmountedRef.current) return;
      if (reconnectTimeoutRef.current) return; // déjà programmé
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(15000, 1000 * 2 ** attempt) + Math.random() * 500;
      reconnectAttemptsRef.current = attempt + 1;
      console.log(`[useVoiceCall] reconnexion websocket dans ${Math.round(delay)}ms (tentative ${attempt + 1})`);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connectRef.current?.();
      }, delay);
    };

    const connectWs = () => {
      if (unmountedRef.current) return;
      console.log("[useVoiceCall] connexion websocket vers", signalingUrl, "pour user", user.id);
      let ws;
      try {
        ws = new WebSocket(signalingUrl);
      } catch (err) {
        console.error("[useVoiceCall] échec de création du WebSocket:", err);
        setConnectionError("Adresse de serveur d'appel invalide.");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[useVoiceCall] websocket connecté");
        reconnectAttemptsRef.current = 0;
        setConnectionError(null);
        setSocketReady(true);
        send({ type: "register", userId: user.id });

        // Garde la connexion active pour éviter qu'un proxy intermédiaire
        // la considère comme inactive et la coupe silencieusement — voir
        // la même logique dans useVoiceChannel.js.
        clearHeartbeat();
        heartbeatIntervalRef.current = setInterval(() => {
          send({ type: "ping" });
        }, 25000);
      };
      ws.onerror = (e) => {
        console.error("[useVoiceCall] erreur websocket", e);
        setConnectionError("Impossible de joindre le serveur d'appel. Vérifie l'adresse dans les paramètres.");
        setSocketReady(false);
      };
      ws.onclose = (e) => {
        console.warn("[useVoiceCall] websocket fermé", e.code, e.reason);
        setSocketReady(false);
        clearHeartbeat();
        // Ne pas retenter si on était en plein appel : on laisse
        // l'utilisateur constater que l'appel est coupé plutôt que de
        // ressusciter une connexion dans un état incertain au milieu d'un
        // appel. Dans tous les autres cas (idle), on reconnecte tout seul.
        if (callStateRef.current === "idle") {
          scheduleReconnect();
        }
      };

      ws.onmessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      console.log("[useVoiceCall] message reçu:", msg.type, msg);

      if (msg.type === "call-offer") {
        if (callStateRef.current !== "idle") {
          // Already in/starting a call — auto-decline to keep things simple,
          // and log it as a missed call since the person never saw it ring.
          send({ type: "call-rejected", targetUserId: msg.fromUserId });
          if (user?.id) {
            db.entities.CallHistory.create({
              user_id: user.id,
              remote_user_id: msg.fromUserId,
              direction: "incoming",
              status: "missed",
              started_at: new Date().toISOString(),
              duration_seconds: 0,
            }).catch((err) => console.error("[useVoiceCall] échec enregistrement historique d'appel (occupé)", err));
          }
          return;
        }
        pendingOfferRef.current = msg.offer;
        callInfoRef.current = { remoteUserId: msg.fromUserId, direction: "incoming", startedAt: new Date(), answeredAt: null };
        setRemoteUserId(msg.fromUserId);
        setCallState("ringing");
        sounds.startIncomingRing();
        return;
      }

      if (msg.type === "call-answer" && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
        await flushPendingCandidates();
        if (callInfoRef.current) callInfoRef.current.answeredAt = new Date();
        setCallState("in-call");
        sounds.stopRing();
        return;
      }

      if (msg.type === "ice-candidate" && msg.candidate) {
        // Bug fix: while the call is "ringing" (offer received but the user
        // hasn't clicked Accept yet, or the mic permission prompt is still
        // open), pcRef.current is still null — the caller's ICE candidates
        // were being silently dropped here and never replaced, so the two
        // peers could exchange offer/answer (call "connects") but never
        // actually agree on a network path, and no audio would flow.
        // We now queue them and apply them once the peer connection exists
        // and has a remote description (see acceptCall / call-answer above).
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            // ignore stray/late candidates
          }
        } else {
          pendingCandidatesRef.current.push(msg.candidate);
        }
        return;
      }

      if (msg.type === "call-rejected") {
        // The other side explicitly declined our call.
        recordCallHistory("declined");
        cleanupCall();
        return;
      }

      if (msg.type === "call-ended") {
        // The other side hung up. If we had already answered, it was a real
        // (completed) call; if we were still ringing and never answered,
        // it's a missed call for us; otherwise (we were still calling and
        // it ended before an answer came back) treat it as cancelled.
        const info = callInfoRef.current;
        const status = info?.answeredAt ? "completed" : info?.direction === "incoming" ? "missed" : "cancelled";
        recordCallHistory(status);
        cleanupCall();
        return;
      }

      if (msg.type === "user-offline") {
        // Ne réagir que si on est réellement en train d'appeler quelqu'un :
        // sans cette vérification, n'importe quel message "user-offline"
        // reçu du serveur (tardif, dupliqué, ou envoyé hors contexte)
        // déclenchait le popup même au repos, et pouvait sembler apparaître
        // "en boucle" si le serveur le renvoyait plusieurs fois.
        if (callStateRef.current === "calling") {
          setConnectionError("Cette personne n'est pas connectée au serveur d'appel en ce moment.");
          recordCallHistory("failed");
          cleanupCall();
        } else {
          console.warn("[useVoiceCall] message 'user-offline' ignoré (aucun appel sortant en cours)", msg);
        }
      }
      };
    };

    connectRef.current = connectWs;
    connectWs();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      clearHeartbeat();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.id, signalingUrl, send, cleanupCall, flushPendingCandidates]);

  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log("[useVoiceCall] candidat ICE local trouvé, envoi ->", targetUserId, e.candidate.type, e.candidate.protocol);
        send({ type: "ice-candidate", targetUserId, candidate: e.candidate });
      } else {
        console.log("[useVoiceCall] fin de la collecte de candidats ICE locaux");
      }
    };
    pc.ontrack = (e) => {
      console.log("[useVoiceCall] piste audio distante reçue", e.streams[0]);
      // Don't rely solely on remoteAudioRef.current being attached at this
      // exact instant — this native WebRTC event fires independently of
      // React's render/commit cycle, and in some cases (fast refresh,
      // remounts, timing edge cases) the <audio> element isn't attached
      // to the ref yet when this fires, silently dropping the stream.
      // Storing it in state lets a useEffect in CallBar attach it
      // reliably once the element definitely exists.
      setRemoteStream(e.streams[0]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        applyOutputDevice(remoteAudioRef.current);
        remoteAudioRef.current.play().catch((err) => console.error("[useVoiceCall] échec de la lecture audio", err));
      } else {
        console.warn("[useVoiceCall] piste reçue mais remoteAudioRef.current est null pour l'instant (sera rattaché via remoteStream)");
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log("[useVoiceCall] iceConnectionState ->", pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      console.log("[useVoiceCall] connectionState ->", pc.connectionState);
      // "failed" *can* mean ICE genuinely found no working path — but it
      // can also be a transient blip that still recovers on its own. We
      // learned the hard way that force-ending the call here breaks calls
      // that would otherwise have connected fine, so we only warn and let
      // the explicit call-ended/call-rejected messages (or the user
      // hanging up manually) drive the actual end of the call.
      if (pc.connectionState === "failed") {
        setConnectionError("La connexion audio a des difficultés à s'établir. Si tu n'entends toujours rien après quelques secondes, raccroche et réessaie.");
      } else if (pc.connectionState === "connected") {
        setConnectionError(null);
      }
    };
    pcRef.current = pc;
    return pc;
  };

  const startCall = useCallback(async (targetUserId) => {
    setConnectionError(null);
    console.log("[useVoiceCall] startCall vers", targetUserId);
    try {
      const stream = await getMicStream();
      console.log("[useVoiceCall] micro obtenu, pistes:", stream.getAudioTracks().length);
      localStreamRef.current = stream;
      const pc = createPeerConnection(targetUserId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[useVoiceCall] offre créée et envoyée");
      send({ type: "call-offer", targetUserId, offer });
      callInfoRef.current = { remoteUserId: targetUserId, direction: "outgoing", startedAt: new Date(), answeredAt: null };
      setRemoteUserId(targetUserId);
      setCallState("calling");
      sounds.startOutgoingRing();
    } catch (err) {
      console.error("[useVoiceCall] échec startCall:", err);
      setConnectionError(err.message === "Permission denied"
        ? "Accès au micro refusé."
        : "Impossible de démarrer l'appel.");
      cleanupCall();
    }
  }, [send, cleanupCall]);

  const acceptCall = useCallback(async () => {
    const targetUserId = remoteUserId;
    const offer = pendingOfferRef.current;
    console.log("[useVoiceCall] acceptCall, targetUserId=", targetUserId, "offer présente:", !!offer);
    if (!offer || !targetUserId) return;
    try {
      const stream = await getMicStream();
      console.log("[useVoiceCall] micro obtenu (accept), pistes:", stream.getAudioTracks().length);
      localStreamRef.current = stream;
      const pc = createPeerConnection(targetUserId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[useVoiceCall] réponse créée et envoyée");
      send({ type: "call-answer", targetUserId, answer });
      if (callInfoRef.current) callInfoRef.current.answeredAt = new Date();
      setCallState("in-call");
      sounds.stopRing();
    } catch (err) {
      console.error("[useVoiceCall] échec acceptCall:", err);
      setConnectionError("Impossible d'accepter l'appel (micro inaccessible ?).");
      declineCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUserId, send, flushPendingCandidates]);

  const declineCall = useCallback(() => {
    if (remoteUserId) send({ type: "call-rejected", targetUserId: remoteUserId });
    recordCallHistory("declined");
    cleanupCall();
  }, [remoteUserId, send, cleanupCall, recordCallHistory]);

  const endCall = useCallback(() => {
    if (remoteUserId) send({ type: "call-ended", targetUserId: remoteUserId });
    const info = callInfoRef.current;
    const status = info?.answeredAt ? "completed" : info?.direction === "outgoing" ? "cancelled" : "declined";
    recordCallHistory(status);
    cleanupCall();
  }, [remoteUserId, send, cleanupCall, recordCallHistory]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    setMuted((prevMuted) => {
      const next = !prevMuted;
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  return {
    callState,
    remoteUserId,
    muted,
    connectionError,
    setConnectionError,
    socketReady,
    remoteAudioRef,
    remoteStream,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute
  };
}
