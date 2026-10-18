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
 * Analyzes genuine extracted video frames and generates grounded comments.
 * Passes actual image frames (inlineData JPEG) to Gemini multimodal model.
 */
export async function analyzeVideoFramesAndGenerateComments({
  apiKey,
  modelId = DEFAULT_MODEL_ID,
  frames = [],
  reelUrl = '',
  title = '',
  durationSeconds = 0,
  previousComments = []
}) {
  if (!apiKey) {
    throw new InvalidApiKeyError('No active Gemini API key configured.');
  }

  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('No extracted video frames provided for visual analysis. Visual frames are required.');
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 0.4, // Low temperature for high factual grounding
      topP: 0.9,
      responseMimeType: 'application/json'
    }
  });

  const parts = [];

  // 1. Add each extracted frame as a multimodal visual part with temporal labels
  for (const frame of frames) {
    parts.push({
      text: `[Frame ${frame.index} of ${frames.length} | Timestamp: ${frame.timeFormatted} (${frame.timeSeconds.toFixed(1)}s) | Position: ${frame.position}]`
    });
    parts.push({
      inlineData: {
        mimeType: frame.mimeType || 'image/jpeg',
        data: frame.base64
      }
    });
  }

  const previousCommentsContext = previousComments.length > 0
    ? `\nTo avoid repetition across reels, DO NOT generate any comments similar to these recently generated ones:\n- ${previousComments.slice(-10).join('\n- ')}`
    : '';

  // 2. Add system prompt with strict visual grounding instructions
  const systemPrompt = `
You are ReelAI, an expert visual analyst for Instagram Reels video content.
You have been provided with ${frames.length} sequential representative frames extracted directly from the actual video at key moments (beginning, middle, and end) over a duration of approximately ${Math.round(durationSeconds)} seconds.

Reel URL: ${reelUrl || 'N/A'}
User-provided Title/Topic: ${title || 'N/A'}
${previousCommentsContext}

CRITICAL RULES FOR FACTUAL VISUAL GROUNDING:
1. STRICT VISUAL GROUNDING: Ground your entire summary, subject, and actions EXCLUSIVELY on visual evidence visible in the provided frames.
2. NO INVENTED DETAILS: Do NOT invent, assume, or speculate on locations, dialogue, people, brands, or events that are not visibly confirmed in the frames.
3. VISUAL ACTIONS: Describe the observable motions, subject actions, visual changes, techniques, or scene progression from Frame 1 through Frame ${frames.length}.
4. SUFFICIENCY CHECK: If the frames are blurry, completely dark, or insufficient to understand the video, clearly note that in "videoSummary" and indicate what is visible.
5. COMMENT GROUNDING: Each of the 3 comments must directly reference specific visible elements from the video (e.g., specific objects, action timing, visual style, technique, setting).
6. NATURAL HUMAN TONE: Comments must sound like a real person watching this Reel (1-2 sentences max, authentic, conversational, thoughtful).
7. NO GENERIC PRAISE: NEVER output generic filler like "Nice video", "Great post", "Love this!", "Awesome", or "So cool!".
8. NO HASHTAGS: Do not include hashtags.
9. EMOJI LIMIT: Maximum 1 natural emoji per comment, or none at all.

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "videoSummary": "Accurate 2-3 sentence description of what actually happens in the video based on the frames",
  "mainSubject": "The main person, object, animal, or visual subject visible in the frames",
  "actions": "Specific observable actions or events occurring across the sampled frames",
  "category": "Comedy" | "Education" | "Travel" | "Fitness" | "Food" | "Technology" | "Fashion" | "Art" | "Lifestyle" | "Other",
  "mood": "e.g., Energetic, Peaceful, Informative, Humorous, Focused, Motivational",
  "language": "Identified on-screen language, or 'Not visible / Instrumental'",
  "comments": [
    {
      "text": "First comment grounded in observed visual content (1-2 sentences)",
      "tone": "Observant"
    },
    {
      "text": "Second comment grounded in observed visual content (1-2 sentences)",
      "tone": "Engaging"
    },
    {
      "text": "Third comment grounded in observed visual content (1-2 sentences)",
      "tone": "Appreciative"
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
      videoSummary: parsed.videoSummary || 'Visual content analyzed successfully from frames.',
      mainSubject: parsed.mainSubject || 'Visual subject in video',
      actions: parsed.actions || 'Observable visual progression across frames',
      category: parsed.category || 'Lifestyle',
      mood: parsed.mood || 'Natural',
      language: parsed.language || 'English',
      framesAnalyzed: frames.length,
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
  analyzeVideoFramesAndGenerateComments,
  classifyGeminiError,
  sanitizeErrorMessage,
  QuotaExceededError,
  InvalidApiKeyError,
  ModelUnavailableError,
  UnsupportedMethodError,
  NetworkConnectionError
};
