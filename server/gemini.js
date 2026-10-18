import { GoogleGenerativeAI } from '@google/generative-ai';

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
 * Genuine Multimodal Video Analysis and Grounded Comment Generation.
 * Requires actual video frames extracted via FFmpeg sampled throughout the video.
 */
export async function analyzeReelAndGenerateComments({
  apiKey,
  modelId = DEFAULT_MODEL_ID,
  reelUrl = '',
  frames = [],
  title = '',
  previousComments = []
}) {
  if (!apiKey) {
    throw new InvalidApiKeyError('No active Gemini API key configured.');
  }

  // CRITICAL INTEGRITY CHECK: Never claim to analyze without visual frames
  if (!frames || !Array.isArray(frames) || frames.length === 0) {
    throw new Error(
      'Genuine video analysis requires actual visual content. No video frames were provided. Please upload the Reel video file (MP4, MOV, or WEBM).'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 0.6,
      topP: 0.95,
      responseMimeType: 'application/json'
    }
  });

  const parts = [];

  // 1. Add introductory instruction explaining frame chronology
  parts.push({
    text: `You are ReelAI, an expert Instagram Reels visual analyst. You have been provided with ${frames.length} ACTUAL EXTRACTED VIDEO FRAMES from this Instagram Reel, sampled in sequence across its beginning, middle, and end.`
  });

  // 2. Add each extracted frame image with its timestamp and position label
  for (const frame of frames) {
    parts.push({
      text: `[Frame ${frame.index} - ${frame.positionLabel || `Timestamp ${frame.timestampSec}s`}]`
    });
    parts.push({
      inlineData: {
        mimeType: frame.mimeType || 'image/jpeg',
        data: frame.base64
      }
    });
  }

  // 3. Add prompt constraints and required JSON schema
  const previousCommentsContext = previousComments.length > 0
    ? `\nTo avoid repetition across your session, DO NOT generate comments that duplicate these recent comments:\n- ${previousComments.slice(-10).join('\n- ')}`
    : '';

  const promptText = `
VIDEO METADATA:
- Reel URL: ${reelUrl || 'Attached video file'}
- Provided Title/Context: ${title || 'N/A'}
- Total Frames Analyzed: ${frames.length}
${previousCommentsContext}

INSTRUCTIONS FOR GENUINE VISUAL ANALYSIS:
1. Ground your entire analysis STRICTLY on what is visible in the provided frame images.
2. Identify what actually happens in the video, who or what the main subject is, and what observable actions take place across the sequence of frames.
3. If the frames are blurry, ambiguous, or insufficient to understand the video, state this honestly in "videoSummary" instead of inventing details.
4. DO NOT invent locations, people, equipment, activities, or events that are not visible in the frames.

INSTRUCTIONS FOR 3 GROUNDED COMMENTS:
1. Generate EXACTLY 3 natural, human-sounding comment suggestions.
2. Each comment MUST directly reference specific visual elements, observable actions, or techniques visible in the video frames.
3. Short and authentic: 1 to 2 sentences maximum. Sounds like a real human viewer on Instagram.
4. NO GENERIC PRAISE: Never write generic filler like "Nice video", "Great post", "Love this!", "Awesome", or "So cool!".
5. Natural tone: Maximum 1 emoji per comment, or none at all. No hashtags. No fake claims ("I was there yesterday!").

OUTPUT FORMAT (Respond with a valid JSON object matching this exact schema):
{
  "videoSummary": "Detailed 1-2 sentence description of what actually happens in the video based on the frames",
  "mainSubject": "The main person, animal, object, or activity visible in the video",
  "actions": "Specific observable actions and events across the frames",
  "category": "Comedy" | "Education" | "Travel" | "Fitness" | "Food" | "Technology" | "Fashion" | "Lifestyle" | "Art" | "Music" | "Other",
  "mood": "Apparent tone (e.g., Energetic, Serene, Informative, Humorous, Intense, Creative)",
  "language": "Detected language if visible in on-screen text/signs, otherwise 'English'",
  "comments": [
    {
      "text": "First grounded comment directly referencing specific visible actions or details",
      "tone": "Observant"
    },
    {
      "text": "Second grounded comment offering an engaging observation or thoughtful reaction",
      "tone": "Insightful"
    },
    {
      "text": "Third grounded comment with an authentic, casual human perspective",
      "tone": "Engaging"
    }
  ]
}
`;

  parts.push({ text: promptText });

  try {
    const result = await model.generateContent(parts);
    const response = await result.response;
    const responseText = response.text()?.trim();

    if (!responseText) {
      throw new Error('Gemini returned an empty response during visual frame analysis.');
    }

    // Clean JSON formatting if wrapped in markdown code blocks
    let cleanedJson = responseText;
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleanedJson);

    // Validate structured fields
    if (!parsed.comments || !Array.isArray(parsed.comments) || parsed.comments.length === 0) {
      throw new Error('Gemini response missing comments array.');
    }

    const category = parsed.category || 'Lifestyle';
    const videoSummary = parsed.videoSummary || parsed.summary || 'Visual content analyzed successfully.';
    const mainSubject = parsed.mainSubject || 'Subject visible in video';
    const actions = parsed.actions || 'Actions observed across frames';
    const mood = parsed.mood || 'Natural';
    const language = parsed.language || 'English';

    return {
      category,
      videoSummary,
      mainSubject,
      actions,
      mood,
      language,
      framesCount: frames.length,
      hasVisualVideo: true,
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
