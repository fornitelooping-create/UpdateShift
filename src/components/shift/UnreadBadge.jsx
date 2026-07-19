import React from "react";

// Petite pastille rouge affichant un nombre de messages non lus, à
// positionner en absolu au-dessus d'un icône de serveur / avatar de
// conversation (le parent doit être en `position: relative`).
export default function UnreadBadge({ count, size = "normal" }) {
  if (!count || count <= 0) return null;
  const display = count > 9 ? "9+" : String(count);
  const small = size === "small";

  return (
    <span
      className="absolute flex items-center justify-center rounded-full bg-[#ed4245] text-white font-bold pointer-events-none ring-2"
      style={{
        top: small ? -4 : -6,
        right: small ? -4 : -6,
        minWidth: small ? 15 : 18,
        height: small ? 15 : 18,
        padding: "0 3px",
        fontSize: small ? 9 : 10,
        "--tw-ring-color": "var(--bg-tertiary)"
      }}
    >
      {display}
    </span>
  );
}
