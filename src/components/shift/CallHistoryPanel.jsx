import { db } from "@/lib/localDb";
import React, { useState, useEffect } from "react";
import { PhoneOutgoing, PhoneIncoming, PhoneMissed, PhoneOff, Clock } from "lucide-react";
import UserAvatar from "./UserAvatar";

function formatDuration(seconds) {
  if (!seconds || seconds < 1) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Aujourd'hui à ${time}`;
  if (isYesterday) return `Hier à ${time}`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + ` à ${time}`;
}

const STATUS_CONFIG = {
  completed: { label: "Terminé", color: "text-[#23a559]" },
  missed: { label: "Manqué", color: "text-[#ed4245]" },
  declined: { label: "Refusé", color: "text-[#ed4245]" },
  cancelled: { label: "Annulé", color: "text-[var(--text-muted-alt)]" },
  failed: { label: "Échec", color: "text-[#ed4245]" },
};

export default function CallHistoryPanel({ currentUser, onOpenDM, liveProfiles, onStartCall }) {
  const [history, setHistory] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
    const unsubscribe = db.entities.CallHistory.subscribe(() => loadHistory());
    return unsubscribe;
  }, [currentUser?.id]);

  const loadHistory = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    const records = await db.entities.CallHistory.filter({ user_id: currentUser.id });
    records.sort((a, b) => new Date(b.started_at || b.created_date || 0) - new Date(a.started_at || a.created_date || 0));
    setHistory(records);

    const uniqueIds = [...new Set(records.map((r) => r.remote_user_id).filter(Boolean))];
    const profs = await Promise.all(
      uniqueIds.map((uid) => db.entities.UserProfile.filter({ user_id: uid }).then((r) => r[0]))
    );
    const map = {};
    profs.filter(Boolean).forEach((p) => { map[p.user_id] = p; });
    setProfiles(map);
    setLoading(false);
  };

  const getRemoteUser = (record) => {
    const base = profiles[record.remote_user_id] || {
      user_id: record.remote_user_id,
      username: "Utilisateur",
      status: "offline",
    };
    return { ...base, ...(liveProfiles?.[record.remote_user_id] || {}) };
  };

  const getDirectionIcon = (record) => {
    if (record.status === "missed" || record.status === "declined") {
      return <PhoneMissed className="w-4 h-4 text-[#ed4245]" />;
    }
    if (record.direction === "outgoing") {
      return <PhoneOutgoing className="w-4 h-4 text-[#23a559]" />;
    }
    return <PhoneIncoming className="w-4 h-4 text-[#23a559]" />;
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="h-12 border-b border-[var(--bg-tertiary)] flex items-center px-4">
        <span className="text-white font-bold text-sm">Historique des appels</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-[#4e5058] border-t-[var(--text-normal)] rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#80848e]">
            <PhoneOff className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">Aucun appel pour le moment</p>
          </div>
        ) : (
          history.map((record) => {
            const remote = getRemoteUser(record);
            const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.completed;
            return (
              <div
                key={record.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-modifier-hover)] transition cursor-pointer group border-b border-[#3f4147]"
                onClick={() => onOpenDM?.(remote)}
              >
                <div className="flex-shrink-0">
                  <UserAvatar user={remote} size={36} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">
                      {remote.display_name || remote.username}
                    </span>
                    {getDirectionIcon(record)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted-alt)] mt-0.5">
                    <span className={statusCfg.color}>{statusCfg.label}</span>
                    <span>•</span>
                    <span>{formatDate(record.started_at)}</span>
                    {record.duration_seconds > 0 && (
                      <>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(record.duration_seconds)}</span>
                      </>
                    )}
                  </div>
                </div>
                {onStartCall && (record.direction === "outgoing" || record.status === "completed") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartCall(record.remote_user_id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[#23a559] transition p-2"
                    title="Rappeler"
                  >
                    <PhoneOutgoing className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}