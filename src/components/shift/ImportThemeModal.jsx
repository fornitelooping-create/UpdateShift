import React, { useState, useRef } from "react";
import { X, Upload, Image as ImageIcon, Film, Loader2, Check, AlertCircle } from "lucide-react";
import { useTheme, SUPPORTED_BG_EXTENSIONS, BUILTIN_THEMES } from "@/lib/ThemeContext";
import { db } from "@/lib/localDb";

/**
 * Modale d'import d'un thème personnalisé à partir d'un fichier média
 * (.png, .jpg, .gif, .mp4), façon BetterDiscord.
 * Le fichier devient l'arrière-plan de l'app, superposé aux couleurs de base.
 */
export default function ImportThemeModal({ onClose }) {
  const { importTheme } = useTheme();
  const fileInputRef = useRef(null);

  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null); // "image" | "video"
  const [opacity, setOpacity] = useState(0.5);
  const [blur, setBlur] = useState(0);
  const [baseThemeId, setBaseThemeId] = useState("dark");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const name = selected.name.toLowerCase();
    const ext = SUPPORTED_BG_EXTENSIONS.find((ext) => name.endsWith(ext));
    if (!ext) {
      setError(`Format non supporté. Utilisez : ${SUPPORTED_BG_EXTENSIONS.join(", ")}`);
      return;
    }

    setError(null);
    setFile(selected);
    const isVideo = [".mp4", ".webm"].includes(ext);
    setMediaType(isVideo ? "video" : "image");

    // Pré-remplit le nom du thème avec le nom du fichier
    if (!label.trim()) {
      const baseName = selected.name.replace(/\.[^.]+$/, "");
      setLabel(baseName);
    }

    // Aperçu local
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
  };

  const handleImport = async () => {
    if (!file) {
      setError("Choisis d'abord un fichier image ou vidéo.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const baseTheme = BUILTIN_THEMES.find((t) => t.id === baseThemeId);
      importTheme(label, {
        mediaUrl: file_url,
        mediaType,
        opacity,
        blur,
      }, baseTheme?.tokens);
      onClose();
    } catch (e) {
      setError("Échec de l'envoi du fichier. Réessaie.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h2 className="text-[var(--text-normal)] font-bold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importer un thème
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-normal)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* Zone de dépôt de fichier */}
          <div>
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-2 block">
              Fichier d'arrière-plan
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-[var(--border-default)] rounded-xl py-8 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] hover:border-[#5865f2] hover:text-[var(--text-secondary)] transition"
            >
              {previewUrl ? (
                <div className="w-full h-28 rounded-lg overflow-hidden relative flex items-center justify-center">
                  {mediaType === "video" ? (
                    <video src={previewUrl} muted loop autoPlay className="max-h-full max-w-full object-contain" />
                  ) : (
                    <img src={previewUrl} alt="Aperçu" className="max-h-full max-w-full object-contain" />
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-6 h-6" />
                    <Film className="w-6 h-6" />
                  </div>
                  <span className="text-sm">Clique pour choisir un fichier</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_BG_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-[var(--text-muted)] text-xs mt-1.5">
              Formats supportés : PNG, JPG, GIF, MP4
            </p>
          </div>

          {/* Nom du thème */}
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
              placeholder="Ex: Forêt animée"
            />
          </div>

          {/* Thème de base (couleurs) */}
          <div>
            <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold mb-1 block">
              Couleurs de base
            </label>
            <div className="flex gap-2">
              {BUILTIN_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setBaseThemeId(t.id)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition border-2 ${
                    baseThemeId === t.id
                      ? "border-[#5865f2] text-[var(--text-normal)]"
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                  style={{ background: t.tokens["bg-tertiary"] }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacité */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold">
                Opacité
              </label>
              <span className="text-[var(--text-muted)] text-xs">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-[#5865f2]"
            />
          </div>

          {/* Flou */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[var(--text-secondary)] text-xs uppercase font-semibold">
                Flou
              </label>
              <span className="text-[var(--text-muted)] text-xs">{blur}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={blur}
              onChange={(e) => setBlur(parseInt(e.target.value, 10))}
              className="w-full accent-[#5865f2]"
            />
          </div>

          {error && (
            <p className="text-[#ed4245] text-sm flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => setError(null)}
                title="Fermer"
                className="p-0.5 rounded hover:bg-white/10 transition flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </p>
          )}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-default)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-[var(--text-normal)] hover:underline"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={uploading || !file}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-[#5865f2] text-white hover:bg-[#4752c4] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Importer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}