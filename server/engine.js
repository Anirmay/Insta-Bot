import crypto from 'node:crypto';
import fs from 'node:fs';
import { getDb, logActivity } from './db.js';
import { decryptSecret } from './credentials.js';
import {
  analyzeReelAndGenerateComments,
  DEFAULT_MODEL_ID,
  QuotaExceededError,
  InvalidApiKeyError,
  ModelUnavailableError,
  UnsupportedMethodError,
  NetworkConnectionError
} from './gemini.js';
import { extractVideoFrames, cleanupFrames } from './video.js';

class ReelProcessingEngine {
  constructor() {
    this.status = 'idle'; // idle | running | paused | stopped | completed
    this.currentReelId = null;
    this.currentReelUrl = '';
    this.currentStep = 'Ready to start';
    this.lastError = null;
    this.isPaused = false;
    this.isStopped = false;
    this.loopPromise = null;
  }

  getSnapshot() {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() || {};

    // Aggregate counts from SQLite
    const totalProcessed = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'completed'`).get().count;
    const totalVideosAnalyzed = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'completed' AND frames_count > 0`).get().count;
    const totalCommentsGenerated = db.prepare(`SELECT COUNT(*) as count FROM comments`).get().count;
    const totalCommentsApproved = db.prepare(`SELECT COUNT(*) as count FROM comments WHERE is_approved = 1`).get().count;
    const totalCommentsPosted = db.prepare(`SELECT COUNT(*) as count FROM comments WHERE is_posted = 1`).get().count;
    const totalQueueLength = db.prepare(`SELECT COUNT(*) as count FROM reels`).get().count;
    const pendingCount = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'pending'`).get().count;
    const awaitingVideoCount = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'awaiting_video'`).get().count;

    return {
      status: this.status,
      currentStep: this.currentStep,
      currentReelUrl: this.currentReelUrl,
      currentReelId: this.currentReelId,
      lastError: this.lastError,
      targetReels: settings.target_reels || 50,
      selectedModel: settings.selected_model || DEFAULT_MODEL_ID,
      activeKeyId: settings.active_key_id || null,
      stats: {
        totalProcessed,
        totalVideosAnalyzed,
        totalCommentsGenerated,
        totalCommentsApproved,
        totalCommentsPosted,
        totalQueueLength,
        pendingCount,
        awaitingVideoCount
      }
    };
  }

  setTarget(targetCount) {
    const count = Math.max(1, parseInt(targetCount, 10) || 50);
    const db = getDb();
    db.prepare('UPDATE settings SET target_reels = ?, updated_at = ? WHERE id = 1').run(
      count,
      new Date().toISOString()
    );
    logActivity('info', `Target Reels count updated to ${count}`);
    return this.getSnapshot();
  }

  setModel(modelId) {
    const db = getDb();
    db.prepare('UPDATE settings SET selected_model = ?, updated_at = ? WHERE id = 1').run(
      modelId,
      new Date().toISOString()
    );
    logActivity('info', `Selected Gemini Model updated to ${modelId}`);
    return this.getSnapshot();
  }

  async start() {
    if (this.status === 'running') {
      return this.getSnapshot();
    }

    this.isPaused = false;
    this.isStopped = false;
    this.status = 'running';
    this.lastError = null;
    this.currentStep = 'Initializing queue...';
    this.updateDbStatus();

    logActivity('info', 'Reel processing engine started');

    this.loopPromise = this.processQueue();
    return this.getSnapshot();
  }

  pause() {
    if (this.status !== 'running') {
      return this.getSnapshot();
    }
    this.isPaused = true;
    this.status = 'paused';
    this.currentStep = 'Paused by user';
    this.updateDbStatus();
    logActivity('warning', 'Reel processing engine paused');
    return this.getSnapshot();
  }

  resume() {
    if (this.status !== 'paused') {
      return this.getSnapshot();
    }
    this.isPaused = false;
    this.status = 'running';
    this.currentStep = 'Resuming processing...';
    this.updateDbStatus();
    logActivity('info', 'Reel processing engine resumed');
    this.loopPromise = this.processQueue();
    return this.getSnapshot();
  }

  stop() {
    this.isStopped = true;
    this.isPaused = false;
    this.status = 'stopped';
    this.currentStep = 'Processing stopped';
    this.updateDbStatus();
    logActivity('warning', 'Reel processing engine stopped');
    return this.getSnapshot();
  }

  updateDbStatus() {
    try {
      const db = getDb();
      db.prepare(`
        UPDATE settings 
        SET status = ?, current_step = ?, current_reel_url = ?, updated_at = ? 
        WHERE id = 1
      `).run(this.status, this.currentStep, this.currentReelUrl, new Date().toISOString());
    } catch (e) {
      console.error('Error updating DB status:', e);
    }
  }

  async processQueue() {
    const db = getDb();

    while (this.status === 'running' && !this.isPaused && !this.isStopped) {
      // 1. Check target
      const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
      const targetCount = settings.target_reels || 50;
      const completedCount = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'completed'`).get().count;

      if (completedCount >= targetCount) {
        this.status = 'completed';
        this.currentStep = `Target reached (${completedCount}/${targetCount} Reels analyzed)`;
        this.updateDbStatus();
        logActivity('success', `Completed target of ${targetCount} Reels!`);
        break;
      }

      // 2. Fetch next pending Reel (only reels that have a video file ready for analysis)
      const nextReel = db.prepare(`
        SELECT * FROM reels 
        WHERE status = 'pending' 
        ORDER BY rowid ASC 
        LIMIT 1
      `).get();

      if (!nextReel) {
        // Check if there are reels awaiting video upload
        const awaitingCount = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'awaiting_video'`).get().count;
        this.status = 'idle';
        if (awaitingCount > 0) {
          this.currentStep = `Queue idle. ${awaitingCount} Reel(s) awaiting video upload (MP4/MOV/WEBM) before analysis can begin.`;
        } else {
          this.currentStep = 'All queued Reels processed. Add more Reels to continue.';
        }
        this.currentReelUrl = '';
        this.currentReelId = null;
        this.updateDbStatus();
        break;
      }

      // 3. Obtain active API key
      const activeKeyRow = db.prepare(`
        SELECT * FROM api_keys 
        WHERE is_active = 1 
        LIMIT 1
      `).get();

      if (!activeKeyRow) {
        this.status = 'paused';
        this.lastError = 'No active Gemini API key found. Please add or activate a key in Settings.';
        this.currentStep = 'Paused: Missing Gemini API Key';
        this.updateDbStatus();
        logActivity('error', this.lastError);
        break;
      }

      let plainApiKey = '';
      try {
        plainApiKey = decryptSecret(activeKeyRow.encrypted_secret);
      } catch (err) {
        this.status = 'paused';
        this.lastError = `Failed to decrypt active API key: ${err.message}`;
        this.currentStep = 'Paused: Decryption error';
        this.updateDbStatus();
        logActivity('error', this.lastError);
        break;
      }

      // 4. Begin processing this Reel
      this.currentReelId = nextReel.id;
      this.currentReelUrl = nextReel.url;

      try {
        // INTEGRITY RULE: Check whether video content was actually provided
        if (!nextReel.video_path || !fs.existsSync(nextReel.video_path)) {
          // Do NOT fake analysis or speculate comments
          db.prepare(`
            UPDATE reels 
            SET status = 'awaiting_video', 
                error_message = 'Direct video access restricted by Instagram. Please upload the Reel video file (MP4, MOV, or WEBM) for genuine visual analysis.'
            WHERE id = ?
          `).run(nextReel.id);

          logActivity('warning', 'Reel requires video file upload before visual analysis can proceed', {
            url: nextReel.url
          });

          this.currentStep = `Reel awaiting video upload: ${nextReel.url}`;
          this.updateDbStatus();
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        // Step 1: Mark analyzing & extract frames with FFmpeg
        this.currentStep = `Extracting representative video frames (FFmpeg)...`;
        this.updateDbStatus();
        db.prepare(`UPDATE reels SET status = 'analyzing' WHERE id = ?`).run(nextReel.id);

        let extraction;
        try {
          extraction = await extractVideoFrames(nextReel.video_path, nextReel.id, { sampleCount: 5 });
        } catch (extractErr) {
          throw new Error(`FFmpeg Frame Extraction Failed: ${extractErr.message}`);
        }

        if (this.isPaused || this.isStopped) break;

        // Step 2: Send extracted frames to Gemini Multimodal AI
        this.currentStep = `Analyzing ${extraction.frameCount} video frames with Gemini (${settings.selected_model})...`;
        this.updateDbStatus();

        // Fetch recent comments to ensure variety
        const recentCommentsRows = db.prepare(`
          SELECT text FROM comments 
          ORDER BY rowid DESC 
          LIMIT 15
        `).all();
        const previousComments = recentCommentsRows.map((r) => r.text);

        const analysisResult = await analyzeReelAndGenerateComments({
          apiKey: plainApiKey,
          modelId: settings.selected_model,
          reelUrl: nextReel.url,
          frames: extraction.frames,
          title: nextReel.title || '',
          previousComments
        });

        if (this.isPaused || this.isStopped) break;

        // Step 3: Save analysis results and grounded comments to DB
        this.currentStep = `Saving visual analysis and 3 grounded comments...`;
        this.updateDbStatus();

        const completedAt = new Date().toISOString();
        db.prepare(`
          UPDATE reels 
          SET status = 'completed',
              category = ?,
              visual_summary = ?,
              main_subject = ?,
              actions = ?,
              mood = ?,
              language = ?,
              frames_count = ?,
              thumbnail_path = ?,
              analysis_source = 'visual_frames',
              completed_at = ?,
              error_message = NULL
          WHERE id = ?
        `).run(
          analysisResult.category,
          analysisResult.videoSummary,
          analysisResult.mainSubject,
          analysisResult.actions,
          analysisResult.mood,
          analysisResult.language,
          extraction.frameCount,
          extraction.thumbnailUrl,
          completedAt,
          nextReel.id
        );

        // Insert exactly 3 comments grounded in visual analysis
        for (const c of analysisResult.comments) {
          const commentId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO comments (id, reel_id, text, tone, is_approved, is_posted, created_at)
            VALUES (?, ?, ?, ?, 0, 0, ?)
          `).run(commentId, nextReel.id, c.text, c.tone, completedAt);
        }

        // Clean up temporary frame files
        cleanupFrames(nextReel.id);

        logActivity('success', `Analyzed Reel [${analysisResult.category}] via ${extraction.frameCount} frames: ${analysisResult.videoSummary}`, {
          url: nextReel.url,
          subject: analysisResult.mainSubject,
          actions: analysisResult.actions
        });

        // Step 4: Awaiting User Review
        this.currentStep = `Analysis complete for ${nextReel.title || nextReel.url} (${extraction.frameCount} frames). Awaiting user review.`;
        this.updateDbStatus();

        await new Promise((r) => setTimeout(r, 1500));

      } catch (err) {
        console.error('Error processing Reel:', err);

        if (err instanceof QuotaExceededError) {
          this.status = 'paused';
          this.isPaused = true;
          this.lastError = err.message;
          this.currentStep = 'Paused: Gemini API quota exceeded. Please select another API key manually.';
          
          db.prepare(`UPDATE api_keys SET status = 'quota_exhausted', error_message = ? WHERE id = ?`).run(
            err.message,
            activeKeyRow.id
          );
          db.prepare(`UPDATE reels SET status = 'pending', error_message = ? WHERE id = ?`).run(
            'Paused due to API quota limit',
            nextReel.id
          );
          
          this.updateDbStatus();
          logActivity('warning', 'Quota exhausted on active API key. Paused processing.', { keyId: activeKeyRow.id });
          break;
        }

        if (err instanceof InvalidApiKeyError) {
          this.status = 'paused';
          this.isPaused = true;
          this.lastError = err.message;
          this.currentStep = 'Paused: Invalid API key.';
          
          db.prepare(`UPDATE api_keys SET status = 'invalid', error_message = ? WHERE id = ?`).run(
            err.message,
            activeKeyRow.id
          );
          db.prepare(`UPDATE reels SET status = 'pending', error_message = ? WHERE id = ?`).run(
            'Paused due to invalid API key',
            nextReel.id
          );

          this.updateDbStatus();
          logActivity('error', 'Active API key is invalid. Paused processing.', { keyId: activeKeyRow.id });
          break;
        }

        if (err instanceof ModelUnavailableError) {
          this.status = 'paused';
          this.isPaused = true;
          this.lastError = err.message;
          this.currentStep = 'Paused: Selected Gemini model is unavailable. Please select another model in Settings.';

          db.prepare(`UPDATE api_keys SET status = 'invalid', error_message = ? WHERE id = ?`).run(
            err.message,
            activeKeyRow.id
          );
          db.prepare(`UPDATE reels SET status = 'pending', error_message = ? WHERE id = ?`).run(
            'Paused due to unavailable model',
            nextReel.id
          );

          this.updateDbStatus();
          logActivity('error', `Model error: ${err.message}`, { keyId: activeKeyRow.id });
          break;
        }

        // Generic failure (e.g. invalid format or corrupt video)
        db.prepare(`UPDATE reels SET status = 'error', error_message = ? WHERE id = ?`).run(
          err.message || 'Unknown processing error',
          nextReel.id
        );
        logActivity('error', `Failed to analyze Reel: ${err.message}`, { url: nextReel.url });

        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (this.status === 'running') {
      this.status = 'idle';
      this.updateDbStatus();
    }
  }
}

export const engine = new ReelProcessingEngine();
export default engine;
