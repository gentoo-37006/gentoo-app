const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, net, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const APP_ORIGIN = 'gentoo://app';
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

function checkForUpdates() {
  if (!app.isPackaged) return;
  if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Beta builds ship a `-beta.<date>` prerelease version: track the beta feed
  // and accept prereleases so they self-update from published beta builds.
  // Stable builds keep the default 'latest' channel and ignore betas.
  if (app.getVersion().includes('-beta')) {
    autoUpdater.channel = 'beta';
    autoUpdater.allowPrerelease = true;
  }
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.warn('[updates] check failed', error);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 390,
    minHeight: 700,
    title: 'Gentoo',
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;

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
