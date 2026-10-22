const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  safeStorage: {
    isAvailable: () => ipcRenderer.invoke('safeStorage:isAvailable'),
    encrypt: (plain) => ipcRenderer.invoke('safeStorage:encrypt', plain),
    decrypt: (b64) => ipcRenderer.invoke('safeStorage:decrypt', b64)
  },
  instagram: {
    checkSession: () => ipcRenderer.invoke('instagram:checkSession'),
    login: () => ipcRenderer.invoke('instagram:login'),
    logout: () => ipcRenderer.invoke('instagram:logout'),
    retrieveVideo: (payload) => ipcRenderer.invoke('instagram:retrieveVideo', payload),
    onSessionChanged: (callback) => {
      const listener = (event, status) => callback(status);
      ipcRenderer.on('instagram:sessionChanged', listener);
      return () => ipcRenderer.removeListener('instagram:sessionChanged', listener);
    }
  }
});
