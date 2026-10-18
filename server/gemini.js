import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs';

export class QuotaExceededError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'QuotaExceededError';
    this.details = details;
  }
}

export class InvalidApiKeyError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'InvalidApiKeyError';
    this.details = details;
  }
}

export class ModelUnavailableError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ModelUnavailableError';
    this.details = details;
  }
}

export class UnsupportedMethodError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'UnsupportedMethodError';
    this.details = details;
  }
}

export class NetworkConnectionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'NetworkConnectionError';
    this.details = details;
  }
}

// Strip any accidental key leakage from Google error strings
export function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .replace(/key=[A-Za-z0-9._-]+/gi, 'key=[REDACTED]')
    .replace(/AQ\.[A-Za-z0-9._-]+/gi, '[REDACTED_KEY]')
    .replace(/AIza[0-9A-Za-z-_]{35}/gi, '[REDACTED_KEY]');
}

// Officially supported, verified models available to API keys
export const SUPPORTED_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Recommended - Latest & Multimodal Fast)', default: true },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (High Performance Multimodal)', default: false },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Stable Production)', default: false },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest (Auto-updated Stable)', default: false },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (Low Latency)', default: false }
];

export const DEFAULT_MODEL_ID = 'gemini-3.8-flash';

/**
 * Classifies Google Gemini API errors accurately
 */
export function classifyGeminiError(err, modelId = DEFAULT_MODEL_ID) {
  const rawMsg = err?.message || String(err);
  const cleanMsg = sanitizeErrorMessage(rawMsg);

  // 1. Quota / Rate Limits / Server Capacity
  if (
    cleanMsg.includes('429') ||
    cleanMsg.includes('RESOURCE_EXHAUSTED') ||
    cleanMsg.includes('Quota exceeded') ||
    cleanMsg.includes('503') ||
    cleanMsg.includes('capacity available')
  ) {
    return new QuotaExceededError(`Gemini API Quota/Rate Limit reached: ${cleanMsg}`, err);
  }

  // 2. Invalid API Key
  if (
    cleanMsg.includes('API_KEY_INVALID') ||
    cleanMsg.includes('403') ||
    cleanMsg.includes('API key not valid') ||
    cleanMsg.includes('unauthorized')
  ) {
    return new InvalidApiKeyError(`Invalid Gemini API Key: Please verify your API key in Google AI Studio.`, err);
  }

  // 3. Model Not Found / Deprecated Model / Not Available
  if (
    cleanMsg.includes('404') ||
    cleanMsg.includes('Not Found') ||
    cleanMsg.includes('no longer available') ||
    cleanMsg.includes('is not available') ||
    cleanMsg.includes('models/')
  ) {
    return new ModelUnavailableError(
      `Model '${modelId}' is not available or has been deprecated by Google. ${cleanMsg}. Please select a supported model such as Gemini 3.8 Flash.`,
      err
    );
  }

  // 4. Unsupported Method
  if (cleanMsg.includes('405') || cleanMsg.includes('Method Not Allowed') || cleanMsg.includes('not supported')) {
    return new UnsupportedMethodError(`Method not supported by model '${modelId}': ${cleanMsg}`, err);
  }

  // 5. Network connectivity
  if (
    cleanMsg.includes('ENOTFOUND') ||
    cleanMsg.includes('ECONNREFUSED') ||
    cleanMsg.includes('ETIMEDOUT') ||
    cleanMsg.includes('fetch failed')
  ) {
    return new NetworkConnectionError(`Network connection failed while reaching Gemini API: ${cleanMsg}`, err);
  }

  return new Error(cleanMsg);
}

export async function testApiKey(apiKey, modelId = DEFAULT_MODEL_ID) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new InvalidApiKeyError('API key is empty or missing.');
  }

  const startTime = Date.now();
  const genAI = new GoogleGenerativeAI(apiKey.trim());

  try {
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Respond with the single word: "READY"' }] }],
      generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
    });

    const response = await result.response;
    const text = response.text()?.trim();
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      model: modelId,
      latencyMs,
      message: `Successfully connected to ${modelId} (${latencyMs}ms)`
    };
  } catch (err) {
    throw classifyGeminiError(err, modelId);
  }
}

/**
 * Analyzes Reel video content and generates 3 human-like comments.
 */
