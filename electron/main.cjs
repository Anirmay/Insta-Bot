const { app, BrowserWindow, shell, ipcMain, safeStorage, session, net } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let loginWindow = null;
let bridgeServer = null;

const BRIDGE_PORT = 47830;
const INSTAGRAM_PARTITION = 'persist:instagram';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function getInstagramSession() {
  return session.fromPartition(INSTAGRAM_PARTITION);
}

/**
 * Inspect cookies in isolated partition to verify Instagram session
 */
async function checkInstagramSessionStatus() {
  const ses = getInstagramSession();
  try {
    const cookies = await ses.cookies.get({ domain: '.instagram.com' });
    const sessionCookie = cookies.find((c) => c.name === 'sessionid');
    const userCookie = cookies.find((c) => c.name === 'ds_user_id');

    if (!sessionCookie) {
      return {
        status: 'Disconnected',
        isLoggedIn: false,
        username: null,
        userId: null,
        cookiesCount: cookies.length,
        lastChecked: new Date().toISOString()
      };
    }

    const nowSec = Date.now() / 1000;
    if (sessionCookie.expirationDate && sessionCookie.expirationDate < nowSec) {
      return {
        status: 'Session Expired',
        isLoggedIn: false,
        username: null,
        userId: userCookie ? userCookie.value : null,
        cookiesCount: cookies.length,
        lastChecked: new Date().toISOString()
      };
    }

    return {
      status: 'Connected',
      isLoggedIn: true,
      username: null,
      userId: userCookie ? userCookie.value : null,
      cookiesCount: cookies.length,
      lastChecked: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: 'Disconnected',
      isLoggedIn: false,
      error: err.message,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Open dedicated official Instagram login window
 */
function openInstagramLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return Promise.resolve({ success: true, alreadyOpen: true });
  }

  const ses = getInstagramSession();
  ses.setUserAgent(DESKTOP_USER_AGENT);

  loginWindow = new BrowserWindow({
    width: 520,
    height: 740,
    minWidth: 420,
    minHeight: 600,
    title: 'Instagram Login — ReelAI Comment Assistant',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    webPreferences: {
      partition: INSTAGRAM_PARTITION,
      contextIsolation: true
    }
  });

  loginWindow.loadURL('https://www.instagram.com/accounts/login/');

  // Monitor cookies to detect successful login
  const cookieListener = async (event, cookie, cause, removed) => {
    if (!removed && cookie.domain.includes('instagram.com') && cookie.name === 'sessionid') {
      console.log('[Electron] Detected Instagram session cookie! User authenticated.');
      const status = await checkInstagramSessionStatus();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('instagram:sessionChanged', status);
      }
    }
  };

  ses.cookies.on('changed', cookieListener);

  loginWindow.on('closed', () => {
    ses.cookies.removeListener('changed', cookieListener);
    loginWindow = null;
    checkInstagramSessionStatus().then((status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('instagram:sessionChanged', status);
      }
    });
  });

  return Promise.resolve({ success: true, opened: true });
}

/**
 * Disconnect and clear Instagram session data
 */
async function logoutInstagramSession() {
  const ses = getInstagramSession();
  await ses.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'cachestorage']
  });

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }

  const status = await checkInstagramSessionStatus();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('instagram:sessionChanged', status);
  }
  return status;
}

/**
 * Dedicated offscreen Reel content retriever using authenticated Electron session
 */
