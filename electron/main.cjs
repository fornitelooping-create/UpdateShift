const { app, BrowserWindow, session, Menu, Tray, nativeImage, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

// --- Logs de l'updater ---
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

Menu.setApplicationMenu(null);

let mainWindow = null;
let tray = null;
let isQuitting = false;

const iconPath = path.join(__dirname, "../public/shift-logo.png");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: "#1e1f22",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["media", "microphone", "audioCapture"].includes(permission));
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
    return false;
  });

  win.on("minimize", (event) => {
    event.preventDefault();
    win.hide();
  });

  const notifyPresence = (visible) => {
    if (win.webContents.isDestroyed?.()) return;
    win.webContents.send("presence-change", visible);
  };

  win.on("hide", () => notifyPresence(false));
  win.on("minimize", () => notifyPresence(false));
  win.on("blur", () => notifyPresence(false));
  win.on("show", () => notifyPresence(true));
  win.on("restore", () => notifyPresence(true));
  win.on("focus", () => notifyPresence(true));

  mainWindow = win;
  return win;
}

// --- Envoie un événement updater au renderer ---
function sendUpdaterEvent(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater-status", { event, data });
  }
}

// --- Événements autoUpdater ---
autoUpdater.on("checking-for-update", () => {
  sendUpdaterEvent("checking-for-update");
});

autoUpdater.on("update-available", (info) => {
  sendUpdaterEvent("update-available", { version: info.version });
});

autoUpdater.on("update-not-available", () => {
  sendUpdaterEvent("update-not-available");
});

autoUpdater.on("error", (err) => {
  log.error("Erreur updater:", err);
  sendUpdaterEvent("error", err?.message);
});

autoUpdater.on("download-progress", (progress) => {
  sendUpdaterEvent("download-progress", { percent: Math.round(progress.percent) });
});

autoUpdater.on("update-downloaded", (info) => {
  sendUpdaterEvent("update-downloaded", { version: info.version });

  dialog.showMessageBox({
    type: "info",
    buttons: ["Redémarrer", "Plus tard"],
    title: "Mise à jour disponible",
    message: `La version ${info.version} est prête.`,
    detail: "Redémarrer maintenant pour appliquer la mise à jour ?",
  }).then((result) => {
    if (result.response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });
});

// --- IPC : vérification manuelle depuis le renderer ---
ipcMain.handle("check-for-updates", async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function createTray() {
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip("Shift");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Ouvrir Shift",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quitter",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });

  if (!isDev) {
    // Vérifie au démarrage, puis toutes les 10 minutes
    setTimeout(() => autoUpdater.checkForUpdates(), 5000);
    setInterval(() => autoUpdater.checkForUpdates(), 10 * 60 * 1000);
  }
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

let quitTimer = null;
app.on("before-quit", (event) => {
  isQuitting = true;

  if (!quitTimer && mainWindow && !mainWindow.webContents.isDestroyed()) {
    event.preventDefault();
    mainWindow.webContents.send("presence-change", false);
    quitTimer = setTimeout(() => {
      quitTimer = null;
      app.quit();
    }, 600);
  }
});