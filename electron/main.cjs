const { app, BrowserWindow, session, Menu, Tray, nativeImage, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

// --- Instance unique ---
// Si Shift tourne déjà (même en arrière-plan / réduit dans le tray) et que
// l'utilisateur relance l'app, on ne veut pas ouvrir une deuxième instance :
// on redonne juste le focus à la fenêtre existante. `requestSingleInstanceLock`
// renvoie `false` dans CE process si un autre process a déjà le verrou ; dans
// ce cas, ce nouveau process n'a plus rien à faire, on le ferme aussitôt.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  return;
}

// Déclenché dans le PREMIER process (celui qui a le verrou) quand une
// deuxième tentative de lancement est détectée.
app.on("second-instance", () => {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
});

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

// On charge l'icône UNE FOIS ici, via nativeImage.createFromPath : cette
// fonction lit le fichier à travers le système de fichiers virtuel d'asar
// (donc ça marche même packagé dans app.asar). À l'inverse, passer un
// simple chemin (string) à win.setIcon() sur Windows fait lire le fichier
// directement par l'OS, qui ne sait pas lire dans app.asar → ça plante
// avec "Failed to load image from path ...app.asar\public\shift-logo.png".
// On réutilise ensuite ce même objet nativeImage partout (fenêtre + tray).
let appIcon = null;
try {
  const img = nativeImage.createFromPath(iconPath);
  if (!img.isEmpty()) {
    appIcon = img;
  } else {
    log.warn(`Icône introuvable ou illisible : ${iconPath}`);
  }
} catch (err) {
  log.error("Impossible de charger l'icône de l'application :", err);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: "#1e1f22",
    ...(appIcon ? { icon: appIcon } : {}),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Force explicitement l'icône une fois la fenêtre créée : sur Windows,
  // ne compter que sur l'option `icon` du constructeur peut, selon le cache
  // d'icônes de l'explorateur, faire apparaître l'icône de la barre des
  // tâches de façon aléatoire (un lancement sur deux). L'appel explicite à
  // setIcon() force Windows à la réappliquer à chaque démarrage. On lui
  // passe l'objet nativeImage déjà chargé, jamais un chemin brut.
  if (appIcon) {
    win.setIcon(appIcon);
  }

  // On n'affiche la fenêtre (et donc son icône dans la barre des tâches)
  // qu'une fois le contenu prêt, plutôt que dès sa création, pour éviter un
  // flash de fenêtre vide. MAIS on ne veut jamais laisser l'utilisateur
  // devant rien du tout si "ready-to-show" met du temps à se déclencher
  // (chargement de l'app, vérification du compte au démarrage, etc.) :
  // au bout de 3s maximum, on affiche la fenêtre de toute façon.
  let windowShown = false;
  const showWindowOnce = () => {
    if (windowShown) return;
    windowShown = true;
    win.show();
  };
  win.once("ready-to-show", showWindowOnce);
  setTimeout(showWindowOnce, 3000);

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
  if (!appIcon) {
    log.warn("Pas d'icône disponible : le tray ne sera pas créé.");
    return;
  }
  const trayIcon = appIcon.resize({ width: 16, height: 16 });
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

// On ne veut retarder la fermeture QU'UNE SEULE FOIS (le temps d'avertir le
// renderer qu'on part), pas à chaque appel de app.quit(). L'ancienne version
// réinitialisait `quitTimer` à `null` juste avant de rappeler app.quit(),
// ce qui refaisait entrer avant-quit dans le même if et redemandait un délai
// indéfiniment : en pratique, il fallait cliquer deux fois sur "Quitter"
// (voire plus) pour que l'appli se ferme vraiment. `hasDelayedQuit` garantit
// qu'on n'intercepte la fermeture qu'une fois.
let hasDelayedQuit = false;
app.on("before-quit", (event) => {
  isQuitting = true;

  if (!hasDelayedQuit && mainWindow && !mainWindow.webContents.isDestroyed()) {
    hasDelayedQuit = true;
    event.preventDefault();
    mainWindow.webContents.send("presence-change", false);
    setTimeout(() => {
      app.quit();
    }, 600);
  }
  // Deuxième passage (déclenché par le app.quit() ci-dessus) : on ne fait
  // plus rien, ce qui laisse Electron fermer l'application pour de vrai.
});