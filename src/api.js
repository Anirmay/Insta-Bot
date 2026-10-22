const BACKEND_PORT = 47829;
const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
const PRIMARY_API_BASE = isFileProtocol ? `http://127.0.0.1:${BACKEND_PORT}/api` : '/api';
const DIRECT_BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}/api`;

export class NetworkConnectionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'NetworkConnectionError';
    this.details = details;
  }
}

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Resilient request helper:
 * - Uses consistent relative '/api' during Vite development (via dev proxy)
 * - Properly parses JSON and isolates genuine network connection errors from HTTP 4xx/5xx responses
 * - Never masks validation or server errors as "Cannot connect" errors
 */
async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const timeoutMs = options.timeout || 12000;
  
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  const { timeout, ...fetchOptions } = options;

  async function parseResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      const errMsg = data?.error || data?.message || `Server responded with status ${res.status} (${res.statusText})`;
      throw new ApiError(errMsg, res.status, data);
    }

    return data;
  }

  // 1. Primary Request using configured API Base (/api in browser)
  const primaryUrl = `${PRIMARY_API_BASE}${cleanEndpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(primaryUrl, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // If Vite proxy returns an HTML gateway error (502/504), treat as network proxy failure
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok && (res.status === 502 || res.status === 504) && contentType.includes('text/html')) {
      throw new NetworkConnectionError(`Proxy gateway error (${res.status})`);
    }

    return await parseResponse(res);
  } catch (err) {
    clearTimeout(timeoutId);

    // If it's an application error returned by the server (4xx, 5xx), do not mask it!
    if (err instanceof ApiError) {
      throw err;
    }

    // 2. Fallback only if relative /api failed due to a network error and we're not on file:
    if (PRIMARY_API_BASE !== DIRECT_BACKEND_URL) {
      const directUrl = `${DIRECT_BACKEND_URL}${cleanEndpoint}`;
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), 4000);

      try {
        const directRes = await fetch(directUrl, {
          ...fetchOptions,
          headers,
          signal: fallbackController.signal
        });
        clearTimeout(fallbackTimeout);
        return await parseResponse(directRes);
      } catch (fallbackErr) {
        clearTimeout(fallbackTimeout);
        if (fallbackErr instanceof ApiError) {
          throw fallbackErr;
        }
      }
    }

    // Genuinely unreachable
    throw new NetworkConnectionError(
      `Cannot connect to ReelAI backend server at http://localhost:${BACKEND_PORT}. Please ensure the Express backend is running (run 'npm run dev' or 'npm run dev:server').`
    );
  }
}

export const api = {
  /**
   * Dedicated health check returning clean status
   */
  async checkHealth() {
    try {
      const res = await request('/status', { timeout: 4000 });
      if (res && typeof res === 'object' && res.status) {
        return { ok: true, data: res };
      }
      return { ok: false, error: 'Invalid health status payload' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  getStatus() {
    return request('/status');
  },

  startEngine() {
    return request('/engine/start', { method: 'POST' });
  },

  pauseEngine() {
    return request('/engine/pause', { method: 'POST' });
  },

  resumeEngine() {
    return request('/engine/resume', { method: 'POST' });
  },

  stopEngine() {
    return request('/engine/stop', { method: 'POST' });
  },

  setTarget(target) {
    return request('/engine/target', {
      method: 'POST',
      body: JSON.stringify({ target })
    });
  },

  setModel(modelId) {
    return request('/engine/model', {
      method: 'POST',
      body: JSON.stringify({ modelId })
    });
  },

  getModels() {
    return request('/models');
  },

  getKeys() {
    return request('/keys');
  },

  addKey({ nickname, apiKey, testNow = true, modelId = null }) {
    return request('/keys', {
      method: 'POST',
      body: JSON.stringify({ nickname, apiKey, testNow, modelId })
    });
  },

  testKey(id, modelId = null) {
    return request(`/keys/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ modelId })
    });
  },

  activateKey(id) {
    return request(`/keys/${id}/activate`, { method: 'POST' });
  },

  deleteKey(id) {
    return request(`/keys/${id}`, { method: 'DELETE' });
  },

  getReels() {
    return request('/reels');
  },

  addReel(formDataOrJson) {
    const isFormData = typeof FormData !== 'undefined' && formDataOrJson instanceof FormData;
    return request('/reels', {
      method: 'POST',
      body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson)
    });
  },

  batchAddReels(urls) {
    return request('/reels/batch', {
      method: 'POST',
      body: JSON.stringify({ urls })
    });
  },

  retryReel(id) {
    return request(`/reels/${id}/retry`, { method: 'POST' });
  },

  uploadReelVideo(id, file) {
    const formData = new FormData();
    formData.append('video', file);
    return request(`/reels/${id}/video`, {
      method: 'POST',
      body: formData
    });
  },

  deleteReel(id) {
    return request(`/reels/${id}`, { method: 'DELETE' });
  },

  toggleApproveComment(id) {
    return request(`/comments/${id}/approve`, { method: 'POST' });
  },

  togglePostComment(id) {
    return request(`/comments/${id}/post`, { method: 'POST' });
  },

  openInstagram(target, url = null) {
    return request('/instagram/open', {
      method: 'POST',
      body: JSON.stringify({ target, url })
    });
  },

  async connectInstagram() {
    if (typeof window !== 'undefined' && window.electronAPI?.instagram?.login) {
      try {
        return await window.electronAPI.instagram.login();
      } catch (e) {
        console.warn('Native Electron login invocation failed, falling back to backend:', e);
      }
    }
    return request('/instagram/connect', { method: 'POST' });
  },

  async logoutInstagram() {
    if (typeof window !== 'undefined' && window.electronAPI?.instagram?.logout) {
      try {
        return await window.electronAPI.instagram.logout();
      } catch (e) {
        console.warn('Native Electron logout invocation failed, falling back to backend:', e);
      }
    }
    return request('/instagram/logout', { method: 'POST' });
  },

  async checkInstagramSession() {
    if (typeof window !== 'undefined' && window.electronAPI?.instagram?.checkSession) {
      try {
        const nativeSession = await window.electronAPI.instagram.checkSession();
        if (nativeSession && nativeSession.status) {
          return nativeSession;
        }
      } catch (e) {
        console.warn('Native Electron session check failed, falling back to backend:', e);
      }
    }
    return request('/instagram/session');
  },

  updateInstagramSession(payload) {
    const body = typeof payload === 'boolean' ? { isLoggedIn: payload } : payload;
    return request('/instagram/session', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  getLogs() {
    return request('/logs');
  },

  clearLogs() {
    return request('/logs', { method: 'DELETE' });
  },

  seedSamples() {
    return request('/seed-samples', { method: 'POST' });
  }
};

export default api;
