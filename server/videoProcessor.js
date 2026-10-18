import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRAMES_BASE_DIR = path.resolve(__dirname, '../uploads/frames');
if (!fs.existsSync(FRAMES_BASE_DIR)) {
  fs.mkdirSync(FRAMES_BASE_DIR, { recursive: true });
}

/**
 * Formats seconds into MM:SS format
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Inspect video file to get duration and dimensions via FFmpeg stderr
 */
export function getVideoMetadata(videoPath) {
  return new Promise((resolve) => {
    if (!videoPath || !fs.existsSync(videoPath)) {
      return resolve({ durationSeconds: 0, width: 0, height: 0, error: 'Video file does not exist' });
    }

    execFile(ffmpegPath, ['-i', videoPath], (err, stdout, stderr) => {
      const output = (stderr || '') + (stdout || '');
      
      // Parse Duration: 00:01:23.45
      const durationMatch = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
      let durationSeconds = 0;
      if (durationMatch) {
        const hours = parseFloat(durationMatch[1]) || 0;
        const mins = parseFloat(durationMatch[2]) || 0;
        const secs = parseFloat(durationMatch[3]) || 0;
        durationSeconds = hours * 3600 + mins * 60 + secs;
      }

      // Parse Video stream dimensions (e.g. 1080x1920, 720x1280)
      const dimMatch = output.match(/Video:.*?,\s*(\d{2,4})x(\d{2,4})/i);
      const width = dimMatch ? parseInt(dimMatch[1], 10) : 0;
      const height = dimMatch ? parseInt(dimMatch[2], 10) : 0;

      const hasAudio = /Audio:/i.test(output);

      resolve({
        durationSeconds: Math.max(durationSeconds, 1),
        width,
        height,
        hasAudio,
        rawOutput: output
      });
    });
  });
}

/**
 * Extract multiple representative frames from video file
 * Samples throughout the video: beginning, early-middle, middle, late-middle, and end
 */
export async function extractVideoFrames(videoPath, { numFrames = 6, reelId = null } = {}) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Video file not found at: ${videoPath}`);
  }

  const metadata = await getVideoMetadata(videoPath);
  const duration = metadata.durationSeconds || 5;

  const targetFolder = path.join(FRAMES_BASE_DIR, reelId || `reel-${Date.now()}`);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Calculate sampling timestamps across beginning, middle, and end
  // E.g., for 6 frames: 8%, 25%, 45%, 65%, 85%, 95% of total duration
  const samplePercentages = numFrames === 4
    ? [0.10, 0.40, 0.70, 0.95]
    : numFrames === 5
    ? [0.08, 0.30, 0.55, 0.80, 0.95]
    : [0.06, 0.22, 0.45, 0.65, 0.82, 0.95];

  const positions = [
    'Video Beginning / Opening Scene',
    'Early Action / Setup',
    'Midpoint Action / Core Content',
    'Mid-Late Progression',
    'Climax / Main Event',
    'Ending Scene / Resolution'
  ];

  const frames = [];

  for (let i = 0; i < samplePercentages.length; i++) {
    const pct = samplePercentages[i];
    let timeSec = duration * pct;
    // Ensure timestamp is at least 0.1s and within duration - 0.2s
    timeSec = Math.max(0.1, Math.min(timeSec, Math.max(duration - 0.2, 0.2)));

    const frameFilename = `frame_${i + 1}_${Math.round(timeSec * 1000)}ms.jpg`;
    const frameFilePath = path.join(targetFolder, frameFilename);

    await new Promise((resolve, reject) => {
      // Scale to max width 720px for high visual clarity with optimal Gemini payload size
      const args = [
        '-ss', timeSec.toFixed(2),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', "scale='min(720,iw)':-2",
        '-q:v', '2',
        '-y', frameFilePath
      ];

      execFile(ffmpegPath, args, (err) => {
        if (err) {
          // If seeking failed at exact timestamp, try with simpler fallback
          execFile(ffmpegPath, ['-i', videoPath, '-ss', timeSec.toFixed(2), '-vframes', '1', '-q:v', '3', '-y', frameFilePath], (fallbackErr) => {
            if (fallbackErr) return reject(new Error(`FFmpeg frame extraction failed at ${timeSec}s: ${err.message}`));
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    if (fs.existsSync(frameFilePath)) {
      const buffer = fs.readFileSync(frameFilePath);
      if (buffer.length > 0) {
        frames.push({
          index: i + 1,
          timeSeconds: timeSec,
          timeFormatted: formatTime(timeSec),
          position: positions[i] || `Scene ${i + 1}`,
          base64: buffer.toString('base64'),
          mimeType: 'image/jpeg',
          filePath: frameFilePath,
          sizeBytes: buffer.length
        });
      }
    }
  }

  if (frames.length === 0) {
    throw new Error('Failed to extract any visual frames from the uploaded video.');
  }

  return {
    success: true,
    durationSeconds: duration,
    hasAudio: metadata.hasAudio,
    dimensions: `${metadata.width}x${metadata.height}`,
    framesCount: frames.length,
    frames,
    thumbnailPath: frames[0]?.filePath || null
  };
}

export default {
  getVideoMetadata,
  extractVideoFrames,
  formatTime
};
