import { exec } from 'node:child_process';
import os from 'node:os';
import { getDb, logActivity } from './db.js';

export const INSTAGRAM_URLS = {
  HOMEPAGE: 'https://www.instagram.com/?hl=en',
  REELS: 'https://www.instagram.com/reels'
};

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
 * Extract Reel ID from URL
 */
export function extractReelId(url) {
  if (!url) return null;
  const match = url.trim().match(/instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Checks whether direct video content can be acquired through permitted methods.
 * Instagram restricts unauthenticated video stream downloads with login walls and expiring CDN tokens.
 */
export async function checkInstagramDirectAccess(url) {
  if (!validateReelUrl(url)) {
    return {
      isValidUrl: false,
      directVideoAvailable: false,
      message: 'Invalid Instagram Reel URL format.'
    };
  }

  // Permitted Instagram direct access check:
  // Instagram public web pages redirect anonymous automated scrapers to login screens (/accounts/login/).
  // Thus, permitted direct video extraction requires user-uploaded video files.
  return {
    isValidUrl: true,
    directVideoAvailable: false,
    reason: 'Instagram requires user session cookies and protects video CDNs. Automated direct downloading without user login is unavailable.',
    actionRequired: 'upload_video'
  };
}

/**
 * Check or set Instagram login state in DB
 */
export function getInstagramSessionStatus() {
  const db = getDb();
  const settings = db.prepare('SELECT instagram_logged_in FROM settings WHERE id = 1').get();
  return {
    isLoggedIn: Boolean(settings?.instagram_logged_in),
    homepageUrl: INSTAGRAM_URLS.HOMEPAGE,
    reelsUrl: INSTAGRAM_URLS.REELS
  };
}

export function updateInstagramSessionStatus(isLoggedIn) {
  const db = getDb();
  const val = isLoggedIn ? 1 : 0;
  db.prepare('UPDATE settings SET instagram_logged_in = ?, updated_at = ? WHERE id = 1').run(
    val,
    new Date().toISOString()
  );
  logActivity('info', `Instagram login status updated: ${isLoggedIn ? 'Logged In' : 'Not Logged In'}`);
  return getInstagramSessionStatus();
}

export default {
  INSTAGRAM_URLS,
  openInDefaultBrowser,
  validateReelUrl,
  extractReelId,
  checkInstagramDirectAccess,
  getInstagramSessionStatus,
  updateInstagramSessionStatus
};
