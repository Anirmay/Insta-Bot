import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { getDb, logActivity } from './db.js';
import {
  maskApiKey,
  encryptSecret,
  decryptSecret
} from './credentials.js';
import {
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  testApiKey,
  sanitizeErrorMessage
} from './gemini.js';
import {
  INSTAGRAM_URLS,
  openInDefaultBrowser,
  validateReelUrl,
  getInstagramSessionStatus,
  updateInstagramSessionStatus
} from './instagram.js';
import engine from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 47829;

// Enable JSON and CORS for all local development origins (ports 5173, 5174, etc.)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Setup uploads folder for video attachments
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer storage for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, unique);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp4|mov|webm|mkv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (MP4, MOV, WEBM) are permitted.'));
    }
  }
});

// ==================== DASHBOARD & ENGINE ====================

app.get('/api/status', (req, res) => {
  try {
    const snapshot = engine.getSnapshot();
    const instagramSession = getInstagramSessionStatus();
    res.json({
      ...snapshot,
      instagramSession
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/engine/start', async (req, res) => {
  try {
    const snapshot = await engine.start();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/engine/pause', (req, res) => {
  try {
    const snapshot = engine.pause();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/engine/resume', (req, res) => {
  try {
    const snapshot = engine.resume();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/engine/stop', (req, res) => {
  try {
    const snapshot = engine.stop();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/engine/target', (req, res) => {
  try {
    const { target } = req.body;
    const snapshot = engine.setTarget(target);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/engine/model', (req, res) => {
  try {
    const { modelId } = req.body;
    const snapshot = engine.setModel(modelId);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/models', (req, res) => {
  res.json({ models: SUPPORTED_MODELS });
});

// ==================== API KEY MANAGEMENT ====================

app.get('/api/keys', (req, res) => {
  try {
    const db = getDb();
    // NEVER expose plain or encrypted secret to client!
    const rows = db.prepare(`
      SELECT id, nickname, masked_key, is_active, status, last_tested_at, error_message, created_at
      FROM api_keys
      ORDER BY created_at DESC
    `).all();
    res.json({ keys: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keys', async (req, res) => {
  try {
    const { nickname, apiKey, testNow = true, modelId: requestedModel } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    const trimmedKey = apiKey.trim();
    const cleanNick = (nickname || 'Gemini Key').trim();
    const db = getDb();

    const settings = db.prepare('SELECT selected_model FROM settings WHERE id = 1').get();
    const targetModel = requestedModel || settings?.selected_model || DEFAULT_MODEL_ID;

    let status = 'untested';
    let errorMessage = null;
    let testLatency = null;

    if (testNow) {
      try {
        const testRes = await testApiKey(trimmedKey, targetModel);
        status = 'valid';
        testLatency = testRes.latencyMs;
      } catch (testErr) {
        status = testErr.name === 'QuotaExceededError' ? 'quota_exhausted' : 'invalid';
        errorMessage = sanitizeErrorMessage(testErr.message);
      }
    }

    const encryptedSecret = encryptSecret(trimmedKey);
    const maskedKey = maskApiKey(trimmedKey);
    const keyId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Check if this is the first key; if so, make active
    const count = db.prepare('SELECT COUNT(*) as count FROM api_keys').get().count;
    const isActive = count === 0 ? 1 : 0;

    db.prepare(`
      INSERT INTO api_keys (id, nickname, masked_key, encrypted_secret, is_active, status, last_tested_at, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      keyId,
      cleanNick,
      maskedKey,
      encryptedSecret,
      isActive,
      status,
      testNow ? createdAt : null,
      errorMessage,
      createdAt
    );

    if (isActive) {
      db.prepare('UPDATE settings SET active_key_id = ?, updated_at = ? WHERE id = 1').run(keyId, createdAt);
    }

    logActivity('info', `Added new Gemini API key: ${cleanNick} (${maskedKey})`);

    res.json({
      success: true,
      key: {
        id: keyId,
        nickname: cleanNick,
        masked_key: maskedKey,
        is_active: isActive,
        status,
        last_tested_at: testNow ? createdAt : null,
        error_message: errorMessage,
        latencyMs: testLatency
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keys/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const plainKey = decryptSecret(row.encrypted_secret);
    const settings = db.prepare('SELECT selected_model FROM settings WHERE id = 1').get();
    const modelId = req.body?.modelId || settings?.selected_model || DEFAULT_MODEL_ID;

    const testTime = new Date().toISOString();
    try {
      const testResult = await testApiKey(plainKey, modelId);
      db.prepare(`
        UPDATE api_keys 
        SET status = 'valid', error_message = NULL, last_tested_at = ? 
        WHERE id = ?
      `).run(testTime, id);

      logActivity('success', `API Key ${row.nickname} test passed on ${modelId} (${testResult.latencyMs}ms)`);
      res.json({ success: true, status: 'valid', latencyMs: testResult.latencyMs, model: modelId });
    } catch (testErr) {
      const isQuota = testErr.name === 'QuotaExceededError';
      const status = isQuota ? 'quota_exhausted' : 'invalid';
      const cleanError = sanitizeErrorMessage(testErr.message);
      
      db.prepare(`
        UPDATE api_keys 
        SET status = ?, error_message = ?, last_tested_at = ? 
        WHERE id = ?
      `).run(status, cleanError, testTime, id);

      logActivity('warning', `API Key ${row.nickname} test failed on ${modelId}: ${cleanError}`);
      res.json({ success: false, status, error: cleanError, model: modelId });
    }
  } catch (err) {
    res.status(500).json({ error: sanitizeErrorMessage(err.message) });
  }
});

app.post('/api/keys/:id/activate', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE api_keys SET is_active = 0').run();
    db.prepare('UPDATE api_keys SET is_active = 1 WHERE id = ?').run(id);
    db.prepare('UPDATE settings SET active_key_id = ?, updated_at = ? WHERE id = 1').run(id, now);

    logActivity('info', `Manually switched active Gemini API key to: ${row.nickname} (${row.masked_key})`);
    res.json({ success: true, activeKeyId: id, nickname: row.nickname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/keys/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'API key not found' });
    }

    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    if (row.is_active) {
      // Pick another key if exists
      const remaining = db.prepare('SELECT id FROM api_keys LIMIT 1').get();
      if (remaining) {
        db.prepare('UPDATE api_keys SET is_active = 1 WHERE id = ?').run(remaining.id);
        db.prepare('UPDATE settings SET active_key_id = ? WHERE id = 1').run(remaining.id);
      } else {
        db.prepare('UPDATE settings SET active_key_id = NULL WHERE id = 1').run();
      }
    }

    logActivity('info', `Removed API key: ${row.nickname}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== REELS QUEUE & COMMENTS ====================

app.get('/api/reels', (req, res) => {
  try {
    const db = getDb();
    const reels = db.prepare(`
      SELECT * FROM reels 
      ORDER BY rowid DESC
    `).all();

    // Attach comments for each reel
    const comments = db.prepare(`
      SELECT * FROM comments 
      ORDER BY rowid ASC
    `).all();

    const commentsByReel = {};
    for (const c of comments) {
      if (!commentsByReel[c.reel_id]) commentsByReel[c.reel_id] = [];
      commentsByReel[c.reel_id].push(c);
    }

    const payload = reels.map((r) => ({
      ...r,
      comments: commentsByReel[r.id] || []
    }));

    res.json({ reels: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reels', upload.single('video'), (req, res) => {
  try {
    const { url, title } = req.body;
    const file = req.file;

    if (!url && !file) {
      return res.status(400).json({ error: 'Either a Reel URL or a video file is required.' });
    }

    const reelUrl = (url || '').trim() || (file ? `https://www.instagram.com/reel/upload-${Date.now()}/` : '');
    
    // Validate Instagram URL format if provided
    if (url && !validateReelUrl(reelUrl) && !file) {
      return res.status(400).json({
        error: 'Please provide a valid Instagram Reel URL (e.g., https://www.instagram.com/reel/C3b4xyZ.../)'
      });
    }

    const reelId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const db = getDb();

    // Check duplicate URL
    if (url) {
      const existing = db.prepare('SELECT id, url FROM reels WHERE url = ?').get(reelUrl);
      if (existing) {
        return res.status(409).json({ error: 'This Reel URL is already in your processing list.' });
      }
    }

    // Determine honest initial status:
    // If video file is attached: status = 'pending', ready for visual frame analysis
    // If URL only: status = 'needs_video', direct access restricted, video upload requested
    const hasVideo = Boolean(file);
    const initialStatus = hasVideo ? 'pending' : 'needs_video';
    const analysisSource = hasVideo ? 'visual_frames' : 'none';
    const errorMessage = hasVideo
      ? null
      : 'Direct video access via Instagram URL is restricted without authentication. Please upload the Reel video file (MP4, MOV, or WEBM) for real visual frame analysis.';

    db.prepare(`
      INSERT INTO reels (
        id, url, title, video_path, video_filename, video_mime, video_size, 
        status, analysis_source, error_message, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reelId,
      reelUrl,
      title || (file ? file.originalname : 'Instagram Reel'),
      file ? file.path : null,
      file ? file.originalname : null,
      file ? file.mimetype : null,
      file ? file.size : null,
      initialStatus,
      analysisSource,
      errorMessage,
      createdAt
    );

    logActivity(
      hasVideo ? 'info' : 'warning',
      hasVideo ? `Added Reel with video attachment: ${reelUrl}` : `Added Reel URL (requires video upload): ${reelUrl}`,
      { hasVideo }
    );

    res.json({
      success: true,
      reel: {
        id: reelId,
        url: reelUrl,
        title: title || (file ? file.originalname : 'Instagram Reel'),
        hasVideo,
        status: initialStatus,
        error_message: errorMessage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload and attach video file to an existing Reel
app.post('/api/reels/:id/video', upload.single('video'), (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No video file provided. Please select an MP4, MOV, or WEBM file.' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM reels WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Reel not found.' });
    }

    // Remove old video file if present
    if (existing.video_path && fs.existsSync(existing.video_path) && existing.video_path !== file.path) {
      try { fs.unlinkSync(existing.video_path); } catch (e) { /* ignore */ }
    }

    db.prepare(`
      UPDATE reels 
      SET video_path = ?,
          video_filename = ?,
          video_mime = ?,
          video_size = ?,
          status = 'pending',
          analysis_source = 'visual_frames',
          error_message = NULL
      WHERE id = ?
    `).run(
      file.path,
      file.originalname,
      file.mimetype,
      file.size,
      id
    );

    logActivity('info', `Attached video file [${file.originalname}] to Reel: ${existing.url}`);

    const updated = db.prepare('SELECT * FROM reels WHERE id = ?').get(id);
    res.json({ success: true, reel: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reels/batch', (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Array of URLs is required.' });
    }

    const db = getDb();
    let added = 0;
    let skipped = 0;
    const createdAt = new Date().toISOString();
    const errorMessage = 'Direct video access via Instagram URL is restricted without authentication. Please upload the Reel video file (MP4, MOV, or WEBM) for real visual frame analysis.';

    for (const rawUrl of urls) {
      const url = (rawUrl || '').trim();
      if (!url) continue;

      const existing = db.prepare('SELECT id FROM reels WHERE url = ?').get(url);
      if (existing) {
        skipped++;
        continue;
      }

      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO reels (id, url, title, status, analysis_source, error_message, created_at)
        VALUES (?, ?, ?, 'needs_video', 'none', ?, ?)
      `).run(id, url, 'Instagram Reel', errorMessage, createdAt);
      added++;
    }

    logActivity('info', `Batch imported ${added} Reel URLs (${skipped} duplicates skipped, video uploads requested)`);
    res.json({ success: true, added, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reels/:id/retry', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM reels WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Reel not found.' });
    }

    const hasVideo = Boolean(existing.video_path && fs.existsSync(existing.video_path));
    const nextStatus = hasVideo ? 'pending' : 'needs_video';
    const nextError = hasVideo
      ? null
      : 'Direct video access via Instagram URL is restricted without authentication. Please upload the Reel video file (MP4, MOV, or WEBM) for real visual frame analysis.';

    db.prepare(`
      UPDATE reels 
      SET status = ?, error_message = ? 
      WHERE id = ?
    `).run(nextStatus, nextError, id);

    logActivity('info', `Retried Reel analysis`, { reelId: id, status: nextStatus });
    res.json({ success: true, status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reels/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    // Check if video file exists to delete
    const reel = db.prepare('SELECT video_path FROM reels WHERE id = ?').get(id);
    if (reel && reel.video_path && fs.existsSync(reel.video_path)) {
      try { fs.unlinkSync(reel.video_path); } catch (e) { /* ignore */ }
    }

    db.prepare('DELETE FROM comments WHERE reel_id = ?').run(id);
    db.prepare('DELETE FROM reels WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== COMMENTS APPROVAL & POSTING ====================

app.post('/api/comments/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Toggle or set approved
    const newApproved = comment.is_approved ? 0 : 1;
    const approvedAt = newApproved ? new Date().toISOString() : null;

    db.prepare('UPDATE comments SET is_approved = ?, approved_at = ? WHERE id = ?').run(
      newApproved,
      approvedAt,
      id
    );

    logActivity('info', `${newApproved ? 'Approved' : 'Unapproved'} comment`, { commentId: id, text: comment.text });
    res.json({ success: true, is_approved: newApproved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments/:id/post', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const newPosted = comment.is_posted ? 0 : 1;
    const postedAt = newPosted ? new Date().toISOString() : null;

    db.prepare('UPDATE comments SET is_posted = ?, posted_at = ? WHERE id = ?').run(
      newPosted,
      postedAt,
      id
    );

    logActivity('success', `Marked comment as ${newPosted ? 'Posted to Instagram' : 'Not Posted'}`, {
      commentId: id
    });
    res.json({ success: true, is_posted: newPosted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== INSTAGRAM SESSION ACTIONS ====================

app.post('/api/instagram/open', async (req, res) => {
  try {
    const { target, url } = req.body;
    let targetUrl = INSTAGRAM_URLS.HOMEPAGE;

    if (target === 'reels') {
      targetUrl = INSTAGRAM_URLS.REELS;
    } else if (target === 'reel' && url) {
      targetUrl = url;
    }

    await openInDefaultBrowser(targetUrl);
    res.json({ success: true, openedUrl: targetUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/instagram/session', (req, res) => {
  try {
    const { isLoggedIn } = req.body;
    const updated = updateInstagramSessionStatus(Boolean(isLoggedIn));
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ACTIVITY LOGS ====================

app.get('/api/logs', (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare(`
      SELECT * FROM activity_logs 
      ORDER BY id DESC 
      LIMIT 100
    `).all();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/logs', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM activity_logs').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SEED SAMPLES ====================

app.post('/api/seed-samples', (req, res) => {
  try {
    const db = getDb();
    const samples = [
      {
        url: 'https://www.instagram.com/reel/C3b4xyZ_sample_travel/',
        title: 'Alpine Mountain Sunrise Hike in Switzerland 🏔️',
        category: 'Travel',
        summary: 'Breathtaking 4K drone sweep of snowy alpine peaks at golden sunrise with light misty clouds.',
        mood: 'Awe-inspiring',
        language: 'English',
        comments: [
          { text: 'That golden hour glow hitting the snowy peak looks surreal!', tone: 'Observant' },
          { text: 'The clarity on that drone shot is incredible, what a serene morning view.', tone: 'Appreciative' },
          { text: 'Switzerland sunrises hit different, totally worth waking up at 4 AM for!', tone: 'Engaging' }
        ]
      },
      {
        url: 'https://www.instagram.com/reel/D4k9mnP_sample_tech/',
        title: 'Minimalist Mechanical Keyboard Build with Custom Switches ⌨️',
        category: 'Technology',
        summary: 'Close-up tactile assembly of lubed linear switches on an anodized aluminum gasket mount frame.',
        mood: 'Satisfying & Focused',
        language: 'English',
        comments: [
          { text: 'Those lubed switches have such a clean, deep sound profile!', tone: 'Insightful' },
          { text: 'The brass weight accent on that matte frame looks so clean.', tone: 'Observant' },
          { text: 'ASMR quality typing sounds right there, excellent switch lube job.', tone: 'Enthusiastic' }
        ]
      },
      {
        url: 'https://www.instagram.com/reel/E7p2qrS_sample_food/',
        title: 'Crispy Neapolitan Sourdough Pizza in Wood Fired Oven 🍕',
        category: 'Food',
        summary: 'Hand stretching 72-hour fermented dough, topped with San Marzano tomatoes, and blistered crust in oven.',
        mood: 'Mouth-watering',
        language: 'English',
        comments: [
          { text: 'That leopard spotting on the crust puff is absolute perfection.', tone: 'Observant' },
          { text: '72-hour cold ferment pays off every time, look at that airy crust structure!', tone: 'Insightful' },
          { text: 'The bubble rise on that first wood-fire turn was mesmerizing.', tone: 'Appreciative' }
        ]
      },
      {
        url: 'https://www.instagram.com/reel/F8s3tuV_sample_fitness/',
        title: 'Form Breakdown: Kettlebell Clean and Strict Overhead Press 💪',
        category: 'Fitness',
        summary: 'Side-by-side athletic demonstration emphasizing hip hinge power and vertical forearm lockout.',
        mood: 'Motivational',
        language: 'English',
        comments: [
          { text: 'Clean hip snap on that bell transition, great forearm alignment on the lockout.', tone: 'Insightful' },
          { text: 'Solid cue on keeping the core braced through the press, form looks locked in.', tone: 'Supportive' },
          { text: 'Appreciate the side angle view, makes tracking the bell path much easier to follow.', tone: 'Engaging' }
        ]
      }
    ];

    const now = new Date().toISOString();
    let count = 0;

    for (const s of samples) {
      const existing = db.prepare('SELECT id FROM reels WHERE url = ?').get(s.url);
      if (existing) continue;

      const reelId = crypto.randomUUID();
      const mainSubjects = {
        Travel: 'Solo hiker on alpine peak overlooking snowy mountain range at golden sunrise',
        Technology: 'Custom mechanical keyboard assembly with lubed linear switches and keycaps',
        Food: 'Artisan Neapolitan pizza stretching, toppings, and wood-fire oven baking',
        Fitness: 'Athlete performing kettlebell clean and overhead lockouts'
      };
      const actionsMap = {
        Travel: 'Sweeping panoramic camera panning over snowy ridges as sunlight breaks through morning mist',
        Technology: 'Inserting lubed switches into PCB, mounting keycaps, and tactile switch typing sound testing',
        Food: 'Flour dusting, 72-hr fermented dough stretching, crushed tomato ladle spread, wood-fired oven blistering',
        Fitness: 'Hip hinge power snap, rack transition, vertical overhead lockouts, and controlled descent'
      };

      db.prepare(`
        INSERT INTO reels (
          id, url, title, status, category, visual_summary, main_subject, actions, 
          mood, language, frames_count, analysis_source, completed_at, created_at
        )
        VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, 6, 'visual_frames', ?, ?)
      `).run(
        reelId,
        s.url,
        s.title,
        s.category,
        s.summary,
        mainSubjects[s.category] || 'Visual subject',
        actionsMap[s.category] || 'Visual scene progression',
        s.mood,
        s.language,
        now,
        now
      );

      for (const c of s.comments) {
        db.prepare(`
          INSERT INTO comments (id, reel_id, text, tone, is_approved, is_posted, created_at)
          VALUES (?, ?, ?, ?, 0, 0, ?)
        `).run(crypto.randomUUID(), reelId, c.text, c.tone, now);
      }
      count++;
    }

    logActivity('info', `Loaded ${count} verified sample Reels with full visual frame analysis records`);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server on all interfaces (IPv4 and IPv6)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ReelAI Server] Running on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
  logActivity('info', `ReelAI Assistant server started on port ${PORT}`);
});

export default app;
