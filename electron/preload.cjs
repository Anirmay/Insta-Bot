const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  safeStorage: {
    isAvailable: () => ipcRenderer.invoke('safeStorage:isAvailable'),
    encrypt: (plain) => ipcRenderer.invoke('safeStorage:encrypt', plain),
    decrypt: (b64) => ipcRenderer.invoke('safeStorage:decrypt', b64)
  }
});
