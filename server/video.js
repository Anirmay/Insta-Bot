import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.resolve(__dirname, '../uploads');
const framesDir = path.resolve(uploadsDir, 'frames');
const thumbsDir = path.resolve(uploadsDir, 'thumbnails');

// Ensure directories exist
for (const dir of [uploadsDir, framesDir, thumbsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Probes video duration and metadata using ffmpeg
 */
export async function getVideoMetadata(videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Video file not found at path: ${videoPath}`);
  }

  try {
    // Run ffmpeg -i <file> (ffmpeg exits with code 1 when no output file is given, but outputs info to stderr)
    let stderr = '';
    try {
      await execFileAsync(ffmpegPath, ['-i', videoPath]);
    } catch (err) {
      stderr = err.stderr || '';
    }

    // Parse duration: Duration: 00:00:05.12
    const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2}|\d{2}\.\d{1}|\d{2})/);
    let durationSec = 5; // default fallback if unable to parse

    if (durationMatch) {
      const hours = parseFloat(durationMatch[1]);
      const minutes = parseFloat(durationMatch[2]);
      const seconds = parseFloat(durationMatch[3]);
      durationSec = hours * 3600 + minutes * 60 + seconds;
    }

    // Parse resolution: Stream #0:0... 1080x1920 or similar
    const resMatch = stderr.match(/(\d{3,4})x(\d{3,4})/);
    const resolution = resMatch ? `${resMatch[1]}x${resMatch[2]}` : 'Unknown';

    return {
      durationSec: Math.max(1, durationSec),
      resolution,
      fileSize: fs.statSync(videoPath).size
    };
  } catch (err) {
    throw new Error(`Failed to probe video metadata: ${err.message}`);
  }
}

/**
 * Extracts representative frames sampled across the video (beginning, middle, end)
 * and returns them as base64 JPEG buffers for Gemini multimodal analysis.
 */
export async function extractVideoFrames(videoPath, reelId, options = {}) {
  const { sampleCount = 5 } = options;

  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Video file does not exist: ${videoPath}`);
  }

  const metadata = await getVideoMetadata(videoPath);
  const duration = metadata.durationSec;

  const reelFramesDir = path.join(framesDir, reelId || `reel_${Date.now()}`);
  if (!fs.existsSync(reelFramesDir)) {
    fs.mkdirSync(reelFramesDir, { recursive: true });
  }

  // Calculate representative sample points across video duration
  // E.g. for a 10s video with 5 frames: [1.0s (10%), 3.0s (30%), 5.0s (50%), 7.0s (70%), 9.0s (90%)]
  const timestamps = [];
  if (duration <= 2) {
    // Very short clip
    timestamps.push({ sec: 0.2, label: 'Beginning (00:00)' });
    timestamps.push({ sec: Math.max(0.4, duration / 2), label: 'Middle (00:01)' });
    timestamps.push({ sec: Math.max(0.6, duration - 0.2), label: 'End' });
  } else {
    const percentages = [0.10, 0.30, 0.50, 0.70, 0.90];
    const labels = [
      'Beginning (Opening Hook)',
      'Early Scene (Build-up)',
      'Middle Scene (Peak Action)',
      'Late Scene (Progression)',
      'End (Conclusion / Final Frame)'
    ];

    for (let i = 0; i < percentages.length; i++) {
      const sec = Math.min(duration - 0.2, Math.max(0.3, duration * percentages[i]));
      const roundedSec = Math.round(sec * 10) / 10;
      const mins = Math.floor(roundedSec / 60);
      const remainingSecs = Math.floor(roundedSec % 60);
      const timeStr = `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
      timestamps.push({
        sec: roundedSec,
        label: `${labels[i]} at ${timeStr}`
      });
    }
  }

  const frames = [];
  let thumbnailPath = null;

  for (let idx = 0; idx < timestamps.length; idx++) {
    const item = timestamps[idx];
    const frameFilename = `frame_${idx + 1}.jpg`;
    const frameFilePath = path.join(reelFramesDir, frameFilename);

    try {
      // Extract frame with ffmpeg scaled to max 1280px wide with high quality
      await execFileAsync(ffmpegPath, [
        '-ss', String(item.sec),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', "scale='min(1280,iw)':-2",
        '-q:v', '2',
        '-y',
        frameFilePath
      ]);

      if (fs.existsSync(frameFilePath) && fs.statSync(frameFilePath).size > 0) {
        const fileBuffer = fs.readFileSync(frameFilePath);
        const base64Data = fileBuffer.toString('base64');

        frames.push({
          index: idx + 1,
          timestampSec: item.sec,
          positionLabel: item.label,
          base64: base64Data,
          mimeType: 'image/jpeg',
          sizeBytes: fileBuffer.length
        });

        // Use middle frame (or first frame) as persistent thumbnail for UI
        if (idx === Math.floor(timestamps.length / 2) || !thumbnailPath) {
          const thumbFilename = `thumb_${reelId}.jpg`;
          const destThumb = path.join(thumbsDir, thumbFilename);
          try {
            fs.copyFileSync(frameFilePath, destThumb);
            thumbnailPath = `/uploads/thumbnails/${thumbFilename}`;
          } catch (e) {
            console.warn('Could not save thumbnail:', e.message);
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to extract frame at ${item.sec}s:`, err.message);
    }
  }

  if (frames.length === 0) {
    throw new Error('FFmpeg failed to extract any valid visual frames from the video. Please verify the video format.');
  }

  return {
    durationSec: metadata.durationSec,
    resolution: metadata.resolution,
    frames,
    frameCount: frames.length,
    thumbnailUrl: thumbnailPath
  };
}

/**
 * Cleans up temporary extracted frames
 */
export function cleanupFrames(reelId) {
  if (!reelId) return;
  const reelFramesDir = path.join(framesDir, reelId);
  if (fs.existsSync(reelFramesDir)) {
    try {
      fs.rmSync(reelFramesDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to cleanup frames directory:', e.message);
    }
  }
}

export default {
  getVideoMetadata,
  extractVideoFrames,
  cleanupFrames
};
