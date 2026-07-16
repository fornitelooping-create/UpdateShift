import React, { useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";

export default function MediaPreview({ url, fileName, fileType, onClose }) {
  const isVideo = fileType?.startsWith("video/");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // The file lives on a different origin (Supabase Storage), so the plain
  // <a download> attribute is ignored by browsers and just opens a new tab.
  // Fetching it ourselves and saving the blob forces a real download.
  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName || "fichier";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Échec du téléchargement", err);
      // Fallback: open in a new tab if the fetch/download failed for any reason.
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2 transition"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        onClick={handleDownload}
        disabled={downloading}
        className="absolute top-4 right-16 text-white/70 hover:text-white bg-black/40 rounded-full p-2 transition disabled:opacity-60"
        title="Télécharger"
      >
        {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
      </button>

      <div
        className="max-w-5xl max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
          />
        ) : (
          <img
            src={url}
            alt={fileName}
            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
          />
        )}
        {fileName && (
          <p className="text-white/60 text-sm">{fileName}</p>
        )}
      </div>
    </div>
  );
}
