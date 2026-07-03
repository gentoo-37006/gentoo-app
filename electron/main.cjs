const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const APP_ORIGIN = 'gentoo://app';
// Beta builds carry a `-beta.<date>` prerelease version; brand the shell as
// "Gentoo Beta" so it's distinguishable from the stable app.
const IS_BETA = app.getVersion().includes('-beta');
const APP_NAME = IS_BETA ? 'Gentoo Beta' : 'Gentoo';
let mainWindow = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'gentoo',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function resolveDistPath(url) {
  const requestPath = new URL(url).pathname;
  const relativePath = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath.slice(1));
  const filePath = path.normalize(path.join(DIST_DIR, relativePath));

  if (!filePath.startsWith(DIST_DIR)) {
    return path.join(DIST_DIR, 'index.html');
  }

  return filePath;
}

function registerAppProtocol() {
  protocol.handle('gentoo', (request) => {
    const filePath = resolveDistPath(request.url);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// ---- Auto-update ------------------------------------------------------------
// The source repo is private, so GitHub's public feed URLs 404. Instead the
// Supabase `downloads` Edge Function (which holds the GitHub token) serves the
// electron-updater feed. Stable and beta builds read separate channel paths, so
// each only ever sees its own releases. The updater's own channel stays
// "latest" — the Edge Function maps that onto whichever feed file the release
// actually carries.
const UPDATE_FEED_URL =
  'https://exmnnotfwebdxjpkvuxu.supabase.co/functions/v1/downloads/updates/' +
  (IS_BETA ? 'beta' : 'stable');

let updateStatus = { state: app.isPackaged ? 'idle' : 'unsupported', version: app.getVersion() };
let nextVersion = null;

function setUpdateStatus(next) {
  updateStatus = { version: app.getVersion(), ...next };
  mainWindow?.webContents.send('updates:status', updateStatus);
}

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL, channel: 'latest' });

  autoUpdater.on('checking-for-update', () => setUpdateStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    nextVersion = info?.version ?? null;
    setUpdateStatus({ state: 'downloading', next: nextVersion, percent: 0 });
  });
  autoUpdater.on('download-progress', (progress) => {
    setUpdateStatus({ state: 'downloading', next: nextVersion, percent: Math.round(progress?.percent ?? 0) });
  });
  autoUpdater.on('update-not-available', () => setUpdateStatus({ state: 'up-to-date' }));
  autoUpdater.on('update-downloaded', (info) => {
    setUpdateStatus({ state: 'downloaded', next: info?.version ?? nextVersion });
  });
  autoUpdater.on('error', (error) => {
    setUpdateStatus({ state: 'error', message: error?.message ?? String(error) });
  });
}

function checkForUpdates() {
  // Dev runs (unpackaged) have nothing to update into.
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch((error) => {
    console.warn('[updates] check failed', error);
  });
}

ipcMain.handle('updates:get-state', () => updateStatus);
ipcMain.handle('updates:check', () => {
  checkForUpdates();
  return updateStatus;
});
ipcMain.handle('updates:install', () => {
  autoUpdater.quitAndInstall();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 390,
    minHeight: 700,
    title: APP_NAME,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow = win;

  // Keep the OS window title as the app name; don't let the web page reset it to "Gentoo".
  win.webContents.on('page-title-updated', (event) => event.preventDefault());

  win.removeMenu();
  win.loadURL(`${APP_ORIGIN}/`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_ORIGIN)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

function openAppUrl(url) {
  if (!url.startsWith(APP_ORIGIN)) return;

  if (mainWindow) {
    mainWindow.loadURL(url);
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  createWindow();
  mainWindow?.loadURL(url);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(APP_ORIGIN));
    if (url) openAppUrl(url);
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  openAppUrl(url);
});

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient('gentoo');
  registerAppProtocol();
  configureUpdater();
  createWindow();
  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