export async function analyzeReelAndGenerateComments({
  apiKey,
  modelId = DEFAULT_MODEL_ID,
  reelUrl,
  videoPath = null,
  mimeType = 'video/mp4',
  title = '',
  previousComments = []
}) {
  if (!apiKey) {
    throw new InvalidApiKeyError('No active Gemini API key configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      responseMimeType: 'application/json'
    }
  });

  const parts = [];

  // If local video content is provided, pass it to Gemini
  let hasVisualVideo = false;
  if (videoPath && fs.existsSync(videoPath)) {
    try {
      const stats = fs.statSync(videoPath);
      // Gemini inlineData supports up to ~25MB comfortably
      if (stats.size > 0 && stats.size <= 25 * 1024 * 1024) {
        const fileBuffer = fs.readFileSync(videoPath);
        parts.push({
          inlineData: {
            mimeType: mimeType || 'video/mp4',
            data: fileBuffer.toString('base64')
          }
        });
        hasVisualVideo = true;
      }
    } catch (e) {
      console.warn('Could not read video file for inline analysis:', e.message);
    }
  }

  const previousCommentsContext = previousComments.length > 0
    ? `\nTo avoid repetition, DO NOT generate any comments similar to these recently generated ones:\n- ${previousComments.slice(-10).join('\n- ')}`
    : '';

  const systemPrompt = `
You are ReelAI, an intelligent Instagram Reels video analyst and comment assistant.
Your task is to analyze an Instagram Reel and generate exactly 3 natural, human-sounding comment suggestions.

${hasVisualVideo ? 'VIDEO ATTACHMENT: You have been provided the ACTUAL VIDEO FILE of this Reel.' : 'NOTE: No direct video file was uploaded. You are given the Reel URL and any known metadata/caption.'}

Reel URL: ${reelUrl || 'N/A'}
Caption/Title: ${title || 'N/A'}
${previousCommentsContext}

CRITICAL RULES FOR COMMENT GENERATION:
1. SOUND LIKE A REAL HUMAN: Write comments that sound authentic, casual, and thoughtful.
2. SHORT & NATURAL: 1-2 sentences maximum.
3. VIDEO-SPECIFIC: Directly reference specific elements from the video (visual actions, subject, technique, humor, advice, scenery, or surprise).
4. NO GENERIC PRAISE: NEVER generate lazy comments like "Nice video", "Great post", "Love this!", "Awesome", or "So cool!". Every comment must have specific substance.
5. NO MISLEADING CLAIMS: Do not claim to see things not in the video. If visual video wasn't provided, ground comments respectfully on the topic and title.
6. NO EXCESSIVE EMOJIS: Max 1 naturally placed emoji per comment, or none at all.
7. NO HASHTAGS: Do not include hashtags.
8. NO ABUSE OR SPAM: Never generate negative, abusive, promotional, or deceptive text.
9. NO FAKE PERSONAL EXPERIENCES: Do not claim "I was there yesterday!" unless explicitly instructed.
10. MATCH TONE & LANGUAGE: Detect the language and vibe (humorous, inspirational, educational, sarcastic, awe-inspiring, fitness motivation, etc.) and match it.

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "reelType": "Comedy" | "Education" | "Technology" | "Travel" | "Fitness" | "Food" | "Fashion" | "Lifestyle" | "Art" | "Music" | "Other",
  "summary": "1-2 sentence concise description of the visible content, actions, subject, and mood",
  "mood": "e.g., Energetic, Peaceful, Informative, Hilarious, Motivational",
  "language": "e.g., English, Spanish, Hindi, etc.",
  "comments": [
    {
      "text": "First comment text here",
      "tone": "e.g., Engaging / Observant / Humorous / Supportive"
    },
    {
      "text": "Second comment text here",
      "tone": "e.g., Insightful / Appreciative / Inquisitive"
    },
    {
      "text": "Third comment text here",
      "tone": "e.g., Casual / Direct / Thoughtful"
    }
  ]
}
`;

  parts.push({ text: systemPrompt });

  try {
    const result = await model.generateContent(parts);
    const response = await result.response;
    const responseText = response.text()?.trim();

    if (!responseText) {
      throw new Error('Gemini returned an empty response.');
    }

    // Clean JSON formatting if wrapped in markdown code blocks
    let cleanedJson = responseText;
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleanedJson);

    // Validate expected structure
    if (!parsed.comments || !Array.isArray(parsed.comments) || parsed.comments.length === 0) {
      throw new Error('Gemini response missing comments array.');
    }

    return {
      reelType: parsed.reelType || 'Lifestyle',
      summary: parsed.summary || 'Video content analyzed successfully.',
      mood: parsed.mood || 'Natural',
      language: parsed.language || 'English',
      hasVisualVideo,
      comments: parsed.comments.slice(0, 3).map((c, idx) => ({
        text: typeof c === 'string' ? c : c.text,
        tone: typeof c === 'object' && c.tone ? c.tone : `Option ${idx + 1}`
      }))
    };
  } catch (err) {
    throw classifyGeminiError(err, modelId);
  }
}

export default {
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  testApiKey,
  analyzeReelAndGenerateComments,
  classifyGeminiError,
  sanitizeErrorMessage,
  QuotaExceededError,
  InvalidApiKeyError,
  ModelUnavailableError,
  UnsupportedMethodError,
  NetworkConnectionError
};
