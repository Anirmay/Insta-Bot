import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { 
  validateReelUrl, 
  normalizeReelUrl, 
  extractReelId,
  ELECTRON_BRIDGE_URL,
  getInstagramSessionStatus
} from './instagram.js';
import { getVideoMetadata } from './videoProcessor.js';
import { logActivity, getDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REELS_VIDEO_DIR = path.resolve(__dirname, '../uploads/reels');
if (!fs.existsSync(REELS_VIDEO_DIR)) {
  fs.mkdirSync(REELS_VIDEO_DIR, { recursive: true });
}

/**
 * Dedicated Reel Content Retrieval Service
 * 
 * Truthful pipeline:
 * 1. Validate & normalize URL
 * 2. Check Instagram connection
 * 3. Attempt automatic retrieval via permitted Electron browser session
 * 4. Verify that retrieved file is genuinely a video container (via FFmpeg)
 * 5. Update SQLite with retrieval status and video metadata
 */
export async function retrieveReelVideo({ reelId, url }) {
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      status: 'error',
      reason: 'Analysis Failed',
      message: 'Invalid or missing Reel URL.'
    };
  }

  // 1. Validate URL
  if (!validateReelUrl(url)) {
    return {
      success: false,
      status: 'error',
      reason: 'Analysis Failed',
      message: 'Malformed Instagram Reel URL. Please provide a standard Reel link (e.g. https://www.instagram.com/reel/C3b4xyZ/).'
    };
  }

  const normalizedUrl = normalizeReelUrl(url);
  const shortcode = extractReelId(url);

  logActivity('info', `Checking Reel access for: ${normalizedUrl}`, { reelId, shortcode });

  // 2. Check Instagram session state
  const session = await getInstagramSessionStatus();

  // 3. Request video retrieval via Electron bridge
  try {
    const bridgeRes = await fetch(`${ELECTRON_BRIDGE_URL}/instagram/retrieve-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reelId,
        url: normalizedUrl,
        shortcode,
        destinationDir: REELS_VIDEO_DIR
      })
    });

    if (!bridgeRes.ok) {
      const errData = await bridgeRes.json().catch(() => ({}));
      const reason = errData.reason || 'Reel Not Accessible';
      const status = reason === 'Authentication Required' ? 'auth_required' : 'not_accessible';
      
      logActivity('warning', `Reel access denied or unavailable: ${reason}`, {
        url: normalizedUrl,
        reason,
        details: errData.error || errData.message
      });

      return {
        success: false,
        status,
        reason,
        message: errData.error || errData.message || 'Instagram did not provide accessible video content.'
      };
    }

    const bridgeData = await bridgeRes.json();

    if (!bridgeData.success || !bridgeData.filePath || !fs.existsSync(bridgeData.filePath)) {
      const reason = bridgeData.reason || 'Reel Not Accessible';
      const status = reason === 'Authentication Required' ? 'auth_required' : 'not_accessible';
      return {
        success: false,
        status,
        reason,
        message: bridgeData.message || 'Instagram did not provide accessible video content.'
      };
    }

    // 4. Verify that retrieved file is genuinely a video container (duration, dimensions)
    const metadata = await getVideoMetadata(bridgeData.filePath);
    if (!metadata || metadata.durationSeconds <= 0 || (metadata.width === 0 && metadata.height === 0)) {
      // Not a valid video stream
      try { fs.unlinkSync(bridgeData.filePath); } catch (e) {}
      return {
        success: false,
        status: 'error',
        reason: 'Analysis Failed',
        message: 'The retrieved stream could not be decoded as a valid video file.'
      };
    }

    const stat = fs.statSync(bridgeData.filePath);
    const filename = path.basename(bridgeData.filePath);

    logActivity('success', `Retrieved real video content for Reel [${shortcode}]: ${metadata.durationSeconds}s, ${metadata.width}x${metadata.height}, ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

    return {
      success: true,
      status: 'video_retrieved',
      videoPath: bridgeData.filePath,
      videoFilename: filename,
      videoMime: 'video/mp4',
      videoSize: stat.size,
      videoDuration: metadata.durationSeconds,
      dimensions: `${metadata.width}x${metadata.height}`,
      hasAudio: metadata.hasAudio
    };

  } catch (bridgeErr) {
    // If Electron bridge is not running, check if session is missing
    if (!session.isElectronBridgeActive) {
      const msg = session.isLoggedIn
        ? 'Desktop application session bridge is offline. Please launch ReelAI desktop app to retrieve Instagram video streams.'
        : 'Instagram account connection is required to retrieve Reel video streams. Please connect your account in the Instagram Account tab.';
      
      return {
        success: false,
        status: session.isLoggedIn ? 'not_accessible' : 'auth_required',
        reason: session.isLoggedIn ? 'Reel Not Accessible' : 'Authentication Required',
        message: msg
      };
    }

    return {
      success: false,
      status: 'error',
      reason: 'Analysis Failed',
      message: `Failed to communicate with Instagram retrieval service: ${bridgeErr.message}`
    };
  }
}

export default {
  retrieveReelVideo,
  REELS_VIDEO_DIR
};
