import React, { useState } from "react";
import { X, Palette, Trash2 } from "lucide-react";
import { useTheme, THEME_TOKENS } from "@/lib/ThemeContext";

/**
 * Modale de création / édition d'un thème personnalisé.
 * - Si `editingTheme` est fourni, on modifie ce thème (en direct, aperçu live).
 * - Sinon, on crée un nouveau thème.
 */
export default function ThemeEditorModal({ onClose, editingTheme }) {
  const { createTheme, updateTheme, deleteTheme, setTheme, activeTheme } = useTheme();

  const startingTokens = editingTheme?.tokens || activeTheme.tokens;
  const [label, setLabel] = useState(editingTheme?.label || "Mon thème");
  const [tokens, setTokens] = useState({ ...startingTokens });

  const isEditing = !!editingTheme;

  const handleTokenChange = (key, value) => {
    const next = { ...tokens, [key]: value };
    setTokens(next);
    // Aperçu en direct si on modifie le thème actuellement actif
    if (isEditing && activeTheme.id === editingTheme.id) {
      updateTheme(editingTheme.id, { tokens: { [key]: value } });
    }
  };

  const handleSave = () => {
    if (isEditing) {
      updateTheme(editingTheme.id, { label, tokens });
    } else {
      createTheme(label, tokens);
    }
    onClose();
  };

  const handleDelete = () => {
    if (isEditing) {
      deleteTheme(editingTheme.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h2 className="text-[var(--text-normal)] font-bold flex items-center gap-2">
            <Palette className="w-5 h-5" />
            {isEditing ? "Modifier le thème" : "Créer un thème"}
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-normal)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1 block">
              Nom du thème
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={30}
              className="w-full bg-[var(--bg-input)] text-[var(--text-normal)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5865f2]"
              placeholder="Ex: Bleu nuit"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold block">
              Couleurs
            </label>
            {THEME_TOKENS.map(({ key, label: tokenLabel }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-normal)] text-sm">{tokenLabel}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="color"
                    value={tokens[key] || "#000000"}
                    onChange={(e) => handleTokenChange(key, e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border border-[var(--border-default)]"
                  />
                  <input
                    type="text"
                    value={tokens[key] || ""}
                    onChange={(e) => handleTokenChange(key, e.target.value)}
                    className="w-20 bg-[var(--bg-input)] text-[var(--text-muted)] rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#5865f2]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-[var(--border-default)]">
          {isEditing ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-[#ed4245] hover:underline text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm text-[var(--text-normal)] hover:underline"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md text-sm font-medium bg-[#5865f2] text-white hover:bg-[#4752c4] transition"
            >
              {isEditing ? "Enregistrer" : "Créer le thème"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