async function retrieveReelVideoContent({ url, reelId, shortcode, destinationDir }) {
  const ses = getInstagramSession();
  ses.setUserAgent(DESKTOP_USER_AGENT);

  const targetFolder = destinationDir || path.resolve(__dirname, '../uploads/reels');
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  const destinationFile = path.join(targetFolder, `${reelId}.mp4`);

  return new Promise(async (resolve) => {
    let isSettled = false;
    let interceptedVideoUrl = null;
    let offscreenWin = null;

    const cleanup = () => {
      if (offscreenWin && !offscreenWin.isDestroyed()) {
        try {
          offscreenWin.destroy();
        } catch (e) {}
      }
      offscreenWin = null;
    };

    const finish = (result) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(result);
    };

    // Timeout after 20 seconds
    const timeoutId = setTimeout(() => {
      finish({
        success: false,
        reason: 'Reel Not Accessible',
        message: 'Instagram request timed out before video stream could be captured.'
      });
    }, 20000);

    try {
      offscreenWin = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false, // background execution
        webPreferences: {
          partition: INSTAGRAM_PARTITION,
          contextIsolation: true
        }
      });

      // Intercept media stream requests
      ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        const reqUrl = details.url;
        if (
          !interceptedVideoUrl &&
          (reqUrl.includes('.mp4') ||
            (reqUrl.includes('cdninstagram.com') && reqUrl.includes('/v/t50.')) ||
            (reqUrl.includes('fbcdn.net') && reqUrl.includes('.mp4')))
        ) {
          interceptedVideoUrl = reqUrl;
          console.log('[Electron Retriever] Intercepted video stream URL:', reqUrl.substring(0, 100));
        }
        callback({ cancel: false });
      });

      offscreenWin.webContents.on('did-navigate', (event, navUrl) => {
        if (navUrl.includes('/accounts/login')) {
          clearTimeout(timeoutId);
          finish({
            success: false,
            reason: 'Authentication Required',
            message: 'Instagram requires login to view this Reel. Please connect your Instagram account.'
          });
        }
      });

      await offscreenWin.loadURL(url);

      // Allow SPA scripts to bootstrap and trigger video buffering
      const checkInterval = setInterval(async () => {
        if (isSettled) {
          clearInterval(checkInterval);
          return;
        }

        try {
          if (!offscreenWin || offscreenWin.isDestroyed()) {
            clearInterval(checkInterval);
            return;
          }

          // Evaluate DOM state
          const pageState = await offscreenWin.webContents.executeJavaScript(`
            (() => {
              const video = document.querySelector('video');
              const isLogin = document.location.pathname.includes('/login') || Boolean(document.querySelector('input[name="password"]'));
              const notAvailable = document.body ? (
                document.body.innerText.includes("Sorry, this page isn't available") ||
                document.body.innerText.includes("Post isn't available") ||
                document.body.innerText.includes("The link you followed may be broken")
              ) : false;
              return {
                videoSrc: video ? (video.currentSrc || video.src) : null,
                isLogin,
                notAvailable,
                title: document.title
              };
            })()
          `);

          if (pageState.isLogin) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            return finish({
              success: false,
              reason: 'Authentication Required',
              message: 'Instagram requires login to access this Reel.'
            });
          }

          if (pageState.notAvailable) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            return finish({
              success: false,
              reason: 'Reel Not Accessible',
              message: 'Instagram reported that this Reel is unavailable, private, or deleted.'
            });
          }

          const streamUrl = interceptedVideoUrl || pageState.videoSrc;

          if (streamUrl && streamUrl.startsWith('http')) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            console.log('[Electron Retriever] Downloading video stream from:', streamUrl.substring(0, 100));

            // Stream download using net.fetch
            const res = await net.fetch(streamUrl, {
              headers: {
                'User-Agent': DESKTOP_USER_AGENT,
                Referer: 'https://www.instagram.com/'
              }
            });

            if (!res.ok) {
              return finish({
                success: false,
                reason: 'Analysis Failed',
                message: `Failed to download video stream (HTTP ${res.status}).`
              });
            }

            const arrayBuf = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);

            if (buffer.length < 10000) {
              return finish({
                success: false,
                reason: 'Analysis Failed',
                message: 'Downloaded video stream payload is empty or corrupt.'
              });
            }

            fs.writeFileSync(destinationFile, buffer);
            console.log(`[Electron Retriever] Saved ${(buffer.length / (1024 * 1024)).toFixed(2)} MB video to ${destinationFile}`);

            return finish({
              success: true,
              filePath: destinationFile,
              sizeBytes: buffer.length
            });
          }
        } catch (evalErr) {
          // Window may be navigating
        }
      }, 1000);

    } catch (loadErr) {
      clearTimeout(timeoutId);
      finish({
        success: false,
        reason: 'Analysis Failed',
        message: `Failed to load Reel page: ${loadErr.message}`
      });
    }
  });
}

/**
 * Start lightweight local HTTP bridge server for communication with Express backend
 */
function startBridgeServer() {
  bridgeServer = http.createServer(async (req, res) => {
    // Enable CORS for localhost
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://127.0.0.1:${BRIDGE_PORT}`);

    if (parsedUrl.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, isElectron: true }));
    }

    if (parsedUrl.pathname === '/instagram/session' && req.method === 'GET') {
      const status = await checkInstagramSessionStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(status));
    }

    if (parsedUrl.pathname === '/instagram/login' && req.method === 'POST') {
      const result = await openInstagramLoginWindow();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    }

    if (parsedUrl.pathname === '/instagram/logout' && req.method === 'POST') {
      const result = await logoutInstagramSession();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    }

    if (parsedUrl.pathname === '/instagram/retrieve-video' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = await retrieveReelVideoContent(payload);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  bridgeServer.listen(BRIDGE_PORT, '127.0.0.1', () => {
    console.log(`[Electron Bridge] Listening on http://127.0.0.1:${BRIDGE_PORT}`);
  });

  bridgeServer.on('error', (err) => {
    console.warn('[Electron Bridge] Server port bind warning:', err.message);
  });
}

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
        mainWindow.loadURL(startUrl).catch((e) => console.error('[Electron] Page load error:', e.message));
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

// Instagram Session IPC handlers
ipcMain.handle('instagram:checkSession', async () => {
  return await checkInstagramSessionStatus();
});

ipcMain.handle('instagram:login', async () => {
  return await openInstagramLoginWindow();
});

ipcMain.handle('instagram:logout', async () => {
  return await logoutInstagramSession();
});

ipcMain.handle('instagram:retrieveVideo', async (event, payload) => {
  return await retrieveReelVideoContent(payload);
});

app.whenReady().then(() => {
  startBridgeServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (bridgeServer) {
    try {
      bridgeServer.close();
    } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
