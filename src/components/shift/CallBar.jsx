import { db } from '@/lib/localDb';

import React, { useState, useEffect } from "react";

import { Phone, PhoneOff, Mic, MicOff, PhoneIncoming, PhoneCall, X } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { applyOutputDevice } from "@/lib/audioDeviceSettings";

export default function CallBar({ call }) {
  const { callState, remoteUserId, muted, connectionError, setConnectionError, remoteAudioRef, remoteStream, acceptCall, declineCall, endCall, toggleMute } = call;
  const [remoteProfile, setRemoteProfile] = useState(null);

  useEffect(() => {
    if (!remoteUserId) {
      setRemoteProfile(null);
      return;
    }
    db.entities.UserProfile.filter({ user_id: remoteUserId }).then((r) => setRemoteProfile(r[0] || { username: "Utilisateur" }));
  }, [remoteUserId]);

  // Attaching the stream here (instead of only inside the hook's ontrack
  // handler) guarantees remoteAudioRef.current is set: this effect runs
  // after CallBar itself has committed to the DOM, so the <audio> element
  // below is always mounted by the time this runs. This is what fixes
  // calls that connect fine (ICE/DTLS all succeed) but stay silent.
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      applyOutputDevice(remoteAudioRef.current);
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, remoteAudioRef]);

  return (
    <>
      {/* Remote audio is always mounted so the hook can attach the stream as soon as it arrives */}
      <audio ref={remoteAudioRef} autoPlay />

      {connectionError && callState === "idle" && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[70] bg-[#ed4245] text-white text-sm pl-4 pr-2 py-2 rounded-lg shadow-xl flex items-center gap-3 max-w-[90vw]">
          <span>{connectionError}</span>
          <button
            onClick={() => setConnectionError(null)}
            title="Fermer"
            className="p-1 rounded hover:bg-white/20 transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {callState === "ringing" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-[var(--bg-floating)] rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 border border-[#5865f2]">
          <PhoneIncoming className="w-5 h-5 text-[#23a559] animate-pulse flex-shrink-0" />
          <UserAvatar user={remoteProfile} size={36} />
          <div>
            <p className="text-white text-sm font-semibold">{remoteProfile?.display_name || remoteProfile?.username}</p>
            <p className="text-[var(--text-muted-alt)] text-xs">Appel entrant...</p>
          </div>
          <button
            onClick={declineCall}
            className="bg-[#ed4245] hover:bg-[#c73033] text-white p-2 rounded-full transition"
            title="Refuser"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
          <button
            onClick={acceptCall}
            className="bg-[#23a559] hover:bg-[#1a7f42] text-white p-2 rounded-full transition"
            title="Accepter"
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      )}

      {callState === "calling" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-[var(--bg-floating)] rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <PhoneCall className="w-5 h-5 text-[#5865f2] animate-pulse flex-shrink-0" />
          <UserAvatar user={remoteProfile} size={36} />
          <div>
            <p className="text-white text-sm font-semibold">{remoteProfile?.display_name || remoteProfile?.username}</p>
            <p className="text-[var(--text-muted-alt)] text-xs">Appel en cours...</p>
          </div>
          <button
            onClick={endCall}
            className="bg-[#ed4245] hover:bg-[#c73033] text-white p-2 rounded-full transition"
            title="Annuler"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {callState === "in-call" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-[var(--bg-floating)] rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 border border-[#23a559]">
          <UserAvatar user={remoteProfile} size={36} />
          <div>
            <p className="text-white text-sm font-semibold">{remoteProfile?.display_name || remoteProfile?.username}</p>
            <p className="text-[#23a559] text-xs">En appel</p>
          </div>
          <button
            onClick={toggleMute}
            className={`p-2 rounded-full transition ${muted ? "bg-[#ed4245] text-white" : "bg-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover-strong)]"}`}
            title={muted ? "Activer le micro" : "Couper le micro"}
          >
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={endCall}
            className="bg-[#ed4245] hover:bg-[#c73033] text-white p-2 rounded-full transition"
            title="Raccrocher"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
