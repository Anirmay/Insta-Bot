import { exec } from 'node:child_process';
import os from 'node:os';
import { getDb, logActivity } from './db.js';

export const INSTAGRAM_URLS = {
  HOMEPAGE: 'https://www.instagram.com/?hl=en',
  REELS: 'https://www.instagram.com/reels',
  LOGIN: 'https://www.instagram.com/accounts/login/'
};

export const ELECTRON_BRIDGE_URL = 'http://127.0.0.1:47830';

/**
 * Open any URL in the user's default browser safely without passwords
 */
export function openInDefaultBrowser(url) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') {
      return reject(new Error('Invalid URL provided'));
    }

    const trimmedUrl = url.trim();
    const platform = os.platform();
    let command = '';

    if (platform === 'win32') {
      command = `start "" "${trimmedUrl.replace(/"/g, '\\"')}"`;
    } else if (platform === 'darwin') {
      command = `open "${trimmedUrl.replace(/"/g, '\\"')}"`;
    } else {
      command = `xdg-open "${trimmedUrl.replace(/"/g, '\\"')}"`;
    }

    exec(command, (err) => {
      if (err) {
        logActivity('error', 'Failed to open browser URL', { url: trimmedUrl, error: err.message });
        return reject(err);
      }
      logActivity('info', 'Opened URL in default browser', { url: trimmedUrl });
      resolve({ success: true, url: trimmedUrl });
    });
  });
}

/**
 * Validate Instagram Reel URL format
 */
export function validateReelUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const pattern = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i;
  return pattern.test(url.trim());
}

/**
 * Extract Reel ID (shortcode) from URL
 */
export function extractReelId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(/instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Normalize Reel URL into canonical form: https://www.instagram.com/reel/<shortcode>/
 */
export function normalizeReelUrl(url) {
  const shortcode = extractReelId(url);
  if (!shortcode) return url ? url.trim() : '';
  return `https://www.instagram.com/reel/${shortcode}/`;
}

/**
 * Query Electron bridge to get live session cookie status if Electron is running
 */
export async function queryElectronBridgeSession() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${ELECTRON_BRIDGE_URL}/instagram/session`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { connected: true, ...data };
    }
  } catch (err) {
    // Electron bridge not running (e.g. running in web/server mode only)
  }
  return { connected: false };
}

/**
 * Check Instagram login state combining DB and Electron bridge
 */
export async function getInstagramSessionStatus() {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() || {};
  
  // Probe Electron bridge for real-time cookie session status
  const bridge = await queryElectronBridgeSession();
  
  let isLoggedIn = Boolean(settings.instagram_logged_in);
  let sessionStatus = settings.instagram_session_status || 'Disconnected';
  let username = settings.instagram_username || null;
  let lastChecked = settings.instagram_last_checked || null;

  if (bridge.connected) {
    isLoggedIn = Boolean(bridge.isLoggedIn);
    sessionStatus = bridge.status || (isLoggedIn ? 'Connected' : 'Login Required');
    username = bridge.username || username;
    lastChecked = new Date().toISOString();

    // Update DB with latest real status
    try {
      db.prepare(`
        UPDATE settings 
        SET instagram_logged_in = ?, instagram_session_status = ?, instagram_username = ?, instagram_last_checked = ?, updated_at = ?
        WHERE id = 1
      `).run(isLoggedIn ? 1 : 0, sessionStatus, username, lastChecked, lastChecked);
    } catch (e) {
      // Non-fatal
    }
  }

  return {
    isLoggedIn,
    sessionStatus, // 'Connected' | 'Disconnected' | 'Session Expired' | 'Login Required'
    username,
    lastChecked,
    isElectronBridgeActive: bridge.connected,
    homepageUrl: INSTAGRAM_URLS.HOMEPAGE,
    reelsUrl: INSTAGRAM_URLS.REELS,
    loginUrl: INSTAGRAM_URLS.LOGIN
  };
}

/**
 * Update Instagram session status in DB
 */
export function updateInstagramSessionStatus({ isLoggedIn, sessionStatus, username }) {
  const db = getDb();
  const now = new Date().toISOString();
  const loggedInVal = isLoggedIn ? 1 : 0;
  const statusStr = sessionStatus || (isLoggedIn ? 'Connected' : 'Disconnected');

  db.prepare(`
    UPDATE settings 
    SET instagram_logged_in = ?, 
        instagram_session_status = ?, 
        instagram_username = ?, 
        instagram_last_checked = ?, 
        updated_at = ? 
    WHERE id = 1
  `).run(loggedInVal, statusStr, username || null, now, now);

  logActivity('info', `Instagram session status updated: ${statusStr} (Logged In: ${isLoggedIn})`);
  return {
    isLoggedIn: Boolean(loggedInVal),
    sessionStatus: statusStr,
    username: username || null,
    lastChecked: now,
    homepageUrl: INSTAGRAM_URLS.HOMEPAGE,
    reelsUrl: INSTAGRAM_URLS.REELS
  };
}

/**
 * Request Electron bridge to launch dedicated official login window
 */
export async function launchElectronLogin() {
  try {
    const res = await fetch(`${ELECTRON_BRIDGE_URL}/instagram/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json();
    throw new Error(err.error || 'Failed to open Electron login window');
  } catch (err) {
    // If bridge is not active, fallback to opening official login in default browser
    await openInDefaultBrowser(INSTAGRAM_URLS.LOGIN);
    return {
      success: true,
      fallbackBrowser: true,
      message: 'Opened Instagram login in default web browser.'
    };
  }
}

/**
 * Request Electron bridge to logout and clear session data
 */
export async function logoutElectronSession() {
  try {
    const res = await fetch(`${ELECTRON_BRIDGE_URL}/instagram/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      updateInstagramSessionStatus({ isLoggedIn: false, sessionStatus: 'Disconnected' });
      return data;
    }
  } catch (err) {
    // Bridge not connected
  }
  return updateInstagramSessionStatus({ isLoggedIn: false, sessionStatus: 'Disconnected' });
}

export default {
  INSTAGRAM_URLS,
  ELECTRON_BRIDGE_URL,
  openInDefaultBrowser,
  validateReelUrl,
  extractReelId,
  normalizeReelUrl,
  queryElectronBridgeSession,
  getInstagramSessionStatus,
  updateInstagramSessionStatus,
  launchElectronLogin,
  logoutElectronSession
};
