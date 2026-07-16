const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  // Présence en ligne/hors ligne
  onPresenceChange: (callback) => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on("presence-change", listener);
    return () => ipcRenderer.removeListener("presence-change", listener);
  },

  // Auto-updater : écoute les statuts (téléchargement, progression, etc.)
  onUpdaterStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("updater-status", listener);
    return () => ipcRenderer.removeListener("updater-status", listener);
  },

  // Déclenche une vérification manuelle depuis le renderer
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
});