import React from "react";
import { useTheme } from "@/lib/ThemeContext";

/**
 * Couche d'arrière-plan fixe qui affiche l'image ou la vidéo du thème actif,
 * à la manière de BetterDiscord. Se place derrière tout le reste de l'app.
 */
export default function ThemeBackground() {
  const { activeTheme } = useTheme();
  const bg = activeTheme?.background;

  if (!bg?.mediaUrl) return null;

  const opacity = bg.opacity ?? 0.2;
  const blur = bg.blur ?? 0;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {bg.mediaType === "video" ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: blur ? `blur(${blur}px)` : undefined, opacity }}
          src={bg.mediaUrl}
        />
      ) : (
        <img
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: blur ? `blur(${blur}px)` : undefined, opacity }}
          src={bg.mediaUrl}
        />
      )}
    </div>
  );
}