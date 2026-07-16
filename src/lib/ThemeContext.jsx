import React, { createContext, useContext, useEffect, useState } from "react";

const ACTIVE_KEY = "shift-theme";
const CUSTOM_KEY = "shift-custom-themes";

// Liste des jetons de couleur qui pilotent toute l'interface.
// Chaque thème (intégré ou personnalisé) doit fournir une valeur pour chacun.
export const THEME_TOKENS = [
  { key: "bg-primary", label: "Fond principal (zone de chat)" },
  { key: "bg-secondary", label: "Fond secondaire (barre des salons)" },
  { key: "bg-tertiary", label: "Fond tertiaire (barre des serveurs)" },
  { key: "bg-floating", label: "Fond flottant (menus, pop-ups)" },
  { key: "bg-input", label: "Fond des champs de saisie" },
  { key: "bg-modifier-hover", label: "Survol" },
  { key: "bg-modifier-hover-strong", label: "Survol accentué" },
  { key: "bg-deepest", label: "Fond le plus sombre (appels)" },
  { key: "border-default", label: "Bordures / séparateurs" },
  { key: "text-normal", label: "Texte principal" },
  { key: "text-secondary", label: "Texte secondaire" },
  { key: "text-muted", label: "Texte atténué" },
  { key: "text-muted-alt", label: "Texte atténué (variante)" },
];

// Extensions de fichiers supportées pour l'import d'arrière-plan.
export const SUPPORTED_BG_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm"];

// Les 3 thèmes gratuits façon Discord, toujours disponibles.
export const BUILTIN_THEMES = [
  {
    id: "dark",
    label: "Sombre",
    builtin: true,
    tokens: {
      "bg-primary": "#313338",
      "bg-secondary": "#2b2d31",
      "bg-tertiary": "#1e1f22",
      "bg-floating": "#232428",
      "bg-input": "#383a40",
      "bg-modifier-hover": "#35373c",
      "bg-modifier-hover-strong": "#43454a",
      "bg-deepest": "#111214",
      "border-default": "#383a40",
      "text-normal": "#dcddde",
      "text-secondary": "#b5bac1",
      "text-muted": "#72767d",
      "text-muted-alt": "#949ba4",
    },
  },
  {
    id: "light",
    label: "Clair",
    builtin: true,
    tokens: {
      "bg-primary": "#ffffff",
      "bg-secondary": "#f2f3f5",
      "bg-tertiary": "#e3e5e8",
      "bg-floating": "#ffffff",
      "bg-input": "#ebedef",
      "bg-modifier-hover": "#e8e9ec",
      "bg-modifier-hover-strong": "#dcdee1",
      "bg-deepest": "#d4d6da",
      "border-default": "#e3e5e8",
      "text-normal": "#060607",
      "text-secondary": "#4e5058",
      "text-muted": "#6d6f78",
      "text-muted-alt": "#80848e",
    },
  },
  {
    id: "amoled",
    label: "Amoled",
    builtin: true,
    tokens: {
      "bg-primary": "#000000",
      "bg-secondary": "#000000",
      "bg-tertiary": "#000000",
      "bg-floating": "#060606",
      "bg-input": "#141414",
      "bg-modifier-hover": "#1a1a1a",
      "bg-modifier-hover-strong": "#242424",
      "bg-deepest": "#000000",
      "border-default": "#1f1f1f",
      "text-normal": "#ffffff",
      "text-secondary": "#d1d1d1",
      "text-muted": "#949494",
      "text-muted-alt": "#7a7a7a",
    },
  },
];

function loadCustomThemes() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomThemes(themes) {
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(themes));
}

function getInitialActiveId() {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(ACTIVE_KEY) || "dark";
}

// Convertit une couleur hex (#rrggbb) en rgba(r, g, b, alpha).
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Quand un arrière-plan média est actif, on rend les fonds semi-transparents
// pour que l'image/vidéo soit visible à travers les panneaux (façon BetterDiscord).
function applyThemeTokens(tokens, hasBackground = false) {
  const root = document.documentElement;
  THEME_TOKENS.forEach(({ key }) => {
    const value = tokens?.[key];
    if (!value) return;
    if (hasBackground && key.startsWith("bg-")) {
      root.style.setProperty(`--${key}`, hexToRgba(value, 0));
    } else {
      root.style.setProperty(`--${key}`, value);
    }
  });
}

function makeThemeId(label) {
  const base = (label || "theme")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "theme";
  return `custom-${base}-${Date.now().toString(36)}`;
}

const ThemeContext = createContext({
  themeId: "dark",
  activeTheme: BUILTIN_THEMES[0],
  allThemes: BUILTIN_THEMES,
  customThemes: [],
  setTheme: () => {},
  createTheme: () => {},
  updateTheme: () => {},
  deleteTheme: () => {},
  importTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(getInitialActiveId);
  const [customThemes, setCustomThemes] = useState(loadCustomThemes);

  const allThemes = [...BUILTIN_THEMES, ...customThemes];
  const activeTheme = allThemes.find((t) => t.id === themeId) || BUILTIN_THEMES[0];

  // Applique les couleurs à chaque changement de thème actif ou de ses valeurs.
  useEffect(() => {
    applyThemeTokens(activeTheme.tokens, !!activeTheme.background?.mediaUrl);
    window.localStorage.setItem(ACTIVE_KEY, activeTheme.id);
  }, [activeTheme]);

  const setTheme = (id) => {
    if (allThemes.some((t) => t.id === id)) setThemeId(id);
  };

  // Crée un nouveau thème personnalisé à partir d'un set de couleurs
  // (par défaut, copie du thème "Sombre" pour partir d'une base cohérente).
  const createTheme = (label, tokens, background = null) => {
    const base = BUILTIN_THEMES[0].tokens;
    const newTheme = {
      id: makeThemeId(label),
      label: label?.trim() || "Nouveau thème",
      builtin: false,
      tokens: { ...base, ...tokens },
      background,
    };
    const next = [...customThemes, newTheme];
    setCustomThemes(next);
    saveCustomThemes(next);
    setThemeId(newTheme.id);
    return newTheme.id;
  };

  // Importe un thème à partir d'un fichier média (image/vidéo) utilisé comme
  // arrière-plan, à la manière de BetterDiscord.
  // `background` = { mediaUrl, mediaType: "image"|"video", opacity, blur }
  const importTheme = (label, background, baseTokens = null) => {
    const base = baseTokens || BUILTIN_THEMES[0].tokens;
    const newTheme = {
      id: makeThemeId(label || "Thème importé"),
      label: label?.trim() || "Thème importé",
      builtin: false,
      tokens: { ...base },
      background,
    };
    const next = [...customThemes, newTheme];
    setCustomThemes(next);
    saveCustomThemes(next);
    setThemeId(newTheme.id);
    return newTheme.id;
  };

  const updateTheme = (id, updates) => {
    const next = customThemes.map((t) =>
      t.id === id
        ? {
            ...t,
            label: updates.label ?? t.label,
            tokens: updates.tokens ? { ...t.tokens, ...updates.tokens } : t.tokens,
            background: updates.background !== undefined ? updates.background : t.background,
          }
        : t
    );
    setCustomThemes(next);
    saveCustomThemes(next);
  };

  const deleteTheme = (id) => {
    const next = customThemes.filter((t) => t.id !== id);
    setCustomThemes(next);
    saveCustomThemes(next);
    if (themeId === id) setThemeId("dark");
  };

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        activeTheme,
        allThemes,
        customThemes,
        setTheme,
        createTheme,
        updateTheme,
        deleteTheme,
        importTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}