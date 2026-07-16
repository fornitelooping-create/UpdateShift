import React from "react";
import { MicOff } from "lucide-react";

const STATUS_COLORS = {
  online: "#23a559",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#80848e"
};

export default function UserAvatar({ user, size = 40, showStatus = false, muted = false, onClick }) {
  const initials = (user?.display_name || user?.username || "?").charAt(0).toUpperCase();
  const colors = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245"];
  const colorIdx = (user?.username || "").charCodeAt(0) % colors.length;
  const bgColor = colors[colorIdx];

  return (
    <div className="relative inline-block" style={{ width: size, height: size }} onClick={onClick}>
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.username}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold select-none"
          style={{ width: size, height: size, background: bgColor, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <span
          className="absolute rounded-full ring-2"
          style={{
            width: Math.max(size * 0.3, 10),
            height: Math.max(size * 0.3, 10),
            right: -1,
            bottom: -1,
            background: STATUS_COLORS[user?.status || "offline"],
            "--tw-ring-color": "var(--bg-primary)"
          }}
        />
      )}
      {muted && (
        <span
          className="absolute rounded-full flex items-center justify-center ring-2"
          style={{
            width: Math.max(size * 0.42, 14),
            height: Math.max(size * 0.42, 14),
            right: -2,
            top: -2,
            background: "#ed4245",
            "--tw-ring-color": "var(--bg-primary)"
          }}
          title="Micro coupé"
        >
          <MicOff
            className="text-white"
            style={{ width: "60%", height: "60%" }}
            strokeWidth={2.5}
          />
        </span>
      )}
    </div>
  );
}
