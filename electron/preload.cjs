const { contextBridge, ipcRenderer } = require('electron');

// Minimal bridge between the desktop shell and the web app. The web side types
// and consumes this in src/lib/desktop-updates.ts.
contextBridge.exposeInMainWorld('gentooDesktop', {
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('updates:status', listener);
    return () => ipcRenderer.removeListener('updates:status', listener);
  },
});
