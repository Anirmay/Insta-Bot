import crypto from 'node:crypto';
import fs from 'node:fs';
import { getDb, logActivity } from './db.js';
import { decryptSecret } from './credentials.js';
import {
  analyzeVideoFramesAndGenerateComments,
  DEFAULT_MODEL_ID,
  QuotaExceededError,
  InvalidApiKeyError,
  ModelUnavailableError,
  UnsupportedMethodError,
  NetworkConnectionError
} from './gemini.js';
import { extractVideoFrames } from './videoProcessor.js';
import { retrieveReelVideo } from './reelRetriever.js';

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
    const totalVideosAnalyzed = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'completed' AND analysis_source = 'visual_frames'`).get().count;
    const totalAwaitingVideo = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'needs_video'`).get().count;
    const totalCommentsGenerated = db.prepare(`SELECT COUNT(*) as count FROM comments`).get().count;
    const totalCommentsApproved = db.prepare(`SELECT COUNT(*) as count FROM comments WHERE is_approved = 1`).get().count;
    const totalCommentsPosted = db.prepare(`SELECT COUNT(*) as count FROM comments WHERE is_posted = 1`).get().count;
    const totalQueueLength = db.prepare(`SELECT COUNT(*) as count FROM reels`).get().count;
    const pendingCount = db.prepare(`SELECT COUNT(*) as count FROM reels WHERE status = 'pending'`).get().count;

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
        totalAwaitingVideo,
        totalCommentsGenerated,
        totalCommentsApproved,
        totalCommentsPosted,
        totalQueueLength,
        pendingCount
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
        this.currentStep = `Target reached (${completedCount}/${targetCount} Reels processed)`;
        this.updateDbStatus();
        logActivity('success', `Completed target of ${targetCount} Reels!`);
        break;
      }

      // 2. Fetch next pending Reel
      const nextReel = db.prepare(`
        SELECT * FROM reels 
        WHERE status = 'pending' 
        ORDER BY rowid ASC 
        LIMIT 1
      `).get();

      if (!nextReel) {
        this.status = 'idle';
        this.currentStep = 'All queued Reels processed. Add more Reels to continue.';
        this.currentReelUrl = '';
        this.currentReelId = null;
        this.updateDbStatus();
        logActivity('info', 'Queue empty. All pending Reels processed.');
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
        let videoPath = nextReel.video_path;
        let hasVideoFile = Boolean(videoPath && fs.existsSync(videoPath));

        // Step 1: Automatic Reel content retrieval if video file is not already on disk
        if (!hasVideoFile) {
          // Status: Checking Reel Access
          this.currentStep = `Checking access for Reel: ${nextReel.url}...`;
          this.updateDbStatus();
          db.prepare(`UPDATE reels SET status = 'checking_access', retrieval_status = 'checking', error_message = NULL WHERE id = ?`).run(nextReel.id);

          // Status: Retrieving Video
          this.currentStep = `Retrieving accessible video content from Instagram...`;
          this.updateDbStatus();
          db.prepare(`UPDATE reels SET status = 'retrieving_video', retrieval_status = 'retrieving' WHERE id = ?`).run(nextReel.id);

          const retrievalResult = await retrieveReelVideo({ reelId: nextReel.id, url: nextReel.url });

          if (!retrievalResult.success) {
            // Truthfully mark reason: auth_required, not_accessible, or error
            const failStatus = retrievalResult.status || 'not_accessible';
            db.prepare(`
              UPDATE reels 
              SET status = ?,
                  retrieval_status = ?,
                  error_message = ?,
                  analysis_source = 'none'
              WHERE id = ?
            `).run(failStatus, retrievalResult.reason || 'failed', retrievalResult.message, nextReel.id);

            logActivity('warning', `Reel retrieval stopped: ${retrievalResult.reason}`, {
              url: nextReel.url,
              status: failStatus,
              message: retrievalResult.message
            });

            this.currentStep = `${retrievalResult.reason}: ${nextReel.url}`;
            this.updateDbStatus();
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }

          // Status: Video Content Retrieved
          videoPath = retrievalResult.videoPath;
          hasVideoFile = true;

          db.prepare(`
            UPDATE reels 
            SET video_path = ?,
                video_filename = ?,
                video_mime = ?,
                video_size = ?,
                video_duration = ?,
                status = 'video_retrieved',
                retrieval_status = 'retrieved',
                analysis_source = 'visual_frames',
                error_message = NULL
            WHERE id = ?
          `).run(
            retrievalResult.videoPath,
            retrievalResult.videoFilename,
            retrievalResult.videoMime,
            retrievalResult.videoSize,
            retrievalResult.videoDuration,
            nextReel.id
          );

          this.currentStep = `Video content retrieved (${retrievalResult.videoDuration}s, ${retrievalResult.dimensions})`;
          this.updateDbStatus();
          await new Promise((r) => setTimeout(r, 600));
        }

        if (this.isPaused || this.isStopped) break;

        // Step 2: Extract representative visual frames using FFmpeg
        this.currentStep = `Extracting representative video frames with FFmpeg (${nextReel.video_filename || path.basename(videoPath)})...`;
        this.updateDbStatus();
        db.prepare(`UPDATE reels SET status = 'extracting_frames' WHERE id = ?`).run(nextReel.id);

        const extractionResult = await extractVideoFrames(videoPath, {
          numFrames: 6,
          reelId: nextReel.id
        });

        if (this.isPaused || this.isStopped) break;

        // Step 3: Analyze extracted visual frames with Gemini Multimodal AI
        this.currentStep = `Analyzing ${extractionResult.framesCount} visual frames with Gemini AI (${settings.selected_model})...`;
        this.updateDbStatus();
        db.prepare(`UPDATE reels SET status = 'analyzing' WHERE id = ?`).run(nextReel.id);

        // Fetch recent comments to ensure uniqueness
        const recentCommentsRows = db.prepare(`
          SELECT text FROM comments 
          ORDER BY rowid DESC 
          LIMIT 15
        `).all();
        const previousComments = recentCommentsRows.map((r) => r.text);

        // Run Gemini multimodal visual analysis
        const analysisResult = await analyzeVideoFramesAndGenerateComments({
          apiKey: plainApiKey,
          modelId: settings.selected_model,
          frames: extractionResult.frames,
          reelUrl: nextReel.url,
          title: nextReel.title || '',
          durationSeconds: extractionResult.durationSeconds,
          previousComments
        });

        if (this.isPaused || this.isStopped) break;

        // Step 4: Successfully Analyzed
        this.currentStep = 'Saving AI visual analysis and generating 3 grounded comments...';
        this.updateDbStatus();

        const completedAt = new Date().toISOString();
        db.prepare(`
          UPDATE reels 
          SET status = 'completed',
              retrieval_status = 'analyzed',
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
          extractionResult.framesCount,
          extractionResult.thumbnailPath,
          completedAt,
          nextReel.id
        );

        // Insert generated grounded comments
        for (const c of analysisResult.comments) {
          const commentId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO comments (id, reel_id, text, tone, is_approved, is_posted, created_at)
            VALUES (?, ?, ?, ?, 0, 0, ?)
          `).run(commentId, nextReel.id, c.text, c.tone, completedAt);
        }

        logActivity('success', `Analyzed ${extractionResult.framesCount} frames for [${analysisResult.category}]: ${analysisResult.mainSubject}`, {
          url: nextReel.url,
          summary: analysisResult.videoSummary
        });

        // Step 5: Awaiting User Review
        this.currentStep = `Analysis complete for ${nextReel.url} (${extractionResult.framesCount} frames). Awaiting review.`;
        this.updateDbStatus();

        // Respectful delay between Reels (1.5 seconds)
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

        // Generic error on this Reel (e.g., corrupt video file, extraction failure)
        db.prepare(`UPDATE reels SET status = 'error', error_message = ? WHERE id = ?`).run(
          err.message || 'Unknown processing error',
          nextReel.id
        );
        logActivity('error', `Failed to analyze Reel: ${err.message}`, { url: nextReel.url });

        // Continue to next after brief pause
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (this.status === 'running') {
      this.status = 'idle';
      this.currentStep = 'Ready';
      this.updateDbStatus();
    }
  }
}

export const engine = new ReelProcessingEngine();
export default engine;
