const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#090d16',
    title: 'ReelAI Comment Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
  mainWindow.loadURL(startUrl).catch((err) => {
    console.warn('[Electron] Initial page load pending dev server, retrying in 1s...', err.message);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(startUrl).catch(e => console.error('[Electron] Page load error:', e.message));
      }
    }, 1000);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register safeStorage IPC handlers
ipcMain.handle('safeStorage:isAvailable', () => {
  return safeStorage.isEncryptionAvailable();
});

ipcMain.handle('safeStorage:encrypt', (event, plainText) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS safeStorage encryption is not available.');
  }
  const buffer = safeStorage.encryptString(plainText);
  return buffer.toString('base64');
});

ipcMain.handle('safeStorage:decrypt', (event, base64Cipher) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS safeStorage encryption is not available.');
  }
  const buffer = Buffer.from(base64Cipher, 'base64');
  return safeStorage.decryptString(buffer);
});

ipcMain.handle('shell:openExternal', (event, url) => {
  return shell.openExternal(url);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
