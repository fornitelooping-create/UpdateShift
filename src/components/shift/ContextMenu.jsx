import React, { useEffect, useRef } from "react";

// Generic positioned popup menu. `items` is an array of
// { label, icon, onClick, danger } or `null` to render a divider.
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // Keep the menu on-screen
  const style = {
    top: Math.min(y, window.innerHeight - items.length * 36 - 20),
    left: Math.min(x, window.innerWidth - 220)
  };

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-[var(--bg-deepest)] rounded-lg shadow-2xl py-1 w-52 overflow-hidden"
      style={style}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="border-t border-[var(--bg-secondary)] my-1" />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
              item.danger
                ? "text-[#ed4245] hover:bg-[#ed4245] hover:text-white"
                : "text-[var(--text-secondary)] hover:text-white hover:bg-[#5865f2]"
            }`}
          >
            {item.icon && <item.icon className="w-4 h-4" />}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
